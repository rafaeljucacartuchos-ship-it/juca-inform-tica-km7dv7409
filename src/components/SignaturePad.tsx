import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eraser, Check, X, Pen, Type } from 'lucide-react'

interface SignaturePadProps {
  onConfirm: (blob: Blob) => void
  onCancel?: () => void
}

export function SignaturePad({ onConfirm, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [mode, setMode] = useState<'draw' | 'type'>('draw')
  const [typedName, setTypedName] = useState('')

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
    setTypedName('')
  }

  const handleConfirm = () => {
    if (mode === 'type') {
      if (!typedName.trim()) return
      const canvas = document.createElement('canvas')
      canvas.width = 600
      canvas.height = 200
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.font = 'italic 42px cursive, serif'
      ctx.fillStyle = '#1e293b'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(typedName.trim(), canvas.width / 2, canvas.height / 2)
      canvas.toBlob((blob) => {
        if (blob) onConfirm(blob)
      }, 'image/png')
    } else {
      const canvas = canvasRef.current
      if (!canvas || !hasContent) return
      canvas.toBlob((blob) => {
        if (blob) onConfirm(blob)
      }, 'image/png')
    }
  }

  const canConfirm = mode === 'type' ? typedName.trim().length > 0 : hasContent

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'draw' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('draw')}
          className="text-xs"
        >
          <Pen className="h-3.5 w-3.5 mr-1" /> Desenhar
        </Button>
        <Button
          type="button"
          variant={mode === 'type' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('type')}
          className="text-xs"
        >
          <Type className="h-3.5 w-3.5 mr-1" /> Digitar Nome
        </Button>
      </div>
      {mode === 'draw' ? (
        <canvas
          ref={canvasRef}
          className="w-full h-40 border-2 border-dashed border-slate-300 rounded-lg bg-white touch-none cursor-crosshair"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
      ) : (
        <div className="w-full h-40 border-2 border-dashed border-slate-300 rounded-lg bg-white flex items-center justify-center p-4">
          <Input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Digite seu nome completo"
            className="text-center border-0 border-b border-slate-300 rounded-none shadow-none focus-visible:ring-0 focus-visible:border-indigo-500"
            style={{ font: 'italic 24px cursive, serif' }}
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={!canConfirm}
        >
          <Eraser className="h-3.5 w-3.5 mr-1" /> Limpar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleConfirm}
          disabled={!canConfirm}
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
