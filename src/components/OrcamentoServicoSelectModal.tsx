import { useState, useEffect, useRef } from 'react'
import { Search, Wrench, X, Loader2, Plus, Check } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Product, CatalogService } from '@/types'
import { getProducts } from '@/services/products'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface SelectedServicoCadastrado {
  id?: string
  descricao: string
  valorUnitario: number
}

interface OrcamentoServicoSelectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (servico: SelectedServicoCadastrado) => void
}

type ServiceResult = {
  id: string
  name: string
  price: number
  source: 'products' | 'services'
}

export function OrcamentoServicoSelectModal({
  open,
  onOpenChange,
  onSelect,
}: OrcamentoServicoSelectModalProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ServiceResult[]>([])
  const [recentServices, setRecentServices] = useState<ServiceResult[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Carrega lista inicial de serviços cadastrados
  useEffect(() => {
    if (!open) return
    setQuery('')
    loadInitialServices()
    setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  const loadInitialServices = async () => {
    setLoading(true)
    try {
      const [prodsServicos, catalogServices] = await Promise.all([
        getProducts('', 1, 50, 'servico').catch(() => [] as Product[]),
        pb
          .collection('services')
          .getList<CatalogService>(1, 50, { sort: 'name' })
          .then((res) => res.items)
          .catch(() => [] as CatalogService[]),
      ])

      const list: ServiceResult[] = []
      const seen = new Set<string>()

      for (const p of prodsServicos) {
        const key = (p.name || '').toLowerCase().trim()
        if (!key || seen.has(key)) continue
        seen.add(key)
        list.push({
          id: p.id,
          name: p.name,
          price: Number(p.price) || 0,
          source: 'products',
        })
      }

      for (const s of catalogServices) {
        const title = s.title || s.name || ''
        const key = title.toLowerCase().trim()
        if (!key || seen.has(key)) continue
        seen.add(key)
        list.push({
          id: s.id,
          name: title,
          price: Number(s.price) || 0,
          source: 'services',
        })
      }

      setRecentServices(list.slice(0, 30))
      setResults(list.slice(0, 30))
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  // Busca filtrada ao digitar
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const term = query.trim()
    if (!term) {
      setResults(recentServices)
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const safeTerm = term.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const serviceFilter = `name ~ '${safeTerm}' || title ~ '${safeTerm}'`

        const [prodsServicos, catalogServices] = await Promise.all([
          getProducts(term, 1, 50, 'servico').catch(() => [] as Product[]),
          pb
            .collection('services')
            .getList<CatalogService>(1, 50, {
              filter: serviceFilter,
              sort: 'name',
            })
            .then((res) => res.items)
            .catch(() => [] as CatalogService[]),
        ])

        const list: ServiceResult[] = []
        const seen = new Set<string>()

        for (const p of prodsServicos) {
          const key = (p.name || '').toLowerCase().trim()
          if (!key || seen.has(key)) continue
          seen.add(key)
          list.push({
            id: p.id,
            name: p.name,
            price: Number(p.price) || 0,
            source: 'products',
          })
        }

        for (const s of catalogServices) {
          const title = s.title || s.name || ''
          const key = title.toLowerCase().trim()
          if (!key || seen.has(key)) continue
          seen.add(key)
          list.push({
            id: s.id,
            name: title,
            price: Number(s.price) || 0,
            source: 'services',
          })
        }

        setResults(list)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, recentServices])

  const handlePick = (item: ServiceResult) => {
    onSelect({
      id: item.id,
      descricao: item.name,
      valorUnitario: item.price || 0,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-lg p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="px-4 py-3 border-b border-slate-100 shrink-0">
          <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-emerald-600" />
            <span>Selecionar Serviço Cadastrado</span>
          </DialogTitle>
        </DialogHeader>

        <div className="p-3 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar serviço no catálogo pelo nome..."
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
          <p className="text-[11px] text-slate-500 mt-1.5">
            Ao selecionar, a descrição e o valor padrão serão inseridos na seção de serviços e você
            poderá alterá-los livremente.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 p-1">
          {loading ? (
            <div className="py-8 flex items-center justify-center text-xs text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              <span>Buscando serviços cadastrados...</span>
            </div>
          ) : results.length > 0 ? (
            results.map((serv) => (
              <button
                key={`${serv.source}-${serv.id}`}
                type="button"
                onClick={() => handlePick(serv)}
                className="w-full text-left p-2.5 hover:bg-emerald-50/70 flex items-center justify-between rounded-md transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <div className="h-7 w-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Wrench className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-xs text-slate-900 truncate group-hover:text-emerald-900">
                      {serv.name}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-4 border-slate-200 text-slate-500"
                    >
                      Catálogo de Serviços
                    </Badge>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-xs text-slate-900">
                    R$ {serv.price.toFixed(2)}
                  </span>
                  <div className="text-[10px] text-emerald-600 font-semibold flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Check className="h-3 w-3" /> Escolher
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              Nenhum serviço encontrado para "{query}".
            </div>
          )}
        </div>

        <DialogFooter className="p-3 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
