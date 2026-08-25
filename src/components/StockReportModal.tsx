import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Product } from '@/types'
import { generateProductsReport, exportProductsToExcel } from '@/lib/product-excel'
import {
  FileText,
  Download,
  Printer,
  Search,
  Package,
  Layers,
  CircleDollarSign,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'

interface StockReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
}

export function StockReportModal({ open, onOpenChange, products }: StockReportModalProps) {
  const [filterSearch, setFilterSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  // Categorias únicas
  const categories = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim())
      }
    })
    return Array.from(set).sort()
  }, [products])

  // Produtos filtrados no modal
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !filterSearch.trim() ||
        (p.name && p.name.toLowerCase().includes(filterSearch.toLowerCase())) ||
        (p.sku && p.sku.toLowerCase().includes(filterSearch.toLowerCase()))
      const matchCategory =
        filterCategory === 'all' || (p.category && p.category === filterCategory)
      return matchSearch && matchCategory
    })
  }, [products, filterSearch, filterCategory])

  // Estatísticas e totalizadores
  const totals = useMemo(() => {
    let totalItens = 0
    let totalCustoEstoque = 0
    let totalVendaEstoque = 0
    let itensZerados = 0

    filteredProducts.forEach((p) => {
      const qty = p.stock_quantity ?? 0
      const cost = p.cost || 0
      const price = p.price || 0

      totalItens += qty
      totalCustoEstoque += qty * cost
      totalVendaEstoque += qty * price
      if (qty <= 0) itensZerados++
    })

    const lucroProjetado = totalVendaEstoque - totalCustoEstoque
    const margemMedia =
      totalVendaEstoque > 0 ? ((lucroProjetado / totalVendaEstoque) * 100).toFixed(1) : '0'

    return {
      totalItens,
      totalCustoEstoque,
      totalVendaEstoque,
      lucroProjetado,
      margemMedia,
      itensZerados,
      totalProdutos: filteredProducts.length,
    }
  }, [filteredProducts])

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadExcel = () => {
    exportProductsToExcel(filteredProducts, 'estoque_produtos')
  }

  const handleDownloadReport = () => {
    generateProductsReport(filteredProducts, 'relatorio_conferencia_estoque')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[950px] max-h-[92vh] flex flex-col p-6">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-indigo-600">
              <FileText className="h-5 w-5" />
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Relatório para Conferência de Estoque
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Listagem completa com código, estoque atual, preços e totais para conferência
                  física.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-8 text-xs gap-1 text-slate-700 hover:bg-slate-50 print:hidden"
              >
                <Printer className="h-3.5 w-3.5 text-slate-500" />
                <span>Imprimir</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadReport}
                className="h-8 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-medium"
              >
                <Download className="h-3.5 w-3.5 text-indigo-600" />
                <span>Baixar Planilha Conferência</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo / Cards de Indicadores */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-1">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium mb-1">
              <Package className="h-3.5 w-3.5 text-indigo-500" />
              <span>Produtos Listados</span>
            </div>
            <div className="text-lg font-bold text-slate-900">{totals.totalProdutos}</div>
            <div className="text-[10px] text-slate-500">{totals.totalItens} unidades no total</div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium mb-1">
              <Layers className="h-3.5 w-3.5 text-amber-500" />
              <span>Custo do Estoque</span>
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono">
              R$ {totals.totalCustoEstoque.toFixed(2)}
            </div>
            <div className="text-[10px] text-amber-600 font-medium">Investimento total</div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium mb-1">
              <CircleDollarSign className="h-3.5 w-3.5 text-emerald-500" />
              <span>Valor em Venda</span>
            </div>
            <div className="text-lg font-bold text-emerald-700 font-mono">
              R$ {totals.totalVendaEstoque.toFixed(2)}
            </div>
            <div className="text-[10px] text-emerald-600 font-medium">Potencial de faturamento</div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
              <span>Lucro Projetado</span>
            </div>
            <div className="text-lg font-bold text-blue-700 font-mono">
              R$ {totals.lucroProjetado.toFixed(2)}
            </div>
            <div className="text-[10px] text-blue-600 font-medium">
              Margem est.: {totals.margemMedia}%
            </div>
          </div>
        </div>

        {/* Filtro Rápido */}
        <div className="flex flex-col sm:flex-row gap-2 py-1">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Buscar por nome ou SKU..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50"
            />
          </div>
          {categories.length > 0 && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-8 text-xs rounded-md border border-slate-200 bg-slate-50 px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Todas as Categorias ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Tabela do Relatório */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg max-h-[380px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3">Código (SKU)</th>
                <th className="py-2.5 px-3">Código de Barras</th>
                <th className="py-2.5 px-3">Nome do Produto</th>
                <th className="py-2.5 px-3 text-center">Estoque Atual</th>
                <th className="py-2.5 px-3 text-right">Preço Custo</th>
                <th className="py-2.5 px-3 text-right">Preço Venda</th>
                <th className="py-2.5 px-3 text-right">Total Custo</th>
                <th className="py-2.5 px-3 text-right">Total Venda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredProducts.map((p, idx) => {
                const barcode = p.barcode || p.codigo_barras || p.sku || '-'
                const qty = p.stock_quantity ?? 0
                const cost = p.cost || 0
                const price = p.price || 0
                const subCost = qty * cost
                const subPrice = qty * price

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2 px-3 font-mono text-slate-700">{p.sku || '-'}</td>
                    <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">{barcode}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">
                      <div>{p.name}</div>
                      {p.category && (
                        <span className="text-[10px] text-slate-500">{p.category}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-mono">
                      <span
                        className={`font-semibold ${
                          qty <= 0 ? 'text-red-600' : qty < 5 ? 'text-amber-600' : 'text-slate-800'
                        }`}
                      >
                        {qty}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600">
                      R$ {cost.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                      R$ {price.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600">
                      R$ {subCost.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                      R$ {subPrice.toFixed(2)}
                    </td>
                  </tr>
                )
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Nenhum produto corresponde aos filtros informados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totalizadores Fixos no Rodapé */}
        <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white font-semibold">
              Totalizadores
            </Badge>
            <span className="text-slate-600">
              {filteredProducts.length} produtos | <b>{totals.totalItens}</b> unidades em estoque
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 mr-1.5">Total Custo:</span>
              <span className="font-bold text-slate-900">
                R$ {totals.totalCustoEstoque.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 mr-1.5">Total Venda:</span>
              <span className="font-bold text-emerald-700 text-sm">
                R$ {totals.totalVendaEstoque.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-400">
            {totals.itensZerados > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-3 w-3" /> {totals.itensZerados} produto(s) com estoque
                zerado
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadExcel}
              className="text-xs gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>Exportar Excel (.xlsx)</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
