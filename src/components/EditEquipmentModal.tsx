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
import {
  Upload,
  X,
  Loader2,
  Maximize2,
  Trash2,
  ImageIcon,
  Edit,
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import heic2any from 'heic2any'
import { Equipment, EquipmentType } from '@/types'
import { updateEquipment, getEquipmentItem } from '@/services/equipment'
import { getFileUrl } from '@/lib/pocketbase/files'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface EditEquipmentModalProps {
  equipment: Equipment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (updated?: Equipment) => void
  defaultTab?: 'edit' | 'photos'
  canEdit?: boolean
}

export function EditEquipmentModal({
  equipment,
  open,
  onOpenChange,
  onSaved,
  defaultTab = 'edit',
  canEdit = true,
}: EditEquipmentModalProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'edit' | 'photos'>(defaultTab)

  // Dados do formulário
  const [currentEquipment, setCurrentEquipment] = useState<Equipment | null>(equipment)
  const [formData, setFormData] = useState({
    name: '',
    type: 'other' as EquipmentType,
    brand: '',
    model: '',
    serial_number: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fotos existentes e novas fotos a adicionar
  const [existingPhotos, setExistingPhotos] = useState<string[]>([])
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([])
  const [newPhotos, setNewPhotos] = useState<File[]>([])
  const [processingPhotos, setProcessingPhotos] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Lightbox / Visualizador ampliado
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  useEffect(() => {
    if (open && equipment) {
      setCurrentEquipment(equipment)
      setFormData({
        name: equipment.name || '',
        type: (equipment.type as EquipmentType) || 'other',
        brand: equipment.brand || '',
        model: equipment.model || '',
        serial_number: equipment.serial_number || '',
        notes: equipment.notes || '',
      })
      setExistingPhotos(equipment.photos || [])
      setPhotosToDelete([])
      setNewPhotos([])
      setErrors({})
      setActiveTab(defaultTab)

      // Recarrega dados atualizados do equipamento para garantir lista fresca de fotos
      if (equipment.id) {
        getEquipmentItem(equipment.id)
          .then((fresh) => {
            setCurrentEquipment(fresh)
            setExistingPhotos(fresh.photos || [])
          })
          .catch(() => {})
      }
    } else {
      setLightboxIndex(null)
      setNewPhotos([])
      setPhotosToDelete([])
    }
  }, [open, equipment, defaultTab])

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
      setNewPhotos((prev) => [...prev, ...processedFiles])
    }

    setProcessingPhotos(false)
    e.target.value = ''
  }

  const markPhotoForDeletion = (filename: string) => {
    setPhotosToDelete((prev) => [...prev, filename])
    setExistingPhotos((prev) => prev.filter((p) => p !== filename))
  }

  const removeNewPhoto = (idx: number) => {
    setNewPhotos((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!currentEquipment?.id) return

    if (!formData.name.trim()) {
      setErrors({ name: 'Informe o nome do equipamento' })
      setActiveTab('edit')
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const fd = new FormData()
      fd.append('name', formData.name.trim())
      fd.append('type', formData.type)
      fd.append('brand', formData.brand.trim())
      fd.append('model', formData.model.trim())
      fd.append('serial_number', formData.serial_number.trim())
      fd.append('notes', formData.notes.trim())

      // Novas fotos a adicionar usando 'photos+' no PocketBase
      newPhotos.forEach((photo) => {
        fd.append('photos+', photo)
      })

      // Fotos a remover usando 'photos-' no PocketBase
      photosToDelete.forEach((filename) => {
        fd.append('photos-', filename)
      })

      const updated = await updateEquipment(currentEquipment.id, fd)
      setCurrentEquipment(updated)
      setExistingPhotos(updated.photos || [])
      setPhotosToDelete([])
      setNewPhotos([])

      toast({
        title: 'Equipamento atualizado com sucesso!',
        description: `${updated.name || 'Equipamento'} foi salvo.`,
      })

      if (onSaved) onSaved(updated)
      onOpenChange(false)
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({
        title: 'Erro ao salvar equipamento',
        description: 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!currentEquipment) return null

  // Monta lista unificada de visualização (fotos salvas + novas selecionadas)
  interface GalleryItem {
    id: string
    url: string
    isNew: boolean
    rawFile?: File
    filename?: string
    index: number
  }

  const galleryItems: GalleryItem[] = [
    ...existingPhotos.map((photo, i) => ({
      id: `existing-${photo}-${i}`,
      url: getFileUrl(currentEquipment.id, photo, 'equipment', '1200x900'),
      isNew: false,
      filename: photo,
      index: i,
    })),
    ...newPhotos.map((file, i) => ({
      id: `new-${file.name}-${i}`,
      url: URL.createObjectURL(file),
      isNew: true,
      rawFile: file,
      index: existingPhotos.length + i,
    })),
  ]

  const activeLightboxItem = lightboxIndex !== null ? galleryItems[lightboxIndex] : null

  const handlePrevPhoto = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (lightboxIndex === null || galleryItems.length <= 1) return
    setLightboxIndex((prev) => ((prev ?? 0) > 0 ? (prev ?? 0) - 1 : galleryItems.length - 1))
  }

  const handleNextPhoto = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (lightboxIndex === null || galleryItems.length <= 1) return
    setLightboxIndex((prev) => ((prev ?? 0) < galleryItems.length - 1 ? (prev ?? 0) + 1 : 0))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-full sm:max-w-[620px] h-[100dvh] sm:h-auto max-h-[var(--app-visible-height,100dvh)] sm:max-h-[92vh] rounded-none sm:rounded-lg p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 shrink-0 border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="space-y-0.5">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Cadastro do Equipamento</span>
              </DialogTitle>
              <p className="text-xs text-slate-500">
                {currentEquipment.expand?.customer?.name
                  ? `Cliente: ${currentEquipment.expand.customer.name}`
                  : 'Equipamento vinculado'}
              </p>
            </div>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'edit' | 'photos')}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <div className="px-4 sm:px-6 pt-3 pb-1 border-b border-slate-100 bg-slate-50/50">
              <TabsList className="grid grid-cols-2 w-full h-9">
                <TabsTrigger
                  value="edit"
                  className="text-xs font-semibold gap-1.5 data-[state=active]:bg-white"
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>Editar Dados</span>
                </TabsTrigger>
                <TabsTrigger
                  value="photos"
                  className="text-xs font-semibold gap-1.5 data-[state=active]:bg-white"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Abrir Imagens ({existingPhotos.length + newPhotos.length})</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ABA 1: EDITAR DADOS */}
            <TabsContent
              value="edit"
              className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 m-0"
            >
              <form onSubmit={handleSave} id="edit-equip-form" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Nome do Equipamento *
                    </Label>
                    <Input
                      placeholder="Ex: Notebook Dell Inspiron"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={!canEdit}
                      className="h-9 text-xs"
                    />
                    {errors.name && <p className="text-[11px] text-red-500">{errors.name}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Tipo</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v: EquipmentType) => setFormData({ ...formData, type: v })}
                      disabled={!canEdit}
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
                      disabled={!canEdit}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Modelo</Label>
                    <Input
                      placeholder="Ex: Inspiron 15"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      disabled={!canEdit}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Nº de Série</Label>
                    <Input
                      placeholder="Ex: ABC123XYZ"
                      value={formData.serial_number}
                      onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                      disabled={!canEdit}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Observações</Label>
                  <Textarea
                    placeholder="Notas técnicas, configurações, detalhes físicos..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    disabled={!canEdit}
                    rows={3}
                    className="text-xs"
                  />
                </div>

                {/* Resumo rápido de fotos na aba de edição com atalho para a aba de imagens */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-indigo-600" />
                      Fotos do Equipamento ({galleryItems.length})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab('photos')}
                      className="h-7 text-xs text-indigo-600 hover:text-indigo-800 p-0 font-semibold"
                    >
                      Abrir galeria completa →
                    </Button>
                  </div>
                  {galleryItems.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      Nenhuma foto cadastrada para este equipamento.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {galleryItems.slice(0, 6).map((item, idx) => (
                        <div
                          key={item.id}
                          className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90"
                          onClick={() => setLightboxIndex(idx)}
                        >
                          <img src={item.url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {galleryItems.length > 6 && (
                        <div
                          onClick={() => setActiveTab('photos')}
                          className="w-14 h-14 rounded-lg border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 cursor-pointer"
                        >
                          +{galleryItems.length - 6}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </form>
            </TabsContent>

            {/* ABA 2: ABRIR AS IMAGENS / GALERIA */}
            <TabsContent
              value="photos"
              className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 m-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    Galeria de Imagens do Equipamento
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Clique em qualquer foto para ampliar em tela cheia com alta resolução.
                  </p>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handlePhotosChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={processingPhotos}
                      className="h-8 text-xs gap-1.5"
                      title="Tirar foto com a câmera"
                    >
                      <Camera className="h-3.5 w-3.5 text-indigo-600" />
                      <span className="hidden sm:inline">Câmera</span>
                    </Button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotosChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={processingPhotos}
                      className="h-8 text-xs gap-1.5 bg-indigo-50/50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                      title="Adicionar novas fotos"
                    >
                      {processingPhotos ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5 text-indigo-600" /> Adicionar Fotos
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {galleryItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  <ImageIcon className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="text-xs">Nenhuma imagem vinculada a este equipamento.</p>
                  {canEdit && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs mt-2"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" /> Fazer upload agora
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {galleryItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="group relative rounded-lg border border-slate-200 overflow-hidden bg-slate-100 aspect-square flex flex-col cursor-pointer shadow-xs hover:shadow-md transition-all"
                      onClick={() => setLightboxIndex(idx)}
                    >
                      <img
                        src={item.url}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />

                      {/* Badge indicando se é nova (não salva ainda) */}
                      {item.isNew && (
                        <div className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                          Nova
                        </div>
                      )}

                      {/* Overlay com ações */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8 rounded-full bg-white/95 hover:bg-white text-slate-800 shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setLightboxIndex(idx)
                          }}
                          title="Ampliar imagem"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </Button>
                        {canEdit && (
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="h-8 w-8 rounded-full shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (item.isNew) {
                                const newIdx = idx - existingPhotos.length
                                removeNewPhoto(newIdx)
                              } else if (item.filename) {
                                markPhotoForDeletion(item.filename)
                              }
                            }}
                            title="Remover foto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(newPhotos.length > 0 || photosToDelete.length > 0) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between">
                  <span>
                    Alterações de imagens pendentes (
                    {newPhotos.length > 0 ? `${newPhotos.length} adicionada(s)` : ''}
                    {newPhotos.length > 0 && photosToDelete.length > 0 ? ', ' : ''}
                    {photosToDelete.length > 0 ? `${photosToDelete.length} removida(s)` : ''}
                    ). Clique em Salvar para persistir.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    disabled={loading}
                    onClick={() => handleSave()}
                    className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold ml-2 shrink-0"
                  >
                    <span>{loading ? 'Salvando...' : 'Salvar Fotos'}</span>
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 shrink-0 bg-slate-50/50 flex flex-row items-center justify-between gap-2">
            <div className="text-[11px] text-slate-500 truncate">
              {currentEquipment.brand ? `${currentEquipment.brand} ` : ''}
              {currentEquipment.model ? `${currentEquipment.model}` : ''}
              {currentEquipment.serial_number ? ` • S/N: ${currentEquipment.serial_number}` : ''}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  disabled={loading}
                  onClick={() => handleSave()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                >
                  <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LIGHTBOX / VISUALIZADOR DE IMAGENS EM TELA CHEIA */}
      <Dialog open={lightboxIndex !== null} onOpenChange={() => setLightboxIndex(null)}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-[90vw] p-0 bg-slate-950 text-white overflow-hidden border-slate-800">
          <div className="relative flex flex-col h-[85vh] max-h-[850px]">
            {/* Header do Lightbox */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {currentEquipment.name}
                  {currentEquipment.brand ? ` • ${currentEquipment.brand}` : ''}
                </span>
                {activeLightboxItem && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    ({(lightboxIndex ?? 0) + 1} de {galleryItems.length})
                  </span>
                )}
                {activeLightboxItem?.isNew && (
                  <span className="text-[10px] bg-amber-500/80 text-white px-1.5 py-0.5 rounded font-bold">
                    Nova Foto
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {activeLightboxItem && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-slate-300 hover:text-white gap-1"
                    onClick={() => window.open(activeLightboxItem.url, '_blank')}
                    title="Abrir imagem original em nova aba"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Original</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-white"
                  onClick={() => setLightboxIndex(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Imagem Central */}
            <div className="flex-1 relative flex items-center justify-center p-4 bg-black overflow-hidden select-none">
              {activeLightboxItem && (
                <img
                  src={activeLightboxItem.url}
                  alt={`Equipamento foto ${(lightboxIndex ?? 0) + 1}`}
                  className="max-h-full max-w-full object-contain transition-all"
                />
              )}

              {/* Botões de navegação anterior / próximo */}
              {galleryItems.length > 1 && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={handlePrevPhoto}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 shadow-lg"
                    title="Foto anterior"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={handleNextPhoto}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 shadow-lg"
                    title="Próxima foto"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>

            {/* Miniaturas de rodapé no Lightbox */}
            {galleryItems.length > 1 && (
              <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex items-center justify-center gap-2 overflow-x-auto">
                {galleryItems.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className={`relative w-12 h-12 rounded overflow-hidden shrink-0 border-2 transition-all ${
                      lightboxIndex === idx
                        ? 'border-indigo-500 scale-105'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
