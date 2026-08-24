import { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  FileText,
  Download,
  Upload,
  Layers,
  CircleDollarSign,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Product } from '@/types'
import { getProducts, deleteProduct } from '@/services/products'
import { NewProductModal } from '@/components/NewProductModal'
import { ImportProductsModal } from '@/components/ImportProductsModal'
import { StockReportModal } from '@/components/StockReportModal'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { getFileUrl } from '@/lib/pocketbase/files'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { exportProductsToExcel } from '@/lib/product-excel'

export default function Produtos() {
  const [products, setProducts] = useState<Product[]>([])
  const [allProductsForReport, setAllProductsForReport] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteProductItem, setDeleteProductItem] = useState<Product | null>(null)
  const [exportingProducts, setExportingProducts] = useState(false)
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const data = await getProducts(search)
      setProducts(data)
      if (!search.trim()) {
        setAllProductsForReport(data)
      }
    } catch {
      /* ignored */
    }
  }

  const loadAllProducts = async () => {
    try {
      const all = await getProducts('')
      setAllProductsForReport(all)
    } catch {
      /* ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [search])

  useEffect(() => {
    loadAllProducts()
  }, [])

  useRealtime('products', () => {
    loadData()
    loadAllProducts()
  })

  // Métricas rápidas de topo
  const metrics = useMemo(() => {
    const list = allProductsForReport.length > 0 ? allProductsForReport : products
    let totalQty = 0
    let totalStockValue = 0
    let lowStock = 0

    list.forEach((p) => {
      const qty = p.stock_quantity ?? 0
      const price = p.price || 0
      totalQty += qty
      totalStockValue += qty * price
      if (qty <= 0) lowStock++
    })

    return {
      count: list.length,
      totalQty,
      totalStockValue,
      lowStock,
    }
  }, [products, allProductsForReport])

  const handleDelete = async () => {
    if (!deleteProductItem) return
    try {
      await deleteProduct(deleteProductItem.id)
      toast({ title: 'Produto excluído com sucesso!' })
      setDeleteProductItem(null)
      loadData()
      loadAllProducts()
    } catch {
      toast({ title: 'Erro ao excluir produto', variant: 'destructive' })
    }
  }

  const handleOpenReport = async () => {
    try {
      const all = await getProducts('')
      setAllProductsForReport(all)
      setReportModalOpen(true)
    } catch {
      setReportModalOpen(true)
    }
  }

  const handleExportAll = async () => {
    setExportingProducts(true)
    try {
      const all = await getProducts('')
      exportProductsToExcel(all)
      toast({
        title: 'Planilha exportada com sucesso!',
        description: `${all.length} produtos exportados para Excel com sucesso.`,
      })
    } catch {
      toast({
        title: 'Erro ao exportar produtos',
        variant: 'destructive',
      })
    } finally {
      setExportingProducts(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho com Grupo dos 3 Botões Principais + Novo Produto */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Produtos e Estoque</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Gerencie o catálogo de peças, conferência de estoque, importação e exportação de
            planilhas.
          </p>
        </div>

        {/* Grupo de Ações em Destaque no Topo */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão 1: Relatório de Produtos */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenReport}
            className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 gap-1.5 h-9 text-xs font-medium shadow-2xs"
            title="Abrir relatório detalhado e conferência física de estoque"
          >
            <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>Relatório de Produtos</span>
          </Button>

          {/* Botão 2: Importar Planilha */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportModalOpen(true)}
            className="bg-white border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 gap-1.5 h-9 text-xs font-medium shadow-2xs"
            title="Importar e atualizar produtos em lote via arquivo .xlsx ou .csv"
          >
            <Upload className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Importar Planilha</span>
          </Button>

          {/* Botão 3: Exportar Planilha */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            disabled={exportingProducts}
            className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 gap-1.5 h-9 text-xs font-medium shadow-2xs"
            title="Exportar todos os produtos para planilha Excel (.xlsx)"
          >
            <Download className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{exportingProducts ? 'Exportando...' : 'Exportar Planilha'}</span>
          </Button>

          {/* Botão de Criação Manual */}
          <Button
            onClick={() => setNewModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-9 text-xs font-medium shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Produto</span>
          </Button>
        </div>
      </div>

      {/* Mini-Cards de Estatísticas Rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
            <Package className="h-3.5 w-3.5 text-indigo-500" />
            <span>Total de Itens</span>
          </div>
          <div className="text-lg font-bold text-slate-900">{metrics.count}</div>
          <div className="text-[11px] text-slate-500">{metrics.totalQty} unidades cadastradas</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
            <CircleDollarSign className="h-3.5 w-3.5 text-emerald-500" />
            <span>Valor em Estoque</span>
          </div>
          <div className="text-lg font-bold text-emerald-700 font-mono">
            R$ {metrics.totalStockValue.toFixed(2)}
          </div>
          <div className="text-[11px] text-emerald-600">Preço de venda total</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
            <Layers className="h-3.5 w-3.5 text-blue-500" />
            <span>Estoque Disponível</span>
          </div>
          <div className="text-lg font-bold text-blue-700">{metrics.totalQty}</div>
          <div className="text-[11px] text-blue-600">Unidades físicas</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span>Itens Zerados</span>
          </div>
          <div className="text-lg font-bold text-amber-700">{metrics.lowStock}</div>
          <div className="text-[11px] text-amber-600">Necessitam reposição</div>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Foto</th>
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Custo</th>
                  <th className="py-3 px-4">Preço</th>
                  <th className="py-3 px-4">Estoque</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      {p.photo_file ? (
                        <img
                          src={getFileUrl(p.id, p.photo_file, 'products', '100x100')}
                          alt={p.name}
                          className="h-10 w-10 rounded-md object-cover border border-slate-200"
                        />
                      ) : p.photo ? (
                        <img
                          src={p.photo}
                          alt={p.name}
                          className="h-10 w-10 rounded-md object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center">
                          <Package className="h-4 w-4 text-slate-400" />
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{p.sku || '-'}</td>
                    <td className="py-3 px-4 text-slate-600">{p.category || '-'}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      R$ {(p.cost || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      R$ {(p.price || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.stock_quantity ?? 0}</td>
                    <td className="py-3 px-4">
                      <Badge variant={p.active ? 'default' : 'secondary'} className="text-[10px]">
                        {p.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-amber-600 gap-1"
                          onClick={() => setEditProduct(p)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-600"
                          onClick={() => setDeleteProductItem(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <NewProductModal
        open={newModalOpen}
        onOpenChange={setNewModalOpen}
        onCreated={() => {
          loadData()
          loadAllProducts()
        }}
      />
      <NewProductModal
        open={!!editProduct}
        onOpenChange={(o) => !o && setEditProduct(null)}
        onCreated={() => {
          loadData()
          loadAllProducts()
        }}
        editProduct={editProduct}
      />
      <ImportProductsModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={() => {
          loadData()
          loadAllProducts()
        }}
      />
      <StockReportModal
        open={reportModalOpen}
        onOpenChange={setReportModalOpen}
        products={allProductsForReport.length > 0 ? allProductsForReport : products}
      />
      <ConfirmDeleteDialog
        open={!!deleteProductItem}
        onOpenChange={(o) => !o && setDeleteProductItem(null)}
        onConfirm={handleDelete}
        title="Excluir Produto"
        description={`Tem certeza que deseja excluir ${deleteProductItem?.name}? Esta ação não pode ser desfeita.`}
      />
    </div>
  )
}
