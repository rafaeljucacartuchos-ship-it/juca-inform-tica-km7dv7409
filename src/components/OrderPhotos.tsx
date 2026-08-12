import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ServiceAttachment } from '@/types'
import {
  getAttachments,
  createAttachment,
  updateAttachment,
  deleteAttachment,
} from '@/services/service_attachments'
import { getFileUrl } from '@/lib/pocketbase/files'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const validTypes = ['image/png', 'image/jpeg', 'image/webp']
    const maxSize = 10 * 1024 * 1024
    setUploading(true)
    for (const file of Array.from(files)) {
      if (!validTypes.includes(file.type)) {
        toast({
          title: 'Formato invalido',
          description: `${file.name}: apenas PNG, JPG e WebP.`,
          variant: 'destructive',
        })
        continue
      }
      if (file.size > maxSize) {
        toast({
          title: 'Arquivo muito grande',
          description: `${file.name}: maximo 10MB.`,
          variant: 'destructive',
        })
        continue
      }
      try {
        await createAttachment(orderId, file)
        toast({ title: 'Foto enviada!' })
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
      await deleteAttachment(id)
      toast({ title: 'Foto removida' })
      loadData()
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' })
    }
  }

  const handleCaptionBlur = async (id: string, caption: string) => {
    try {
      await updateAttachment(id, caption)
    } catch {
      /* */
    }
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
              accept="image/png,image/jpeg,image/webp"
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
              <Upload className="h-3.5 w-3.5" /> {uploading ? 'Enviando...' : 'Adicionar Fotos'}
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
