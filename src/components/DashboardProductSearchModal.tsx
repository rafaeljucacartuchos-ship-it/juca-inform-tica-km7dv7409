import { useState, useEffect, useRef } from 'react'
import { Search, Package, Barcode, DollarSign, Layers, Loader2, X, Camera } from 'lucide-react'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Product } from '@/types'
import { getProducts } from '@/services/products'

interface DashboardProductSearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DashboardProductSearchModal({
  open,
  onOpenChange,
}: DashboardProductSearchModalProps) {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const performSearch = async (searchTerm: string) => {
    setLoading(true)
    try {
      const results = await getProducts(searchTerm)
      setProducts(results)
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setQuery('')
      performSearch('')
      const timer = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query)
    }, 250)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2 text-indigo-600">
            <Package className="h-5 w-5" />
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
              Buscar Produto no Estoque
            </DialogTitle>
          </div>
          <p className="text-xs text-slate-500">
            Pesquise rapidamente por nome, código SKU ou código de barras.
          </p>
        </DialogHeader>

        <div className="relative my-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            ref={inputRef}
            placeholder="Digite o nome, código (SKU) ou código de barras..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-16 h-10 text-xs sm:text-sm bg-slate-50 border-slate-200"
          />
          <div className="absolute right-2 top-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              title="Escanear código de barras"
              aria-label="Escanear código de barras"
              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors rounded hover:bg-slate-200/60"
            >
              <Camera className="h-4 w-4" />
            </button>
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                title="Limpar busca"
                aria-label="Limpar busca"
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors rounded hover:bg-slate-200/60"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg max-h-[50vh] sm:max-h-[55vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500 text-xs">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              <span>Buscando produtos...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs space-y-1">
              <Package className="h-8 w-8 mx-auto text-slate-300" />
              <p className="font-semibold text-slate-600">Nenhum produto encontrado</p>
              <p className="text-slate-400">Tente buscar por outro termo ou código.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Código (SKU)</th>
                    <th className="py-2.5 px-3">Produto</th>
                    <th className="py-2.5 px-3">Código de Barras</th>
                    <th className="py-2.5 px-3 text-center">Estoque</th>
                    <th className="py-2.5 px-3 text-right">Preço</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {products.map((p) => {
                    const stock = p.stock_quantity ?? 0
                    const isLow = stock <= 0
                    const barcode = p.barcode || p.codigo_barras || '—'
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                          {p.sku || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block">{p.name}</span>
                          {p.category && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              {p.category}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                          {barcode !== '—' ? (
                            <span className="inline-flex items-center gap-1">
                              <Barcode className="h-3 w-3 text-slate-400" />
                              {barcode}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-xs ${
                              isLow
                                ? 'bg-rose-100 text-rose-700'
                                : stock < 5
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {stock} un
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          R$ {(p.price || 0).toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
          <span>
            {products.length} {products.length === 1 ? 'produto listado' : 'produtos listados'}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>

      <BarcodeScanner
        open={showScanner}
        onOpenChange={setShowScanner}
        onDetected={(code) => {
          setQuery(code)
        }}
      />
    </Dialog>
  )
}
