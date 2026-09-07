import { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  Wrench,
  FileText,
  Download,
  Upload,
  Layers,
  CircleDollarSign,
  AlertCircle,
  PowerOff,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Product } from '@/types'
import { getProducts, deleteProduct, toggleProductActive } from '@/services/products'
import { NewProductModal } from '@/components/NewProductModal'
import { ImportProductsModal } from '@/components/ImportProductsModal'
import { StockReportModal } from '@/components/StockReportModal'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
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
  const [typeFilter, setTypeFilter] = useState<'all' | 'produto' | 'servico'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'zero_stock'>(
    'all',
  )
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

    const inactiveCount = list.filter((p) => p.active === false).length

    return {
      count: list.length,
      totalQty,
      totalStockValue,
      lowStock,
      inactiveCount,
    }
  }, [products, allProductsForReport])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (typeFilter !== 'all') {
        const pType = p.type || 'produto'
        if (pType !== typeFilter) return false
      }
      if (statusFilter === 'active') return p.active !== false
      if (statusFilter === 'inactive') return p.active === false
      if (statusFilter === 'zero_stock') return (p.stock_quantity ?? 0) <= 0
      return true
    })
  }, [products, statusFilter, typeFilter])

  const handleToggleActive = async (p: Product) => {
    const nextState = !p.active
    try {
      await toggleProductActive(p.id, !!p.active)
      toast({
        title: nextState ? 'Produto ativado!' : 'Produto inativado!',
        description: `O status de "${p.name}" foi alterado com sucesso.`,
      })
      loadData()
      loadAllProducts()
    } catch {
      toast({
        title: 'Erro ao alterar status',
        description: 'Não foi possível atualizar o status do produto.',
        variant: 'destructive',
      })
    }
  }

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
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1 font-bold">
            <Package className="h-3.5 w-3.5 text-indigo-500" />
            <span>Total de Itens</span>
          </div>
          <div className="text-xl font-bold text-slate-900">{metrics.count}</div>
          <div className="text-[11px] text-slate-500 font-medium">
            {metrics.totalQty} unidades cadastradas
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1 font-bold">
            <CircleDollarSign className="h-3.5 w-3.5 text-emerald-500" />
            <span>Valor em Estoque</span>
          </div>
          <div className="text-xl font-bold text-emerald-700 font-mono">
            R$ {metrics.totalStockValue.toFixed(2)}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">Preço de venda total</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1 font-bold">
            <Layers className="h-3.5 w-3.5 text-blue-500" />
            <span>Estoque Disponível</span>
          </div>
          <div className="text-xl font-bold text-blue-700">{metrics.totalQty}</div>
          <div className="text-[11px] text-blue-600 font-medium">Unidades físicas</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1 font-bold">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span>Itens Zerados</span>
          </div>
          <div className="text-xl font-bold text-amber-700">{metrics.lowStock}</div>
          <div className="text-[11px] text-amber-600 font-medium">Necessitam reposição</div>
        </div>
      </div>

      {/* Abas de Tipo (Todos | Produtos | Serviços) + Barra de Busca e Filtros de Status */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <Button
            type="button"
            size="sm"
            variant={typeFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setTypeFilter('all')}
            className={`h-8 text-xs font-bold ${
              typeFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-700'
            }`}
          >
            Todos ({products.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={typeFilter === 'produto' ? 'default' : 'outline'}
            onClick={() => setTypeFilter('produto')}
            className={`h-8 text-xs font-bold gap-1.5 ${
              typeFilter === 'produto'
                ? 'bg-indigo-600 text-white'
                : 'text-indigo-700 bg-indigo-50/50 border-indigo-200'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            Produtos ({products.filter((p) => (p.type || 'produto') === 'produto').length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={typeFilter === 'servico' ? 'default' : 'outline'}
            onClick={() => setTypeFilter('servico')}
            className={`h-8 text-xs font-bold gap-1.5 ${
              typeFilter === 'servico'
                ? 'bg-emerald-600 text-white'
                : 'text-emerald-700 bg-emerald-50/50 border-emerald-200'
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            Serviços ({products.filter((p) => p.type === 'servico').length})
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome, SKU ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <Button
              type="button"
              size="sm"
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('all')}
              className={`h-8 text-xs font-bold ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'text-slate-700 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              Todos
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === 'active' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('active')}
              className={`h-8 text-xs font-bold ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'text-emerald-700 bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Ativos
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === 'inactive' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('inactive')}
              className={`h-8 text-xs font-bold ${
                statusFilter === 'inactive'
                  ? 'bg-slate-700 text-white hover:bg-slate-800'
                  : 'text-slate-600 bg-slate-100 border-slate-300 hover:bg-slate-200'
              }`}
            >
              Inativos ({metrics.inactiveCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === 'zero_stock' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('zero_stock')}
              className={`h-8 text-xs font-bold ${
                statusFilter === 'zero_stock'
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
              }`}
            >
              Sem Estoque ({metrics.lowStock})
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Código (SKU)</th>
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">Quantidade (Estoque)</th>
                  <th className="py-3 px-4">Preço de Venda</th>
                  <th className="py-3 px-4">Código de Barras</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const isZeroStock = (p.stock_quantity ?? 0) <= 0
                  const isInactive = p.active === false
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isInactive ? 'bg-slate-50/50 opacity-75' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            p.type === 'servico'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {p.type === 'servico' ? 'Serviço' : 'Produto'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {p.sku || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{p.name}</span>
                          {p.fabricante && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              {p.fabricante}
                            </span>
                          )}
                        </div>
                        {isZeroStock && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 mt-0.5">
                            <AlertCircle className="h-2.5 w-2.5" /> Sem estoque
                          </span>
                        )}
                        {isInactive && (
                          <span className="inline-flex items-center text-[10px] font-medium text-slate-500 mt-0.5">
                            (Inativo)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded ${
                            isZeroStock
                              ? 'bg-rose-100 text-rose-700'
                              : (p.stock_quantity ?? 0) < 5
                                ? 'bg-amber-100 text-amber-800'
                                : 'text-slate-800'
                          }`}
                        >
                          {p.stock_quantity ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        R$ {(p.price || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 text-[11px] font-medium">
                        {p.barcode || p.codigo_barras || '-'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão de Editar */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px] font-semibold text-slate-700 bg-white border-slate-200 hover:bg-slate-100 hover:text-slate-900 gap-1 shadow-2xs"
                            onClick={() => setEditProduct(p)}
                            title="Editar informações do produto"
                          >
                            <Pencil className="h-3 w-3 text-indigo-600" />
                            <span>Editar</span>
                          </Button>

                          {/* Botão de Inativar / Ativar */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={`h-7 px-2 text-[11px] font-semibold gap-1 transition-colors border shadow-2xs ${
                              p.active !== false
                                ? 'border-amber-200 bg-amber-50/60 text-amber-800 hover:bg-amber-100 hover:text-amber-900'
                                : 'border-emerald-200 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900'
                            }`}
                            onClick={() => handleToggleActive(p)}
                            title={
                              p.active !== false
                                ? 'Inativar produto (pausar vendas/uso)'
                                : 'Ativar produto'
                            }
                          >
                            {p.active !== false ? (
                              <>
                                <PowerOff className="h-3 w-3 text-amber-600" />
                                <span>Inativar</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span>Ativar</span>
                              </>
                            )}
                          </Button>

                          {/* Botão de Excluir */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 border-rose-200 bg-white text-rose-600 hover:text-rose-700 hover:bg-rose-50 shadow-2xs"
                            onClick={() => setDeleteProductItem(p)}
                            title="Excluir produto definitivamente"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 font-medium">
                      Nenhum produto encontrado com os filtros selecionados.
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
