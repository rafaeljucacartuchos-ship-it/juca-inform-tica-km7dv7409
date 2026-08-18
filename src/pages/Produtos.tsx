import { useState, useEffect } from 'react'
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Product } from '@/types'
import { getProducts, deleteProduct } from '@/services/products'
import { NewProductModal } from '@/components/NewProductModal'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function Produtos() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteProductItem, setDeleteProductItem] = useState<Product | null>(null)
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const data = await getProducts(search)
      setProducts(data)
    } catch {
      /* ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [search])
  useRealtime('products', loadData)

  const handleDelete = async () => {
    if (!deleteProductItem) return
    try {
      await deleteProduct(deleteProductItem.id)
      toast({ title: 'Produto excluído com sucesso!' })
      setDeleteProductItem(null)
      loadData()
    } catch {
      toast({ title: 'Erro ao excluir produto', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Produtos e Peças</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Gerencie o catálogo de peças, acessórios e estoque.
          </p>
        </div>
        <Button
          onClick={() => setNewModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-9 text-xs sm:text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Produto</span>
        </Button>
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
                      {p.photo ? (
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

      <NewProductModal open={newModalOpen} onOpenChange={setNewModalOpen} onCreated={loadData} />
      <NewProductModal
        open={!!editProduct}
        onOpenChange={(o) => !o && setEditProduct(null)}
        onCreated={loadData}
        editProduct={editProduct}
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
