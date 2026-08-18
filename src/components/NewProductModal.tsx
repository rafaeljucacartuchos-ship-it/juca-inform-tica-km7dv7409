import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { createProduct, updateProduct } from '@/services/products'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { Product } from '@/types'

interface NewProductModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
  editProduct?: Product | null
}

export function NewProductModal({
  open,
  onOpenChange,
  onCreated,
  editProduct,
}: NewProductModalProps) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const isEdit = !!editProduct

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    category: '',
    cost: '',
    price: '',
    photo: '',
    stock_quantity: '0',
    active: true,
  })

  useEffect(() => {
    if (open) {
      setErrors({})
      if (editProduct) {
        setFormData({
          name: editProduct.name || '',
          description: editProduct.description || '',
          sku: editProduct.sku || '',
          category: editProduct.category || '',
          cost: editProduct.cost != null ? String(editProduct.cost) : '',
          price: editProduct.price != null ? String(editProduct.price) : '',
          photo: editProduct.photo || '',
          stock_quantity:
            editProduct.stock_quantity != null ? String(editProduct.stock_quantity) : '0',
          active: editProduct.active ?? true,
        })
      } else {
        setFormData({
          name: '',
          description: '',
          sku: '',
          category: '',
          cost: '',
          price: '',
          photo: '',
          stock_quantity: '0',
          active: true,
        })
      }
    }
  }, [open, editProduct])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    if (!formData.name.trim()) {
      setErrors({ name: 'Nome é obrigatório' })
      return
    }
    setLoading(true)
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        sku: formData.sku,
        category: formData.category,
        cost: Number(formData.cost) || 0,
        price: Number(formData.price) || 0,
        photo: formData.photo,
        stock_quantity: Number(formData.stock_quantity) || 0,
        active: formData.active,
      }
      if (isEdit && editProduct) {
        await updateProduct(editProduct.id, payload)
        toast({ title: 'Produto atualizado!', description: formData.name })
      } else {
        await createProduct(payload)
        toast({ title: 'Produto cadastrado!', description: formData.name })
      }
      onOpenChange(false)
      if (onCreated) onCreated()
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao salvar produto', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {isEdit ? 'Editar Produto' : 'Novo Produto'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Nome *</Label>
            <Input
              placeholder="Ex: HD SSD 480GB"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-9 text-xs"
            />
            {errors.name && <p className="text-[11px] text-red-500">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">SKU</Label>
              <Input
                placeholder="Ex: SSD-480"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="h-9 text-xs font-mono"
              />
              {errors.sku && <p className="text-[11px] text-red-500">{errors.sku}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
              <Input
                placeholder="Ex: Armazenamento"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Custo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                className="h-9 text-xs font-mono"
              />
              {errors.cost && <p className="text-[11px] text-red-500">{errors.cost}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Estoque</Label>
              <Input
                type="number"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Preço (R$)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="h-9 text-xs font-mono"
            />
            {errors.price && <p className="text-[11px] text-red-500">{errors.price}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Foto (URL)</Label>
            <Input
              type="url"
              placeholder="https://..."
              value={formData.photo}
              onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Descrição</Label>
            <Textarea
              placeholder="Detalhes do produto..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="text-xs"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Switch
              checked={formData.active}
              onCheckedChange={(v) => setFormData({ ...formData, active: v })}
            />
            <Label className="text-xs font-semibold text-slate-700">Produto ativo</Label>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
