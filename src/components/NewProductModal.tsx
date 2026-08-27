import { useState, useEffect, useRef } from 'react'
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
import { createProduct, updateProduct, getProduct } from '@/services/products'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { Product } from '@/types'
import { getFileUrl } from '@/lib/pocketbase/files'
import pb from '@/lib/pocketbase/client'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { Camera, Image as ImageIcon, ScanLine, Search, X, Loader2 } from 'lucide-react'

interface NewProductModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
  editProduct?: Product | null
}

interface PexelsPhoto {
  id: number
  src: { medium: string; large: string; original: string }
  alt: string
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
    barcode: '',
    category: '',
    cost: '',
    price: '',
    photo: '',
    stock_quantity: '0',
    active: true,
  })

  // Foto enviada como arquivo (câmera/galeria)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')

  // Busca de fotos no Pexels
  const [pexelsQuery, setPexelsQuery] = useState('')
  const [pexelsResults, setPexelsResults] = useState<PexelsPhoto[]>([])
  const [pexelsLoading, setPexelsLoading] = useState(false)

  // Leitor de código de barras
  const [scannerOpen, setScannerOpen] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Resolve a URL de exibição da foto (arquivo > URL externa).
  const displayPhoto = photoPreview || formData.photo || ''

  useEffect(() => {
    if (open) {
      setErrors({})
      setPexelsQuery('')
      setPexelsResults([])
      setPhotoFile(null)
      setPhotoPreview('')
      if (editProduct) {
        setFormData({
          name: editProduct.name || '',
          description: editProduct.description || '',
          sku: editProduct.sku || '',
          barcode: editProduct.barcode || editProduct.codigo_barras || '',
          category: editProduct.category || '',
          cost: editProduct.cost != null ? String(editProduct.cost) : '',
          price: editProduct.price != null ? String(editProduct.price) : '',
          photo: editProduct.photo || '',
          stock_quantity:
            editProduct.stock_quantity != null ? String(editProduct.stock_quantity) : '0',
          active: editProduct.active ?? true,
        })
        // Pré-visualiza foto em arquivo, se houver
        if (editProduct.photo_file) {
          try {
            setPhotoPreview(
              getFileUrl(editProduct.id, editProduct.photo_file, 'products', '200x200'),
            )
          } catch {
            setPhotoPreview('')
          }
        }
      } else {
        setFormData({
          name: '',
          description: '',
          sku: '',
          barcode: '',
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

  // Busca no Pexels (debounce simples)
  useEffect(() => {
    if (!pexelsQuery.trim()) {
      setPexelsResults([])
      return
    }
    let cancelled = false
    setPexelsLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${pb.baseUrl}/backend/v1/pexels/search?query=${encodeURIComponent(pexelsQuery.trim())}`,
          { headers: { Authorization: pb.authStore.token || '' } },
        )
        if (!res.ok) throw new Error('pexels')
        const data = await res.json()
        if (!cancelled) setPexelsResults(data.photos || [])
      } catch {
        if (!cancelled) setPexelsResults([])
      } finally {
        if (!cancelled) setPexelsLoading(false)
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pexelsQuery])

  const handleSelectFile = (file: File | undefined) => {
    if (!file) return
    setPhotoFile(file)
    setFormData((d) => ({ ...d, photo: '' })) // limpa URL externa
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSelectPexels = (photo: PexelsPhoto) => {
    setPhotoFile(null)
    setPhotoPreview('')
    setFormData((d) => ({ ...d, photo: photo.src.original || photo.src.large }))
  }

  const clearPhoto = () => {
    setPhotoFile(null)
    setPhotoPreview('')
    setFormData((d) => ({ ...d, photo: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    if (!formData.name.trim()) {
      setErrors({ name: 'Nome é obrigatório' })
      return
    }
    setLoading(true)
    try {
      if (photoFile) {
        // Envio multipart com arquivo de foto
        const form = new FormData()
        form.append('name', formData.name)
        form.append('description', formData.description)
        form.append('sku', formData.sku)
        form.append('barcode', formData.barcode)
        form.append('codigo_barras', formData.barcode)
        form.append('category', formData.category)
        form.append('cost', String(Number(formData.cost) || 0))
        form.append('price', String(Number(formData.price) || 0))
        form.append('photo', '')
        form.append('stock_quantity', String(Number(formData.stock_quantity) || 0))
        form.append('active', String(formData.active))
        form.append('photo_file', photoFile, photoFile.name)
        if (isEdit && editProduct) {
          await pb.collection('products').update(editProduct.id, form)
          toast({ title: 'Produto atualizado!', description: formData.name })
        } else {
          await pb.collection('products').create(form)
          toast({ title: 'Produto cadastrado!', description: formData.name })
        }
      } else {
        const payload = {
          name: formData.name,
          description: formData.description,
          sku: formData.sku,
          barcode: formData.barcode,
          codigo_barras: formData.barcode,
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
      <DialogContent className="w-full max-w-full sm:max-w-[460px] h-full sm:h-auto max-h-screen sm:max-h-[90vh] rounded-none sm:rounded-lg overflow-y-auto p-4 sm:p-6">
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
              <Label className="text-xs font-semibold text-slate-700">SKU / Código</Label>
              <Input
                placeholder="Ex: SSD-480"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="h-9 text-xs font-mono"
              />
              {errors.sku && <p className="text-[11px] text-red-500">{errors.sku}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Código de Barras</Label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Ex: 7891234567890"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2 shrink-0"
                  onClick={() => setScannerOpen(true)}
                  title="Escanear código de barras"
                >
                  <ScanLine className="h-4 w-4 text-indigo-600" />
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
              <Input
                placeholder="Ex: Armazenamento"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="h-9 text-xs"
              />
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
              <Label className="text-xs font-semibold text-slate-700">Preço Venda (R$)</Label>
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
          </div>

          {/* Foto do produto: captura (câmera/galeria) + busca Pexels */}
          <div className="space-y-2 rounded-lg border border-slate-200 p-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700">Foto do Produto</Label>
              {displayPhoto && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-red-500"
                  onClick={clearPhoto}
                >
                  <X className="h-3 w-3 mr-1" /> Remover
                </Button>
              )}
            </div>

            {displayPhoto ? (
              <div className="relative">
                <img
                  src={displayPhoto}
                  alt="Foto do produto"
                  className="h-24 w-24 rounded-lg object-cover border border-slate-200"
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 text-indigo-600" /> Câmera
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <ImageIcon className="h-4 w-4 text-emerald-600" /> Galeria
                </Button>
              </div>
            )}

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleSelectFile(e.target.files?.[0])}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleSelectFile(e.target.files?.[0])}
            />

            {/* Busca automática no Pexels */}
            <div className="pt-1 space-y-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Buscar foto automaticamente..."
                  value={pexelsQuery}
                  onChange={(e) => setPexelsQuery(e.target.value)}
                  className="h-8 text-xs pl-8 pr-7"
                />
                {pexelsLoading && (
                  <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-slate-400" />
                )}
              </div>
              {pexelsResults.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {pexelsResults.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      className="relative aspect-square rounded-md overflow-hidden border border-slate-200 hover:ring-2 hover:ring-indigo-400 transition"
                      onClick={() => handleSelectPexels(photo)}
                    >
                      <img
                        src={photo.src.medium}
                        alt={photo.alt}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
              {pexelsQuery.trim() && !pexelsLoading && pexelsResults.length === 0 && (
                <p className="text-[11px] text-slate-400">Nenhuma foto encontrada.</p>
              )}
            </div>
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

      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={(code) => setFormData((d) => ({ ...d, barcode: code }))}
      />
    </Dialog>
  )
}
