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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, X, Loader2 } from 'lucide-react'
import heic2any from 'heic2any'
import { Customer, EquipmentType } from '@/types'
import { getCustomers } from '@/services/customers'
import { createEquipmentWithPhotos } from '@/services/equipment'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'

interface NewEquipmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
  defaultCustomerId?: string
}

export function NewEquipmentModal({
  open,
  onOpenChange,
  onCreated,
  defaultCustomerId,
}: NewEquipmentModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [processingPhotos, setProcessingPhotos] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    customer: '',
    name: '',
    type: 'other' as EquipmentType,
    brand: '',
    model: '',
    serial_number: '',
    notes: '',
  })

  useEffect(() => {
    if (open) {
      getCustomers()
        .then(setCustomers)
        .catch(() => {})
      setFormData((p) => ({ ...p, customer: defaultCustomerId || p.customer }))
      setErrors({})
    } else {
      setPhotos([])
      setErrors({})
    }
  }, [open, defaultCustomerId])

  const convertHeicToJpeg = async (file: File): Promise<Blob> => {
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85,
        multiple: false,
      })

      return Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob
    } catch (err) {
      console.error('Erro ao converter imagem HEIC:', err)
      throw new Error('Falha na conversão de imagem HEIC')
    }
  }

  const handlePhotosChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
    const maxSize = 10 * 1024 * 1024
    setProcessingPhotos(true)

    const processedFiles: File[] = []

    for (const rawFile of Array.from(files)) {
      const isHeicByName = /\.(heic|heif)$/i.test(rawFile.name)
      const isHeicByType = rawFile.type === 'image/heic' || rawFile.type === 'image/heif'
      const isValidType = validTypes.includes(rawFile.type) || isHeicByName || isHeicByType

      if (!isValidType) {
        toast({
          title: 'Formato inválido',
          description: `${rawFile.name}: apenas PNG, JPG, WebP ou HEIC.`,
          variant: 'destructive',
        })
        continue
      }

      let uploadFile: File = rawFile

      if (isHeicByName || isHeicByType) {
        try {
          const convertedBlob = await convertHeicToJpeg(rawFile)
          const newFileName = rawFile.name.replace(/\.(heic|heif)$/i, '') + '.jpg'
          uploadFile = new File([convertedBlob], newFileName, { type: 'image/jpeg' })
        } catch {
          toast({
            title: 'Erro ao converter foto',
            description: `Não foi possível processar ${rawFile.name}. Tente novamente.`,
            variant: 'destructive',
          })
          continue
        }
      }

      if (uploadFile.size > maxSize) {
        toast({
          title: 'Arquivo muito grande',
          description: `${uploadFile.name}: máximo 10MB.`,
          variant: 'destructive',
        })
        continue
      }

      processedFiles.push(uploadFile)
    }

    if (processedFiles.length > 0) {
      setPhotos((prev) => [...prev, ...processedFiles])
      if (errors.photos) {
        setErrors((prev) => {
          const next = { ...prev }
          delete next.photos
          return next
        })
      }
    }

    setProcessingPhotos(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const removePhoto = (idx: number) => setPhotos((prev) => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    if (!formData.customer) {
      setErrors((prev) => ({ ...prev, customer: 'Selecione um cliente' }))
      return
    }
    if (!formData.name) {
      setErrors((prev) => ({ ...prev, name: 'Informe o nome do equipamento' }))
      return
    }
    if (photos.length === 0) {
      setErrors((prev) => ({ ...prev, photos: 'Adicione pelo menos 1 foto do equipamento' }))
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('customer', formData.customer)
      fd.append('name', formData.name)
      fd.append('type', formData.type)
      fd.append('brand', formData.brand)
      fd.append('model', formData.model)
      fd.append('serial_number', formData.serial_number)
      fd.append('notes', formData.notes)
      photos.forEach((p) => fd.append('photos', p))
      await createEquipmentWithPhotos(fd)
      toast({ title: 'Equipamento cadastrado com sucesso!' })
      setFormData({
        customer: '',
        name: '',
        type: 'other',
        brand: '',
        model: '',
        serial_number: '',
        notes: '',
      })
      setPhotos([])
      onOpenChange(false)
      if (onCreated) onCreated()
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao cadastrar equipamento', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-[540px] h-full sm:h-auto max-h-screen sm:max-h-[90vh] rounded-none sm:rounded-lg overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">Novo Equipamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Cliente *</Label>
            <Select
              value={formData.customer}
              onValueChange={(v) => setFormData({ ...formData, customer: v })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => {
                  const displayName = c.razao_social || c.nome_fantasia || c.name || 'Cliente'
                  return (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {displayName}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {errors.customer && <p className="text-[11px] text-red-500">{errors.customer}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Nome *</Label>
              <Input
                placeholder="Ex: Notebook Dell"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-9 text-xs"
              />
              {errors.name && <p className="text-[11px] text-red-500">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(v: EquipmentType) => setFormData({ ...formData, type: v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    'notebook',
                    'desktop',
                    'monitor',
                    'printer',
                    'smartphone',
                    'tablet',
                    'network',
                    'other',
                  ].map((t) => (
                    <SelectItem key={t} value={t} className="text-xs capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Marca</Label>
              <Input
                placeholder="Ex: Dell"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Modelo</Label>
              <Input
                placeholder="Ex: Inspiron 15"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Nº de Série</Label>
              <Input
                placeholder="Ex: ABC123"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Fotos de Identificação *</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotosChange}
              className="hidden"
              id="equip-photo-upload"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={processingPhotos}
              className="text-xs gap-1.5"
            >
              {processingPhotos ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando...
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" /> Adicionar Fotos
                </>
              )}
            </Button>
            {errors.photos && <p className="text-[11px] text-red-500">{errors.photos}</p>}
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {photos.map((p, i) => (
                  <div
                    key={i}
                    className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200"
                  >
                    <img
                      src={URL.createObjectURL(p)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-0.5 right-0.5 bg-white/80 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Observações</Label>
            <Textarea
              placeholder="Notas sobre o equipamento..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="text-xs"
            />
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
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
