import { useState, useRef, useEffect } from 'react'
import { Camera, Upload, Trash2, Maximize2, X, FileText, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { OrcamentoAnexo, OrcamentoAnexoTipo } from '@/types'
import { createOrcamentoAnexo, deleteOrcamentoAnexo } from '@/services/orcamentos'
import { getFileUrl } from '@/lib/pocketbase/files'
import { useToast } from '@/hooks/use-toast'

interface OrcamentoPhotosProps {
  orcamentoId: string
  anexos: OrcamentoAnexo[]
  canEdit: boolean
  onUpdated: () => void
}

const MAX_PHOTOS = 5

export function OrcamentoPhotos({ orcamentoId, anexos, canEdit, onUpdated }: OrcamentoPhotosProps) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<OrcamentoAnexo | null>(null)
  const [photoType, setPhotoType] = useState<OrcamentoAnexoTipo>('foto_equipamento')
  const [caption, setCaption] = useState('')
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const photoAnexos = anexos.filter(
    (a) => a.tipo === 'foto_equipamento' || a.tipo === 'foto_defeito',
  )
  const count = photoAnexos.length
  const isFull = count >= MAX_PHOTOS

  const handleFilePicked = (file: File) => {
    setSelectedFile(file)
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setFilePreviewUrl(url)
    } else {
      setFilePreviewUrl(null)
    }
    setUploadModalOpen(true)
  }

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFilePicked(file)
    e.target.value = ''
  }

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFilePicked(file)
    e.target.value = ''
  }

  const handleConfirmUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    try {
      await createOrcamentoAnexo(orcamentoId, selectedFile, photoType, caption)
      toast({ title: 'Foto adicionada ao orçamento com sucesso!' })
      setUploadModalOpen(false)
      setSelectedFile(null)
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
      setFilePreviewUrl(null)
      setCaption('')
      onUpdated()
    } catch {
      toast({ title: 'Erro ao enviar foto', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta foto do orçamento?')) return
    try {
      await deleteOrcamentoAnexo(id)
      toast({ title: 'Foto excluída com sucesso!' })
      if (selectedPhoto?.id === id) setSelectedPhoto(null)
      onUpdated()
    } catch {
      toast({ title: 'Erro ao excluir foto', variant: 'destructive' })
    }
  }

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    }
  }, [filePreviewUrl])

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-bold text-slate-900">Fotos do Orçamento</CardTitle>
          <Badge
            variant="outline"
            className={`text-xs ${
              isFull
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}
          >
            {count}/{MAX_PHOTOS} fotos
          </Badge>
        </div>

        {canEdit && !isFull && (
          <div className="flex items-center gap-1.5">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCameraChange}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
              className="h-8 text-xs gap-1.5"
              title="Tirar foto com a câmera"
            >
              <Camera className="h-3.5 w-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Câmera</span>
            </Button>

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleGalleryChange}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => galleryInputRef.current?.click()}
              className="h-8 text-xs gap-1.5"
              title="Escolher foto ou documento da galeria"
            >
              <Upload className="h-3.5 w-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Galeria</span>
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {photoAnexos.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
            Nenhuma foto adicionada ao orçamento ainda. (Máx: 5 fotos)
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {photoAnexos.map((anexo) => {
              const url = getFileUrl(anexo.id, anexo.caminho_arquivo, 'orcamento_anexos')
              return (
                <div
                  key={anexo.id}
                  className="group relative rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex flex-col"
                >
                  <div className="aspect-square relative overflow-hidden bg-slate-900/5">
                    {anexo.caminho_arquivo.toLowerCase().endsWith('.pdf') ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-slate-500">
                        <FileText className="h-8 w-8 mb-1 text-indigo-500" />
                        <span className="text-[10px] truncate max-w-full">PDF</span>
                      </div>
                    ) : (
                      <img
                        src={url}
                        alt={anexo.legenda || 'Foto do orçamento'}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    )}

                    {/* Botões de Ação sobre a imagem */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 rounded-full bg-white/90 hover:bg-white text-slate-800"
                        onClick={() => setSelectedPhoto(anexo)}
                        title="Ver em tela cheia"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </Button>
                      {canEdit && (
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="h-7 w-7 rounded-full"
                          onClick={() => handleDelete(anexo.id)}
                          title="Excluir foto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="p-1.5 text-[11px] bg-white border-t border-slate-100 flex items-center justify-between">
                    <span className="truncate text-slate-700 font-medium max-w-[100px]">
                      {anexo.legenda || (anexo.tipo === 'foto_defeito' ? 'Defeito' : 'Equipamento')}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-4 border-slate-200 text-slate-500 uppercase"
                    >
                      {anexo.tipo === 'foto_defeito' ? 'Defeito' : 'Equip.'}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal de confirmação e legenda antes de salvar */}
        <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-slate-900">
                Adicionar Foto ao Orçamento
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              {filePreviewUrl && (
                <div className="aspect-video w-full rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-200">
                  <img
                    src={filePreviewUrl}
                    alt="Preview"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Tipo de Registro *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={photoType === 'foto_equipamento' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs justify-start h-9"
                    onClick={() => setPhotoType('foto_equipamento')}
                  >
                    Foto do Equipamento
                  </Button>
                  <Button
                    type="button"
                    variant={photoType === 'foto_defeito' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs justify-start h-9"
                    onClick={() => setPhotoType('foto_defeito')}
                  >
                    Foto do Defeito / Peça
                  </Button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Legenda / Observação (Opcional)
                </label>
                <Input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Ex: Trinca na tela, detalhe do conector, etc."
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadModalOpen(false)}
                  disabled={uploading}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmUpload}
                  disabled={uploading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      Enviando...
                    </>
                  ) : (
                    'Confirmar e Salvar'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de visualização em tela cheia */}
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-4xl p-0 bg-slate-950 text-white overflow-hidden border-slate-800">
            <div className="relative flex flex-col h-[85vh]">
              <div className="flex items-center justify-between p-3 bg-slate-900 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">
                    {selectedPhoto?.legenda || 'Foto do Orçamento'}
                  </span>
                  <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300">
                    {selectedPhoto?.tipo}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-white"
                  onClick={() => setSelectedPhoto(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 flex items-center justify-center p-4 bg-black overflow-hidden">
                {selectedPhoto && (
                  <img
                    src={getFileUrl(
                      selectedPhoto.id,
                      selectedPhoto.caminho_arquivo,
                      'orcamento_anexos',
                    )}
                    alt={selectedPhoto.legenda || 'Foto do orçamento'}
                    className="max-h-full max-w-full object-contain"
                  />
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
