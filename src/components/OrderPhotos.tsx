import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, Loader2 } from 'lucide-react'
import heic2any from 'heic2any'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ServiceAttachment } from '@/types'
import { getAttachments, createAttachment, deleteAttachment } from '@/services/service_attachments'
import { getFileUrl } from '@/lib/pocketbase/files'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { offlinePb } from '@/lib/offline-pb'

interface OrderPhotosProps {
  orderId: string
  canEdit: boolean
}

export function OrderPhotos({ orderId, canEdit }: OrderPhotosProps) {
  const [attachments, setAttachments] = useState<ServiceAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const data = await getAttachments(orderId)
      setAttachments(data)
    } catch {
      /* */
    }
  }

  useEffect(() => {
    loadData()
  }, [orderId])

  useRealtime('service_attachments', (e) => {
    if (e.record['service_order'] === orderId) loadData()
  })

  const convertHeicToJpeg = async (file: File): Promise<File> => {
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85,
      })

      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob
      const newFileName = file.name.replace(/\.(heic|heif)$/i, '') + '.jpg'
      return new File([blob], newFileName, { type: 'image/jpeg' })
    } catch (err) {
      console.error('Erro ao converter imagem HEIC:', err)
      throw new Error('Falha na conversão de imagem HEIC')
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
    const maxSize = 10 * 1024 * 1024
    setUploading(true)
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

      let fileToUpload = rawFile
      if (isHeicByName || isHeicByType) {
        try {
          fileToUpload = await convertHeicToJpeg(rawFile)
        } catch {
          toast({
            title: 'Erro ao converter foto',
            description: `Não foi possível processar ${rawFile.name}. Tente novamente.`,
            variant: 'destructive',
          })
          continue
        }
      }

      if (fileToUpload.size > maxSize) {
        toast({
          title: 'Arquivo muito grande',
          description: `${fileToUpload.name}: máximo 10MB.`,
          variant: 'destructive',
        })
        continue
      }

      try {
        if (navigator.onLine) {
          await createAttachment(orderId, fileToUpload)
          toast({ title: 'Foto enviada!' })
        } else {
          // Offline: armazena a foto como base64 na fila para sincronização.
          const dataUrl = await fileToDataUrl(fileToUpload)
          await offlinePb.create('service_attachments', {
            service_order: orderId,
            file: dataUrl,
          })
          toast({
            title: 'Foto salva localmente. Será sincronizada quando houver conexão.',
          })
        }
      } catch {
        toast({ title: 'Erro ao enviar foto', variant: 'destructive' })
      }
    }
    setUploading(false)
    loadData()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  const handleDelete = async (id: string) => {
    try {
      const res = await offlinePb.delete('service_attachments', id)
      if (res.queued) {
        toast({ title: 'Foto removida localmente. Será sincronizada quando houver conexão.' })
      } else {
        toast({ title: 'Foto removida' })
      }
      loadData()
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' })
    }
  }

  const handleCaptionBlur = async (id: string, caption: string) => {
    try {
      const res = await offlinePb.update('service_attachments', id, { caption })
      if (res.queued) {
        toast({ title: 'Legenda salva localmente. Será sincronizada quando houver conexão.' })
      }
    } catch {
      /* */
    }
  }

  /** Converte um File em data URL base64 (para armazenar offline). */
  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold text-slate-900">Fotos do Atendimento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              className="hidden"
              id="photo-upload"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs gap-1.5"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando...
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" /> Adicionar Fotos
                </>
              )}
            </Button>
          </div>
        )}
        {attachments.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Nenhuma foto registrada.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {attachments.map((a, idx) => (
              <div
                key={a.id}
                className="group relative rounded-lg overflow-hidden border border-slate-200"
              >
                <img
                  src={getFileUrl(a.id, a.file, 'service_attachments', '300x300')}
                  alt={a.caption || 'Foto'}
                  className="w-full h-32 object-cover cursor-pointer"
                  onClick={() => setPreviewIdx(idx)}
                />
                <div className="p-2">
                  <Input
                    placeholder="Legenda..."
                    defaultValue={a.caption || ''}
                    onBlur={(e) => handleCaptionBlur(a.id, e.target.value)}
                    disabled={!canEdit}
                    className="h-7 text-[11px] border-slate-200"
                  />
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(a.id)}
                    className="absolute top-1 right-1 h-6 w-6 bg-white/80 hover:bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {previewIdx !== null && attachments[previewIdx] && (
          <Dialog open={previewIdx !== null} onOpenChange={() => setPreviewIdx(null)}>
            <DialogContent className="sm:max-w-3xl p-2">
              <img
                src={getFileUrl(
                  attachments[previewIdx].id,
                  attachments[previewIdx].file,
                  'service_attachments',
                )}
                alt={attachments[previewIdx].caption || 'Foto'}
                className="w-full h-auto rounded-lg"
              />
              {attachments[previewIdx].caption && (
                <p className="text-xs text-slate-600 text-center py-2">
                  {attachments[previewIdx].caption}
                </p>
              )}
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  )
}
