import { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowLeft, Check, Eraser, RotateCcw, Smartphone, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface PublicSignaturePadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerName?: string
  numeroOrcamento?: string
  onConfirmSignature: (dataUrl: string) => void
}

export function PublicSignaturePadModal({
  open,
  onOpenChange,
  customerName,
  numeroOrcamento,
  onConfirmSignature,
}: PublicSignaturePadModalProps) {
  const [hasContent, setHasContent] = useState(false)
  const [orientationLocked, setOrientationLocked] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // Screen Orientation API: tenta travar em retrato (portrait)
  const requestPortraitOrientation = useCallback(async () => {
    try {
      const orientation = (screen.orientation ||
        (screen as any).mozOrientation ||
        (screen as any).msOrientation) as any
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('portrait')
        setOrientationLocked(true)
      }
    } catch {
      setOrientationLocked(false)
    }
  }, [])

  const unlockOrientation = useCallback(async () => {
    try {
      const orientation = (screen.orientation ||
        (screen as any).mozOrientation ||
        (screen as any).msOrientation) as any
      if (orientation && typeof orientation.unlock === 'function') {
        orientation.unlock()
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (open) {
      void requestPortraitOrientation()
    } else {
      void unlockOrientation()
    }
    return () => {
      void unlockOrientation()
    }
  }, [open, requestPortraitOrientation, unlockOrientation])

  // Inicializa canvas com fundo transparente (NÃO desenha fillRect branco)
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.8
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
    ctx.clearRect(0, 0, rect.width, rect.height)
    ctxRef.current = ctx
  }, [])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      initCanvas()
    }, 60)
    window.addEventListener('resize', initCanvas)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', initCanvas)
    }
  }, [open, initCanvas])

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
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    setHasContent(false)
  }

  const handleConfirm = () => {
    if (!canvasRef.current || !hasContent) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    onConfirmSignature(dataUrl)
    void unlockOrientation()
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white select-none overflow-hidden touch-none">
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              void unlockOrientation()
              onOpenChange(false)
            }}
            className="h-10 w-10 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5 font-mono">
              {numeroOrcamento ? `Proposta ${numeroOrcamento}` : 'Assinatura do Cliente'}
            </h1>
            <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
              {customerName || 'Cliente JUCA'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Fundo Transparente</span>
        </div>
      </header>

      <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 shrink-0">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-indigo-400 shrink-0" />
          <span>
            {orientationLocked
              ? 'Tela travada em modo retrato para assinar com o dedo.'
              : 'Assine com o dedo ou caneta stylus no espaço abaixo.'}
          </span>
        </div>
      </div>

      <main className="flex-1 flex flex-col p-4 bg-slate-950 justify-center">
        <Card className="flex-1 w-full flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-slate-300">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700 shrink-0">
            <span>Assinatura Digital de Aprovação</span>
            <span className="text-[11px] text-slate-400">Assine com o dedo</span>
          </div>

          <div className="flex-1 relative w-full h-full bg-white touch-none">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
            />

            {!hasContent && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-25">
                <p className="text-xl font-bold text-slate-400 tracking-wide font-sans">
                  Assine aqui com o dedo
                </p>
                <div className="w-64 h-0.5 bg-slate-400 mt-8 rounded-full" />
              </div>
            )}
          </div>
        </Card>
      </main>

      <footer className="p-4 bg-slate-900 border-t border-slate-800 flex gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="outline"
          onClick={handleClear}
          disabled={!hasContent}
          className="h-14 px-5 text-sm font-bold border-slate-700 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex-1 gap-2"
        >
          <Eraser className="h-5 w-5 text-rose-400" />
          Limpar
        </Button>

        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!hasContent}
          className="h-14 px-6 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 rounded-xl flex-2 gap-2"
        >
          <Check className="h-5 w-5" />
          Confirmar Assinatura
        </Button>
      </footer>
    </div>
  )
}
