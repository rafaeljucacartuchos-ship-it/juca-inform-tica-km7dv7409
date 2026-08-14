import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Eraser, Check, X } from 'lucide-react'

interface SignaturePadProps {
  // Retorna uma string base64 (data URL) — ex.: "data:image/png;base64,...".
  // O uso de canvas.toDataURL() em vez de canvas.toBlob() garante
  // compatibilidade com TODOS os navegadores móveis (Samsung Internet,
  // Chrome antigo, Safari iOS), que em alguns casos perdem o MIME do Blob
  // gerado por toBlob(). A string base64 pode ser usada diretamente como
  // src de <img> para preview ou enviada como JSON ao backend.
  onConfirm: (dataUrl: string) => void
  onCancel?: () => void
}

export function SignaturePad({ onConfirm, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1e293b'
    ctxRef.current = ctx
  }, [])

  const getPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDrawing = (e: React.PointerEvent) => {
    e.preventDefault()
    const ctx = ctxRef.current
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setIsDrawing(true)
  }

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    const ctx = ctxRef.current
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasContent(true)
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    const ctx = ctxRef.current
    if (ctx) ctx.closePath()
    setIsDrawing(false)
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasContent(false)
  }

  const handleConfirm = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasContent) return
    // toDataURL retorna uma string base64 ("data:image/png;base64,...")
    // de forma síncrona e compatível com todos os navegadores — sem
    // depender de Blob/File/FormData, que perdem o MIME em alguns celulares.
    const dataUrl = canvas.toDataURL('image/png')
    onConfirm(dataUrl)
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        className="w-full h-40 border-2 border-dashed border-slate-300 rounded-lg bg-white touch-none cursor-crosshair"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={!hasContent}
        >
          <Eraser className="h-3.5 w-3.5 mr-1" /> Limpar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleConfirm}
          disabled={!hasContent}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Check className="h-3.5 w-3.5 mr-1" /> Confirmar
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancelar
          </Button>
        )}
      </div>
    </div>
  )
}
