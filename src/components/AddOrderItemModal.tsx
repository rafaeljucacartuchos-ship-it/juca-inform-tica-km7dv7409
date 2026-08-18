import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Package, Wrench, X } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Product, CatalogService } from '@/types'
import { createOrderItem } from '@/services/service_orders'
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
  const [addingId, setAddingId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Foca o campo de busca ao abrir o modal.
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      const t = setTimeout(() => inputRef.current?.focus(), 50)
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
        const safe = term.replace(/"/g, '')
        const [products, services] = await Promise.all([
          pb.collection('products').getFullList<Product>({
            filter: `name ~ "${safe}" || sku ~ "${safe}" || category ~ "${safe}"`,
            sort: 'name',
            perPage: 50,
          }),
          pb.collection('services').getFullList<CatalogService>({
            filter: `name ~ "${safe}" || title ~ "${safe}"`,
            sort: 'name',
            perPage: 50,
          }),
        ])
        const mapped: SearchResult[] = [
          ...products.map((p) => ({
            id: p.id,
            kind: 'product' as const,
            name: p.name || 'Produto',
            price: p.price || 0,
            raw: p,
          })),
          ...services.map((s) => ({
            id: s.id,
            kind: 'service' as const,
            name: s.title || s.name || 'Serviço',
            price: s.price || 0,
            raw: s,
          })),
        ]
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

  const handleAdd = async (item: SearchResult) => {
    setAddingId(item.id)
    try {
      const unitPrice = item.price || 0
      await createOrderItem({
        service_order: orderId,
        service: item.kind === 'service' ? item.id : undefined,
        description: item.name,
        quantity: 1,
        unit_price: unitPrice,
        total: unitPrice,
      })
      // Recalcula o total buscando todos os itens atualizados
      try {
        const freshItems = await pb.collection('service_order_items').getFullList({
          filter: `service_order = "${orderId}"`,
        })
        const newTotal = freshItems.reduce((sum, it) => sum + (Number(it.total) || 0), 0)
        await pb.collection('service_orders').update(orderId, {
          total: newTotal,
        })
      } catch {
        /* total update best-effort */
      }
      toast({
        title: item.kind === 'product' ? 'Produto adicionado à OS' : 'Serviço adicionado à OS',
        description: item.name,
      })
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
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm font-bold text-slate-900">
            Adicionar Item / Serviço
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite o nome do produto ou serviço..."
              className="pl-8 pr-8 h-10 text-sm"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Busca em produtos e serviços em tempo real.
          </p>
        </div>

        <div className="max-h-[55vh] overflow-y-auto border-t border-slate-100">
          {loading && <div className="py-8 text-center text-xs text-slate-400">Buscando...</div>}

          {isEmpty && (
            <div className="py-8 text-center text-xs text-slate-400">
              Nenhum item encontrado para "{query}".
            </div>
          )}

          {!query.trim() && !loading && (
            <div className="py-8 text-center text-xs text-slate-400">
              Comece a digitar para buscar produtos ou serviços.
            </div>
          )}

          {results.map((item) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              onClick={() => handleAdd(item)}
              disabled={addingId !== null}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 disabled:opacity-50 border-b border-slate-50 last:border-0 transition-colors"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                  item.kind === 'product'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                {item.kind === 'product' ? (
                  <Package className="h-4 w-4" />
                ) : (
                  <Wrench className="h-4 w-4" />
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-slate-900 truncate">
                  {item.name}
                </span>
                <Badge
                  variant="outline"
                  className={`mt-0.5 text-[10px] h-4 px-1.5 ${
                    item.kind === 'product'
                      ? 'border-indigo-200 text-indigo-600'
                      : 'border-emerald-200 text-emerald-600'
                  }`}
                >
                  {item.kind === 'product' ? 'Produto' : 'Serviço'}
                </Badge>
              </span>
              <span className="text-sm font-mono font-bold text-slate-900 shrink-0">
                R$ {(item.price || 0).toFixed(2)}
              </span>
            </button>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
