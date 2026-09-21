import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Package, Wrench, X, AlertTriangle, Loader2 } from 'lucide-react'
import { useVisualViewport } from '@/hooks/use-visual-viewport'
import pb from '@/lib/pocketbase/client'
import { Product, CatalogService, OrcamentoItem, OrcamentoDescontoTipo } from '@/types'
import { getProducts } from '@/services/products'
import {
  createOrcamentoItem,
  updateOrcamentoItem,
  recalculateOrcamentoTotals,
} from '@/services/orcamentos'
import { getServices } from '@/services/services_catalog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
type SearchResult = {
  id: string
  kind: 'product' | 'service'
  name: string
  description?: string
  price: number
  stockQuantity?: number
  sku?: string
  category?: string
  raw: Product | CatalogService
}

interface OrcamentoItemModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orcamentoId: string
  itemToEdit?: OrcamentoItem | null
  onSaved: (itemResult?: OrcamentoItem) => void
  defaultKind?: 'produto' | 'servico'
  lockKind?: boolean
  isDraftMode?: boolean
  onSaveDraftItem?: (savedItem: OrcamentoItem, isEdit: boolean) => void
}

export function OrcamentoItemModal({
  open,
  onOpenChange,
  orcamentoId,
  itemToEdit,
  onSaved,
  defaultKind = 'produto',
  lockKind = false,
  isDraftMode = false,
  onSaveDraftItem,
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
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const scrollBodyRef = useRef<HTMLDivElement>(null)
  const { visibleHeight, isKeyboardOpen } = useVisualViewport()

  // Quando o input de busca ganha foco no mobile, rola suavemente para o topo visível
  // após o teclado do iOS subir (~150ms a 200ms)
  const handleSearchFocus = () => {
    setTimeout(() => {
      if (searchContainerRef.current) {
        searchContainerRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      } else if (inputSearchRef.current) {
        inputSearchRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }
    }, 180)
  }

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
      setKind(defaultKind)
      setActiveTab(
        defaultKind === 'servico' ? 'service' : defaultKind === 'produto' ? 'product' : 'all',
      )
      setDescricao('')
      setSelectedProductId(undefined)
      setQuantidade('1')
      setValorUnitario(0)
      setValorUnitarioInput('')
      setDescontoItem(0)
      setDescontoItemTipo('valor')
      setQuery('')
      setResults([])
    }
  }, [open, itemToEdit, defaultKind])

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
            description: p.description?.trim() || undefined,
            price: p.price || 0,
            stockQuantity: p.stock_quantity,
            sku: p.sku || undefined,
            category: p.category || undefined,
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
            description: s.description?.trim() || undefined,
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
    return isNaN(val) || val <= 0 ? 0 : val
  }, [quantidade])

  // Helper para interpretar valor unitário a partir do texto digitado
  const parseValorUnitarioString = (str: string): number => {
    let clean = str.trim().replace(/[R$\s]/gi, '')
    if (!clean) return 0
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.')
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.')
    }
    const num = parseFloat(clean)
    return isNaN(num) || num < 0 ? 0 : num
  }

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
    // Preenche a descrição completa (nome + descrição detalhada quando houver)
    const fullText =
      res.description && res.description.trim() && res.description.trim() !== res.name.trim()
        ? `${res.name} — ${res.description.trim()}`
        : res.name
    setDescricao(fullText)
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
    const finalDesc = descricao.trim()
    if (!finalDesc) {
      toast({
        title: 'Informe a descrição do item',
        description: 'Você pode digitar livremente qualquer descrição.',
        variant: 'destructive',
      })
      return
    }

    const finalQty = parsedQuantidade > 0 ? parsedQuantidade : 1

    // Garante sincronização do valor unitário a partir do campo de texto antes de salvar
    const finalUnitPrice =
      valorUnitario > 0 ? valorUnitario : parseValorUnitarioString(valorUnitarioInput)

    const rawTotal = finalQty * finalUnitPrice
    let descVal = 0
    if (descontoItem > 0) {
      if (descontoItemTipo === 'percentual') {
        descVal = (rawTotal * descontoItem) / 100
      } else {
        descVal = descontoItem
      }
    }
    const finalTotalItem = Math.max(0, rawTotal - descVal)

    setSaving(true)
    try {
      const isDraftBudget =
        isDraftMode ||
        orcamentoId === 'novo' ||
        !orcamentoId ||
        (itemToEdit && itemToEdit.id && itemToEdit.id.startsWith('draft-'))

      // Se for modo rascunho em memória OU id "novo" OU item de rascunho com id draft-*
      if (isDraftBudget) {
        const itemResult: OrcamentoItem = {
          id:
            isEditing && itemToEdit
              ? itemToEdit.id
              : `draft-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          id_orcamento: orcamentoId || 'novo',
          tipo: kind,
          id_produto: selectedProductId || undefined,
          descricao: finalDesc,
          quantidade: finalQty,
          valor_unitario: finalUnitPrice,
          desconto_item: Number(descontoItem) || 0,
          desconto_item_tipo: descontoItemTipo,
          valor_total_item: finalTotalItem,
          created: itemToEdit?.created || new Date().toISOString(),
          updated: new Date().toISOString(),
        } as OrcamentoItem

        if (onSaveDraftItem) {
          onSaveDraftItem(itemResult, isEditing)
        }
        toast({
          title: isEditing ? 'Item atualizado com sucesso!' : 'Item adicionado ao orçamento!',
        })

        // Reseta estados internos
        setDescricao('')
        setSelectedProductId(undefined)
        setQuantidade('1')
        setValorUnitario(0)
        setDescontoItem(0)
        setQuery('')
        setResults([])

        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }

        onSaved(itemResult)
        onOpenChange(false)
        return
      }

      const dataPayload: Partial<OrcamentoItem> = {
        id_orcamento: orcamentoId,
        tipo: kind,
        id_produto: selectedProductId || undefined,
        descricao: finalDesc,
        quantidade: finalQty,
        valor_unitario: finalUnitPrice,
        desconto_item: Number(descontoItem) || 0,
        desconto_item_tipo: descontoItemTipo,
        valor_total_item: finalTotalItem,
      }

      try {
        if (isEditing && itemToEdit) {
          await updateOrcamentoItem(itemToEdit.id, dataPayload)
          toast({ title: 'Item atualizado com sucesso!' })
        } else {
          await createOrcamentoItem(dataPayload)
          toast({ title: 'Item adicionado ao orçamento!' })
        }

        // Recalcula totais do orçamento no banco
        await recalculateOrcamentoTotals(orcamentoId)
      } catch (err: any) {
        // Proteção extra: se for 404 (not found) e tiver handler local, faz fallback gracioso para salvar em memória
        const errMsg = getErrorMessage(err).toLowerCase()
        const isNotFound =
          err?.status === 404 ||
          errMsg.includes("wasn't found") ||
          errMsg.includes('not found') ||
          errMsg.includes('não encontrado')

        if (isNotFound && onSaveDraftItem) {
          console.warn(
            'Item ou orçamento não encontrado no banco (404). Aplicando fallback em memória:',
            err,
          )
          const fallbackItem: OrcamentoItem = {
            id:
              isEditing && itemToEdit
                ? itemToEdit.id
                : `draft-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            id_orcamento: orcamentoId || 'novo',
            tipo: kind,
            id_produto: selectedProductId || undefined,
            descricao: finalDesc,
            quantidade: finalQty,
            valor_unitario: finalUnitPrice,
            desconto_item: Number(descontoItem) || 0,
            desconto_item_tipo: descontoItemTipo,
            valor_total_item: finalTotalItem,
            created: itemToEdit?.created || new Date().toISOString(),
            updated: new Date().toISOString(),
          } as OrcamentoItem

          onSaveDraftItem(fallbackItem, isEditing)
          toast({
            title: isEditing ? 'Item atualizado com sucesso!' : 'Item adicionado ao orçamento!',
          })

          setDescricao('')
          setSelectedProductId(undefined)
          setQuantidade('1')
          setValorUnitario(0)
          setDescontoItem(0)
          setQuery('')
          setResults([])

          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }

          onSaved(fallbackItem)
          onOpenChange(false)
          return
        }

        throw err
      }

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
    } catch (err) {
      const detailMsg = getErrorMessage(err)
      toast({
        title: 'Erro ao salvar item do orçamento',
        description: detailMsg || 'Verifique os dados digitados e tente novamente.',
        variant: 'destructive',
      })
      // Os dados digitados permanecem no modal e o modal permanece aberto para nova tentativa.
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          maxHeight: 'var(--teclado-altura, var(--app-visible-height, 100dvh))',
          height: 'var(--teclado-altura, var(--app-visible-height, 100dvh))',
        }}
        className="w-full max-w-full sm:max-w-2xl lg:max-w-3xl h-[var(--teclado-altura,var(--app-visible-height,100dvh))] sm:h-auto max-h-[var(--teclado-altura,var(--app-visible-height,100dvh))] sm:max-h-[92vh] rounded-none sm:rounded-lg p-0 gap-0 flex flex-col overflow-hidden"
      >
        <DialogHeader className="px-4 py-3 sm:px-5 sm:pt-4 sm:pb-2 border-b border-slate-100 shrink-0">
          <DialogTitle className="text-base font-bold text-slate-900">
            {isEditing
              ? kind === 'servico'
                ? 'Editar Serviço'
                : 'Editar Produto'
              : kind === 'servico'
                ? 'Adicionar Serviço / Mão de Obra'
                : 'Adicionar Produto / Peça'}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSave}
          noValidate
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div
            ref={scrollBodyRef}
            className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs overscroll-contain"
          >
            {/* Aviso informativo de digitação livre */}
            <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-blue-900 text-[11px] leading-relaxed">
              💡 <strong>Item livre:</strong> você pode digitar livremente a{' '}
              <strong>Descrição</strong>, <strong>Quantidade</strong> e <strong>Valor</strong>{' '}
              abaixo, sem precisar vincular a um produto. A busca no catálogo é opcional para
              preenchimento rápido.
            </div>

            {/* Autocomplete opcional apenas ao adicionar novo item */}
            {!isEditing && (
              <div
                ref={searchContainerRef}
                className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg scroll-mt-2"
              >
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 block">
                    Buscar no Catálogo (Opcional - preenchimento rápido)
                  </label>
                  {selectedProductId && (
                    <button
                      type="button"
                      onClick={() => setSelectedProductId(undefined)}
                      className="text-[10px] text-slate-500 hover:text-indigo-600 underline font-medium"
                      title="Desvincular produto do catálogo mantendo o texto digitado"
                    >
                      Desvincular catálogo (Item 100% livre)
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    ref={inputSearchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={handleSearchFocus}
                    placeholder="Digite para filtrar produtos/serviços cadastrados..."
                    className="pl-8 pr-8 h-9 text-xs bg-white"
                    autoComplete="off"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
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

                {/* Lista flutuante de resultados com indicador de falta de estoque e DESCRIÇÃO COMPLETA */}
                {/* Max-height dinâmico calculado pelo viewport visual para renderizar acima do teclado no iOS */}
                {results.length > 0 && (
                  <div
                    style={{
                      maxHeight: isKeyboardOpen
                        ? `${Math.max(160, Math.min(260, visibleHeight - 220))}px`
                        : undefined,
                    }}
                    className="max-h-56 sm:max-h-80 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-md shadow-sm overscroll-contain"
                  >
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
                            className="w-full flex items-start justify-between gap-3 p-3 text-left hover:bg-indigo-50/70 transition-colors min-h-[48px] touch-manipulation active:bg-indigo-100"
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              {item.kind === 'product' ? (
                                <Package className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                              ) : (
                                <Wrench className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                              )}
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-slate-900 text-xs sm:text-sm block leading-snug break-words">
                                  {item.name}
                                </span>
                                {item.description &&
                                  item.description.trim() !== item.name.trim() && (
                                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed break-words bg-slate-50/90 rounded px-2 py-1 border border-slate-100">
                                      {item.description}
                                    </p>
                                  )}
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1.5 py-0 h-4 border-slate-200 font-medium"
                                  >
                                    {item.kind === 'product' ? 'Produto' : 'Serviço'}
                                  </Badge>
                                  {item.sku && (
                                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 py-0.2 rounded">
                                      SKU: {item.sku}
                                    </span>
                                  )}
                                  {typeof item.stockQuantity === 'number' && (
                                    <span
                                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                                        isOutOfStock
                                          ? 'bg-rose-100 text-rose-700'
                                          : item.stockQuantity < 5
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-emerald-100 text-emerald-800'
                                      }`}
                                    >
                                      Estoque: {item.stockQuantity} un
                                    </span>
                                  )}
                                  {isOutOfStock && (
                                    <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-0.5">
                                      <AlertTriangle className="h-3 w-3" /> Falta de estoque
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-bold text-slate-900 text-sm block">
                                R$ {(item.price || 0).toFixed(2)}
                              </span>
                              <span className="text-[10px] text-indigo-600 font-medium hover:underline block mt-1">
                                Selecionar
                              </span>
                            </div>
                          </button>
                        )
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Tipo do Item (oculto se bloqueado para seção dedicada) */}
            {!lockKind ? (
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
            ) : (
              <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-md">
                {kind === 'servico' ? (
                  <>
                    <Wrench className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-900">
                      Item classificado como Serviço / Mão de Obra
                    </span>
                  </>
                ) : (
                  <>
                    <Package className="h-3.5 w-3.5 text-indigo-600" />
                    <span className="text-xs font-semibold text-indigo-900">
                      Item classificado como Produto / Peça
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Descrição livre (textarea auto-ajustável para textos longos) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 block">
                  Descrição do Item (Texto livre) *
                </label>
                {selectedProductId && (
                  <Badge
                    variant="outline"
                    className="text-[9px] text-indigo-700 bg-indigo-50 border-indigo-200"
                  >
                    Vinculado ao catálogo
                  </Badge>
                )}
              </div>
              <Textarea
                value={descricao}
                onChange={(e) => {
                  setDescricao(e.target.value)
                  // Se o usuário alterar a descrição livremente, mantém o texto livre
                }}
                placeholder="Digite a descrição livre que desejar (Ex: Formatação, Cabo HDMI 2m, Peça importada...)"
                rows={2}
                className="min-h-[64px] sm:min-h-[72px] text-xs leading-relaxed resize-y"
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
                    setValorUnitario(parseValorUnitarioString(filtered))
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
                {`R$ ${itemCalculations.finalTotal.toFixed(2)}`}
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
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Salvando...</span>
                </span>
              ) : (
                <span>{isEditing ? 'Salvar Alterações' : 'Adicionar Item'}</span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
