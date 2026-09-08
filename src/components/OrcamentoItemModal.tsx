import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Package, Wrench, X, AlertTriangle } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Product, CatalogService, OrcamentoItem, OrcamentoDescontoTipo } from '@/types'
import { getProducts } from '@/services/products'
import {
  createOrcamentoItem,
  updateOrcamentoItem,
  recalculateOrcamentoTotals,
} from '@/services/orcamentos'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

type SearchResult = {
  id: string
  kind: 'product' | 'service'
  name: string
  price: number
  stockQuantity?: number
  raw: Product | CatalogService
}

interface OrcamentoItemModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orcamentoId: string
  itemToEdit?: OrcamentoItem | null
  onSaved: () => void
}

export function OrcamentoItemModal({
  open,
  onOpenChange,
  orcamentoId,
  itemToEdit,
  onSaved,
}: OrcamentoItemModalProps) {
  const { toast } = useToast()
  const isEditing = Boolean(itemToEdit)

  // Estados do formulário
  const [kind, setKind] = useState<'produto' | 'servico'>('servico')
  const [descricao, setDescricao] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined)
  const [quantidade, setQuantidade] = useState<string>('1')
  const [valorUnitario, setValorUnitario] = useState<number>(0)
  const [valorUnitarioInput, setValorUnitarioInput] = useState<string>('')
  const [descontoItem, setDescontoItem] = useState<number>(0)
  const [descontoItemTipo, setDescontoItemTipo] = useState<OrcamentoDescontoTipo>('valor')
  const [saving, setSaving] = useState(false)

  // Autocomplete / Busca
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'product' | 'service'>('all')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    if (itemToEdit) {
      setKind(itemToEdit.tipo)
      setDescricao(itemToEdit.descricao)
      setSelectedProductId(itemToEdit.id_produto)
      setQuantidade(String(itemToEdit.quantidade ?? 1))
      const vu = itemToEdit.valor_unitario ?? 0
      setValorUnitario(vu)
      setValorUnitarioInput(
        vu > 0
          ? vu.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '',
      )
      setDescontoItem(itemToEdit.desconto_item || 0)
      setDescontoItemTipo(itemToEdit.desconto_item_tipo || 'valor')
      setQuery('')
      setResults([])
    } else {
      setKind('produto')
      setDescricao('')
      setSelectedProductId(undefined)
      setQuantidade('1')
      setValorUnitario(0)
      setValorUnitarioInput('')
      setDescontoItem(0)
      setDescontoItemTipo('valor')
      setQuery('')
      setResults([])
      // Foco suave no campo de busca ao abrir para adicionar novo item
      setTimeout(() => inputSearchRef.current?.focus(), 60)
    }
  }, [open, itemToEdit])

  // Busca produtos e serviços no catálogo
  useEffect(() => {
    if (isEditing) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const term = query.trim()
    if (!term) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const safeTerm = term.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const serviceFilter = `name ~ '${safeTerm}' || title ~ '${safeTerm}'`

        const [products, servicesResult] = await Promise.all([
          getProducts(term, 1, 50),
          pb
            .collection('services')
            .getList<CatalogService>(1, 50, {
              filter: serviceFilter,
              sort: 'name',
            })
            .catch(() => ({ items: [] as CatalogService[] })),
        ])

        const mappedProducts: SearchResult[] = products.map((p) => {
          const isServ = p.type === 'servico'
          return {
            id: p.id,
            kind: isServ ? 'service' : 'product',
            name: p.name || (isServ ? 'Serviço' : 'Produto'),
            price: p.price || 0,
            stockQuantity: p.stock_quantity,
            raw: p,
          }
        })

        const existingNames = new Set(mappedProducts.map((mp) => mp.name.toLowerCase().trim()))
        const mappedLegacyServices: SearchResult[] = servicesResult.items
          .filter((s) => !existingNames.has((s.title || s.name || '').toLowerCase().trim()))
          .map((s) => ({
            id: s.id,
            kind: 'service',
            name: s.title || s.name || 'Serviço',
            price: s.price || 0,
            raw: s,
          }))

        setResults([...mappedProducts, ...mappedLegacyServices])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, isEditing])

  // Converte string de quantidade para número válido (suporta vírgula ou ponto, "01" -> 1, "0.5" -> 0.5)
  const parsedQuantidade = useMemo(() => {
    const normalized = String(quantidade).trim().replace(',', '.')
    const val = parseFloat(normalized)
    return isNaN(val) ? 0 : val
  }, [quantidade])

  // Cálculo em tempo real do item:
  // subtotal = quantidade × valorUnitario
  // desconto = percentual OU valor
  // total = max(0, subtotal - desconto)
  const itemCalculations = useMemo(() => {
    const rawTotal = parsedQuantidade * (Number(valorUnitario) || 0)
    let descVal = 0
    if (descontoItem > 0) {
      if (descontoItemTipo === 'percentual') {
        descVal = (rawTotal * descontoItem) / 100
      } else {
        descVal = descontoItem
      }
    }
    const finalTotal = Math.max(0, rawTotal - descVal)
    return { rawTotal, descVal, finalTotal }
  }, [quantidade, valorUnitario, descontoItem, descontoItemTipo])

  const handleSelectSearchResult = (res: SearchResult) => {
    setKind(res.kind === 'product' ? 'produto' : 'servico')
    setDescricao(res.name)
    setSelectedProductId(res.id)
    const p = res.price || 0
    setValorUnitario(p)
    setValorUnitarioInput(
      p > 0
        ? p.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '',
    )
    setQuantidade('1')
    setDescontoItem(0)
    setResults([])
    setQuery('')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!descricao.trim()) {
      toast({ title: 'Informe a descrição do item', variant: 'destructive' })
      return
    }
    if (parsedQuantidade <= 0) {
      toast({ title: 'A quantidade deve ser maior que zero', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const dataPayload: Partial<OrcamentoItem> = {
        id_orcamento: orcamentoId,
        tipo: kind,
        id_produto: selectedProductId || undefined,
        descricao: descricao.trim(),
        quantidade: parsedQuantidade,
        valor_unitario: Number(valorUnitario),
        desconto_item: Number(descontoItem) || 0,
        desconto_item_tipo: descontoItemTipo,
        valor_total_item: itemCalculations.finalTotal,
      }

      if (isEditing && itemToEdit) {
        await updateOrcamentoItem(itemToEdit.id, dataPayload)
        toast({ title: 'Item atualizado com sucesso!' })
      } else {
        await createOrcamentoItem(dataPayload)
        toast({ title: 'Item adicionado ao orçamento!' })
      }

      // Recalcula totais do orçamento
      await recalculateOrcamentoTotals(orcamentoId)

      // Reseta os estados internos para garantir que reaberturas fiquem limpas
      setDescricao('')
      setSelectedProductId(undefined)
      setQuantidade('1')
      setValorUnitario(0)
      setDescontoItem(0)
      setQuery('')
      setResults([])

      // Remove foco de qualquer input ativo para evitar travamento em teclado mobile
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }

      onSaved()
      onOpenChange(false)
    } catch {
      toast({ title: 'Erro ao salvar item do orçamento', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-xl h-[100dvh] sm:h-auto max-h-[var(--app-visible-height,100dvh)] sm:max-h-[92vh] rounded-none sm:rounded-lg p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 py-3 sm:px-5 sm:pt-4 sm:pb-2 border-b border-slate-100 shrink-0">
          <DialogTitle className="text-base font-bold text-slate-900">
            {isEditing ? 'Editar Item do Orçamento' : 'Adicionar Item ao Orçamento'}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSave}
          noValidate
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
            {/* Autocomplete apenas ao adicionar novo item */}
            {!isEditing && (
              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="font-semibold text-slate-700 block">
                  Buscar no Catálogo (Autocomplete de Produtos e Serviços)
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    ref={inputSearchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Digite o nome, código ou peça..."
                    className="pl-8 pr-8 h-9 text-xs bg-white"
                    autoComplete="off"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Filtros da busca rápida */}
                {results.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('all')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        activeTab === 'all'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Todos ({results.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('product')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        activeTab === 'product'
                          ? 'bg-indigo-600 text-white'
                          : 'text-indigo-700 bg-indigo-50'
                      }`}
                    >
                      Produtos ({results.filter((r) => r.kind === 'product').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('service')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        activeTab === 'service'
                          ? 'bg-emerald-600 text-white'
                          : 'text-emerald-700 bg-emerald-50'
                      }`}
                    >
                      Serviços ({results.filter((r) => r.kind === 'service').length})
                    </button>
                  </div>
                )}

                {/* Lista flutuante de resultados com indicador de falta de estoque */}
                {results.length > 0 && (
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-md shadow-sm">
                    {results
                      .filter((r) => activeTab === 'all' || r.kind === activeTab)
                      .map((item) => {
                        const isOutOfStock =
                          item.kind === 'product' &&
                          typeof item.stockQuantity === 'number' &&
                          item.stockQuantity <= 0

                        return (
                          <button
                            key={`${item.kind}-${item.id}`}
                            type="button"
                            onClick={() => handleSelectSearchResult(item)}
                            className="w-full flex items-center justify-between p-2 text-left hover:bg-indigo-50/60 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {item.kind === 'product' ? (
                                <Package className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                              ) : (
                                <Wrench className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              )}
                              <div className="truncate">
                                <span className="font-medium text-slate-900 truncate block">
                                  {item.name}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 h-4 border-slate-200"
                                  >
                                    {item.kind === 'product' ? 'Produto' : 'Serviço'}
                                  </Badge>
                                  {isOutOfStock && (
                                    <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-0.5">
                                      <AlertTriangle className="h-3 w-3" /> Falta de estoque
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-slate-900 shrink-0 ml-2">
                              R$ {(item.price || 0).toFixed(2)}
                            </span>
                          </button>
                        )
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Tipo do Item */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Tipo do Item *</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={kind === 'produto' ? 'default' : 'outline'}
                  size="sm"
                  className={`h-9 text-xs justify-start gap-2 ${
                    kind === 'produto' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''
                  }`}
                  onClick={() => setKind('produto')}
                >
                  <Package className="h-4 w-4" /> Produto / Peça
                </Button>
                <Button
                  type="button"
                  variant={kind === 'servico' ? 'default' : 'outline'}
                  size="sm"
                  className={`h-9 text-xs justify-start gap-2 ${
                    kind === 'servico' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                  }`}
                  onClick={() => setKind('servico')}
                >
                  <Wrench className="h-4 w-4" /> Mão de Obra / Serviço
                </Button>
              </div>
            </div>

            {/* Descrição livre */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Descrição do Item *</label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Formatação com backup, SSD 480GB Kingston, Troca de tela..."
                className="h-9 text-xs"
                required
              />
            </div>

            {/* Quantidade e Valor Unitário (Aceita inteiros e frações decimais com . ou ,, ex: 1, 0.5, 01 -> 1) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">
                  Quantidade {kind === 'servico' ? '(permite frações)' : ''} *
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={quantidade}
                  onChange={(e) => {
                    // Permite digitação livre de números, vírgula e ponto
                    const val = e.target.value.replace(/[^0-9.,]/g, '')
                    setQuantidade(val)
                  }}
                  onBlur={() => {
                    // Normaliza na saída do campo: "01" -> "1", "" -> "1"
                    const normalized = String(quantidade).trim().replace(',', '.')
                    const val = parseFloat(normalized)
                    if (!isNaN(val) && val > 0) {
                      // Mantém fração se houver, remove zeros redundantes à esquerda
                      setQuantidade(String(val))
                    } else if (quantidade === '' || val <= 0) {
                      setQuantidade('1')
                    }
                  }}
                  placeholder="1"
                  className="h-9 text-xs font-mono font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Valor Unitário (R$) *</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={valorUnitarioInput}
                  onChange={(e) => {
                    const raw = e.target.value
                    // Permite digitação livre de números, pontos e vírgulas
                    const filtered = raw.replace(/[^\d.,]/g, '')
                    setValorUnitarioInput(filtered)

                    // Converte em tempo real para número (formato brasileiro ou padrão)
                    let clean = filtered.trim()
                    if (clean.includes('.') && clean.includes(',')) {
                      clean = clean.replace(/\./g, '').replace(',', '.')
                    } else if (clean.includes(',')) {
                      clean = clean.replace(',', '.')
                    }
                    const num = parseFloat(clean)
                    setValorUnitario(isNaN(num) || num < 0 ? 0 : num)
                  }}
                  onBlur={() => {
                    if (valorUnitario > 0) {
                      setValorUnitarioInput(
                        valorUnitario.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }),
                      )
                    } else if (!valorUnitarioInput.trim()) {
                      setValorUnitario(0)
                      setValorUnitarioInput('')
                    }
                  }}
                  placeholder="0,00"
                  className="h-9 text-xs font-mono font-bold"
                  required
                />
              </div>
            </div>

            {/* Desconto no Item (Nível 1 de desconto: por item) */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 block">
                  Desconto no Item (Opcional)
                </label>
                <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setDescontoItemTipo('valor')}
                    className={`px-2 py-0.5 rounded font-semibold ${
                      descontoItemTipo === 'valor' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                    }`}
                  >
                    R$ Fixo
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescontoItemTipo('percentual')}
                    className={`px-2 py-0.5 rounded font-semibold ${
                      descontoItemTipo === 'percentual'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    % Porcento
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={descontoItemTipo === 'percentual' ? '100' : undefined}
                    value={descontoItem === 0 ? '' : descontoItem}
                    onChange={(e) => setDescontoItem(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    className="h-8 text-xs font-mono text-rose-700 font-bold"
                  />
                </div>
                <span className="text-slate-500 font-semibold shrink-0">
                  {descontoItemTipo === 'percentual' ? '%' : 'R$'}
                </span>
              </div>

              {descontoItem > 0 && (
                <p className="text-[11px] text-rose-600 font-medium">
                  Desconto aplicado no item: - R$ {itemCalculations.descVal.toFixed(2)}
                </p>
              )}
            </div>

            {/* Totalizador do Item em tempo real */}
            <div className="flex items-center justify-between p-3 bg-indigo-50/70 rounded-lg border border-indigo-100 text-xs">
              <span className="font-semibold text-indigo-950">Valor Total do Item:</span>
              <span className="text-base font-bold font-mono text-indigo-900">
                R$ {itemCalculations.finalTotal.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-slate-200 shrink-0 bg-slate-50/80 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="min-h-[44px] sm:min-h-0 px-4 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white min-h-[44px] sm:min-h-0 px-5 text-xs font-semibold shadow-xs"
            >
              {saving ? 'Gravando...' : isEditing ? 'Salvar Alterações' : 'Adicionar Item'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
