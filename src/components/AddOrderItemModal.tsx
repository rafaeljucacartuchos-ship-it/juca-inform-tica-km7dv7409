import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Package, Wrench, X } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Product, CatalogService } from '@/types'
import { getProducts } from '@/services/products'
import { createOrderItem, syncServiceOrderTotal } from '@/services/service_orders'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

type SearchResult = {
  id: string
  kind: 'product' | 'service'
  name: string
  description?: string
  price: number
  raw: Product | CatalogService
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  currentTotal: number
  onAdded: () => void
}

export function AddOrderItemModal({ open, onOpenChange, orderId, currentTotal, onAdded }: Props) {
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'product' | 'service'>('all')
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null)
  const [quantity, setQuantity] = useState<string>('1')
  const [unitPrice, setUnitPrice] = useState<string>('0')
  const [addingId, setAddingId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const qtyInputRef = useRef<HTMLInputElement>(null)
  const unitPriceInputRef = useRef<HTMLInputElement>(null)

  // Normalização de quantidade e valor unitário
  const parsedQuantity = useMemo(() => {
    const norm = String(quantity).trim().replace(',', '.')
    const v = parseFloat(norm)
    return isNaN(v) || v <= 0 ? 1 : v
  }, [quantity])

  const parsedUnitPrice = useMemo(() => {
    let clean = String(unitPrice)
      .trim()
      .replace(/[R$\s]/gi, '')
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.')
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.')
    }
    const v = parseFloat(clean)
    return isNaN(v) || v < 0 ? 0 : v
  }, [unitPrice])

  // Foca o campo de busca ao abrir o modal e reseta o estado.
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedItem(null)
      setQuantity('1')
      setUnitPrice('0')
      setActiveTab('all')
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  // Busca debounced em products e services conforme o usuário digita.
  useEffect(() => {
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
        const safeServiceTerm = term.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const serviceFilter = `name ~ '${safeServiceTerm}' || title ~ '${safeServiceTerm}'`

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
        const services = servicesResult.items

        // Mapeia os produtos diferenciando pelo campo type (ou 'produto' por padrão)
        const mappedProducts: SearchResult[] = products.map((p) => {
          const isService = p.type === 'servico'
          return {
            id: p.id,
            kind: isService ? ('service' as const) : ('product' as const),
            name: p.name || (isService ? 'Serviço' : 'Produto'),
            description: p.description?.trim() || undefined,
            price: p.price || 0,
            raw: p,
          }
        })

        // Evita duplicar se o serviço já foi migrado para products
        const existingProductNames = new Set(
          mappedProducts.map((mp) => mp.name.toLowerCase().trim()),
        )
        const mappedLegacyServices: SearchResult[] = services
          .filter((s) => {
            const sName = (s.title || s.name || '').toLowerCase().trim()
            return !existingProductNames.has(sName)
          })
          .map((s) => ({
            id: s.id,
            kind: 'service' as const,
            name: s.title || s.name || 'Serviço',
            description: s.description?.trim() || undefined,
            price: s.price || 0,
            raw: s,
          }))

        const mapped: SearchResult[] = [...mappedProducts, ...mappedLegacyServices]
        setResults(mapped)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleSelectItem = (item: SearchResult) => {
    setSelectedItem(item)
    setQuantity('1')
    setUnitPrice(String(item.price || 0))
    setTimeout(() => {
      unitPriceInputRef.current?.focus()
      unitPriceInputRef.current?.select()
    }, 80)
  }

  const handleConfirmAdd = async () => {
    if (!selectedItem) return
    const validQty = parsedQuantity
    const validUnitPrice = parsedUnitPrice
    const itemSubtotal = validUnitPrice * validQty
    setAddingId(selectedItem.id)
    try {
      // Se for um item de catálogo legado (kind == service e não é do tipo Product)
      const isLegacyService = selectedItem.kind === 'service' && !('type' in selectedItem.raw)
      const fullDesc =
        selectedItem.description &&
        selectedItem.description.trim() &&
        selectedItem.description.trim() !== selectedItem.name.trim()
          ? `${selectedItem.name} — ${selectedItem.description.trim()}`
          : selectedItem.name

      await createOrderItem({
        service_order: orderId,
        service: isLegacyService ? selectedItem.id : undefined,
        product: !isLegacyService ? selectedItem.id : undefined,
        description: fullDesc,
        quantity: validQty,
        unit_price: validUnitPrice,
        total: itemSubtotal,
      })
      // Recalcula o total da OS via hierarquia centralizada
      try {
        await syncServiceOrderTotal(orderId)
      } catch {
        /* total update best-effort */
      }
      toast({
        title:
          selectedItem.kind === 'product' ? 'Produto adicionado à OS' : 'Serviço adicionado à OS',
        description: `${validQty}x ${selectedItem.name} — R$ ${itemSubtotal.toFixed(2)} (R$ ${validUnitPrice.toFixed(2)} cada)`,
      })

      // Limpeza de formulário e blur de teclado no mobile
      setSelectedItem(null)
      setQuery('')
      setResults([])
      setQuantity('1')
      setUnitPrice('0')

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }

      onAdded()
      onOpenChange(false)
    } catch {
      toast({ title: 'Erro ao adicionar item', variant: 'destructive' })
    } finally {
      setAddingId(null)
    }
  }

  const isEmpty = useMemo(
    () => !loading && query.trim() !== '' && results.length === 0,
    [loading, query, results],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          top: 'var(--visual-viewport-offset-top, 0px)',
          bottom: 'auto',
          maxHeight: 'var(--teclado-altura, var(--app-visible-height, 100dvh))',
          height: 'var(--teclado-altura, var(--app-visible-height, 100dvh))',
        }}
        className="w-full max-w-full sm:max-w-2xl top-[var(--visual-viewport-offset-top,0px)] bottom-auto h-[var(--teclado-altura,var(--app-visible-height,100dvh))] sm:h-auto max-h-[var(--teclado-altura,var(--app-visible-height,100dvh))] sm:max-h-[90vh] rounded-none sm:rounded-lg p-0 gap-0 flex flex-col overflow-hidden"
      >
        {' '}
        {/* Cabeçalho fixo (shrink-0) */}
        <DialogHeader className="px-4 py-3 sm:px-5 sm:pt-4 sm:pb-2 border-b border-slate-100 shrink-0">
          <DialogTitle className="text-base font-bold text-slate-900">
            Adicionar Item / Serviço
          </DialogTitle>
        </DialogHeader>
        {/* Bloco de busca e abas fixo no topo (shrink-0) — mesmo padrão visual do OrcamentoItemModal */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                setTimeout(() => {
                  inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 180)
              }}
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

          {/* Abas para filtrar resultados entre Todos | Produtos | Serviços (estilo idêntico ao OrcamentoItemModal) */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
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
              className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                activeTab === 'product'
                  ? 'bg-indigo-600 text-white'
                  : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
              }`}
            >
              <Package className="h-3 w-3" />
              Produtos ({results.filter((r) => r.kind === 'product').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('service')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                activeTab === 'service'
                  ? 'bg-emerald-600 text-white'
                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              <Wrench className="h-3 w-3" />
              Serviços ({results.filter((r) => r.kind === 'service').length})
            </button>
          </div>
        </div>
        {/* Lista de resultados rolável (flex-1 min-h-0 overflow-y-auto) */}
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 bg-white">
          {loading && <div className="py-8 text-center text-xs text-slate-400">Buscando...</div>}

          {isEmpty && (
            <div className="py-8 text-center text-xs text-slate-400">
              Nenhum item encontrado para "{query}".
            </div>
          )}

          {!query.trim() && !loading && (
            <div className="py-8 text-center text-xs text-slate-400">
              Comece a digitar para buscar produtos ou serviços no catálogo.
            </div>
          )}

          {results
            .filter((item) => activeTab === 'all' || item.kind === activeTab)
            .map((item) => {
              const isSelected = selectedItem?.id === item.id && selectedItem?.kind === item.kind
              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  onClick={() => handleSelectItem(item)}
                  disabled={addingId !== null}
                  className={`w-full flex items-start justify-between gap-3 p-3 text-left transition-colors ${
                    isSelected
                      ? 'bg-indigo-50/80 ring-1 ring-inset ring-indigo-500'
                      : 'hover:bg-indigo-50/50'
                  } disabled:opacity-50 min-h-[48px]`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    {item.kind === 'product' ? (
                      <Package className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                    ) : (
                      <Wrench className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-xs sm:text-sm text-slate-900 leading-snug block break-words">
                        {item.name}
                      </span>
                      {item.description && item.description.trim() !== item.name.trim() && (
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed break-words bg-slate-50 rounded px-2 py-1 border border-slate-100">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 h-4 border-slate-200 font-medium ${
                            item.kind === 'product' ? 'text-indigo-600' : 'text-emerald-600'
                          }`}
                        >
                          {item.kind === 'product' ? 'Produto' : 'Serviço'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 block">
                      R$ {(item.price || 0).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-indigo-600 font-medium block mt-1">
                      {isSelected ? '✓ Selecionado' : 'Selecionar'}
                    </span>
                  </div>
                </button>
              )
            })}
        </div>
        {/* Painel do Item Selecionado e Edição de Valores (fixo ou visível no rodapé com shrink-0) */}
        {selectedItem && (
          <div className="shrink-0 p-3 sm:p-4 bg-slate-50 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 truncate mr-2">
                Item Selecionado: <strong className="text-slate-900">{selectedItem.name}</strong>
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] shrink-0 ${
                  selectedItem.kind === 'product'
                    ? 'border-indigo-200 text-indigo-700 bg-indigo-50'
                    : 'border-emerald-200 text-emerald-700 bg-emerald-50'
                }`}
              >
                {selectedItem.kind === 'product' ? 'Produto' : 'Serviço'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3 bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200 shadow-2xs">
              {/* Edição do Valor Unitário */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 block">
                  Valor Unitário (R$) *
                </label>
                <Input
                  ref={unitPriceInputRef}
                  type="text"
                  inputMode="decimal"
                  value={unitPrice}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.,]/g, '')
                    setUnitPrice(val)
                  }}
                  onBlur={() => {
                    let clean = String(unitPrice)
                      .trim()
                      .replace(/[R$\s]/gi, '')
                    if (clean.includes('.') && clean.includes(',')) {
                      clean = clean.replace(/\./g, '').replace(',', '.')
                    } else if (clean.includes(',')) {
                      clean = clean.replace(',', '.')
                    }
                    const val = parseFloat(clean)
                    if (!isNaN(val) && val >= 0) {
                      setUnitPrice(
                        val.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }),
                      )
                    } else {
                      const defVal = selectedItem.price || 0
                      setUnitPrice(
                        defVal.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }),
                      )
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleConfirmAdd()
                    }
                  }}
                  placeholder="0.00"
                  className="h-9 text-xs font-mono font-bold text-slate-900"
                />
                <span className="text-[10px] text-slate-400 block truncate">
                  Tabela: R$ {(selectedItem.price || 0).toFixed(2)}
                </span>
              </div>

              {/* Quantidade (aceita inteiros e frações como 1, 0.5, 01 -> 1) */}
              <div className="space-y-1">
                <label
                  htmlFor="order-item-qty"
                  className="text-[11px] font-semibold text-slate-700 block"
                >
                  Quantidade
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0 text-slate-600 shrink-0 text-sm font-bold"
                    disabled={parsedQuantity <= 1 || addingId !== null}
                    onClick={() => {
                      const next = Math.max(1, parsedQuantity - 1)
                      setQuantity(String(next))
                    }}
                  >
                    -
                  </Button>
                  <Input
                    id="order-item-qty"
                    ref={qtyInputRef}
                    type="text"
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.,]/g, '')
                      setQuantity(val)
                    }}
                    onBlur={() => {
                      const norm = String(quantity).trim().replace(',', '.')
                      const val = parseFloat(norm)
                      if (!isNaN(val) && val > 0) {
                        setQuantity(String(val))
                      } else {
                        setQuantity('1')
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleConfirmAdd()
                      }
                    }}
                    className="h-9 flex-1 text-center font-bold font-mono text-xs px-1 min-w-0"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0 text-slate-600 shrink-0 text-sm font-bold"
                    disabled={addingId !== null}
                    onClick={() => {
                      const next = parsedQuantity + 1
                      setQuantity(String(next))
                    }}
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>

            {/* Recálculo em tempo real do Subtotal e botão Adicionar à O.S. */}
            <div className="flex items-center justify-between pt-1 gap-2">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-500 block truncate">
                  Subtotal (Qtd × Valor)
                </span>
                <span className="font-mono font-bold text-sm sm:text-base text-indigo-600 block truncate">
                  R$ {(parsedUnitPrice * parsedQuantity).toFixed(2)}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmAdd}
                disabled={addingId !== null}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-10 px-5 font-semibold shadow-xs shrink-0 min-h-[44px]"
              >
                {addingId !== null ? 'Adicionando...' : 'Adicionar à O.S.'}
              </Button>
            </div>
          </div>
        )}
        {/* Rodapé fixo (shrink-0) */}
        <div className="shrink-0 px-4 py-2.5 sm:py-3 border-t border-slate-200 bg-slate-50/70 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] sm:min-h-0 text-xs px-4"
          >
            {selectedItem ? 'Cancelar' : 'Fechar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
