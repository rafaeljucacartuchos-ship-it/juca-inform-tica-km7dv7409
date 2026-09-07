import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Eraser, RotateCcw, Smartphone, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getServiceOrder, uploadSignature } from '@/services/service_orders'
import { ServiceOrder } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { offlinePb } from '@/lib/offline-pb'

export default function OrdemAssinatura() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [order, setOrder] = useState<ServiceOrder | null>(null)
  const [signerRole, setSignerRole] = useState<'customer' | 'technician'>('customer')
  const [saving, setSaving] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [orientationLocked, setOrientationLocked] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // Tenta travar a tela em modo retrato (portrait) ao entrar, e destrava ao sair
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
      // Ignora silenciosamente se o navegador não permitir (ex: iOS Safari ou sem permissão de tela cheia)
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
    if (!id) return
    getServiceOrder(id)
      .then(setOrder)
      .catch(() => {
        toast({ title: 'Erro ao carregar O.S.', variant: 'destructive' })
      })

    void requestPortraitOrientation()

    return () => {
      void unlockOrientation()
    }
  }, [id, requestPortraitOrientation, unlockOrientation])

  // Inicializa o canvas responsivo com DPR
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
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
    ctxRef.current = ctx
  }, [])

  useEffect(() => {
    initCanvas()
    const handleResize = () => {
      // Reposiciona mantendo a proporção
      initCanvas()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [initCanvas])

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

  const handleConfirm = async () => {
    if (!order || !canvasRef.current || !hasContent) return
    setSaving(true)
    const dataUrl = canvasRef.current.toDataURL('image/png')
    const field = signerRole === 'customer' ? 'customer_signature' : 'technician_signature'

    try {
      if (navigator.onLine) {
        await uploadSignature(order.id, field, dataUrl)
        toast({
          title: 'Assinatura salva com sucesso!',
          description:
            signerRole === 'customer'
              ? 'Assinatura do cliente registrada.'
              : 'Assinatura do técnico registrada.',
        })
      } else {
        await offlinePb.update('service_orders', order.id, { [field]: dataUrl })
        toast({
          title: 'Assinatura salva localmente (offline)',
          description: 'Será sincronizada quando houver conexão.',
        })
      }
      // Destrava a orientação e retorna suavemente para os detalhes da OS
      await unlockOrientation()
      navigate(`/ordens/${order.id}`)
    } catch {
      toast({ title: 'Erro ao salvar assinatura', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-white select-none overflow-hidden touch-none">
      {/* Top Bar otimizada para o técnico */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              void unlockOrientation()
              navigate(`/ordens/${id}`)
            }}
            className="h-10 w-10 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5 font-mono">
              OS #{order?.number || '...'}
            </h1>
            <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
              {order?.expand?.customer?.nome_fantasia ||
                order?.expand?.customer?.razao_social ||
                order?.expand?.customer?.name ||
                'Cliente'}
            </p>
          </div>
        </div>

        {/* Alternador de quem está assinando (Cliente x Técnico) */}
        <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => {
              setSignerRole('customer')
              handleClear()
            }}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              signerRole === 'customer'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Cliente
          </button>
          <button
            type="button"
            onClick={() => {
              setSignerRole('technician')
              handleClear()
            }}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              signerRole === 'technician'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Técnico
          </button>
        </div>
      </header>

      {/* Dica / instrução visual móvel */}
      <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/60 flex items-center justify-between text-xs text-slate-300 shrink-0">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-indigo-400 shrink-0" />
          <span>
            {orientationLocked
              ? 'Tela em modo vertical (retrato) para assinar com o dedo.'
              : 'Gire o aparelho para vertical para assinar com facilidade.'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Válido legalmente</span>
        </div>
      </div>

      {/* Área de assinatura gigante fullscreen */}
      <main className="flex-1 flex flex-col p-4 bg-slate-900 justify-center">
        <Card className="flex-1 w-full flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-slate-300">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700 shrink-0">
            <span>
              {signerRole === 'customer'
                ? `Assinatura de: ${order?.expand?.customer?.name || 'Cliente'}`
                : 'Assinatura do Técnico Responsável'}
            </span>
            <span className="text-[11px] text-slate-400">Assine no espaço abaixo</span>
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

      {/* Barra inferior fixa ao alcance do polegar */}
      <footer className="p-4 bg-slate-950 border-t border-slate-800 flex gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="outline"
          onClick={handleClear}
          disabled={!hasContent || saving}
          className="h-14 px-5 text-sm font-bold border-slate-700 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex-1 gap-2"
        >
          <Eraser className="h-5 w-5 text-rose-400" />
          Limpar
        </Button>

        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!hasContent || saving}
          className="h-14 px-6 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 rounded-xl flex-2 gap-2"
        >
          {saving ? <RotateCcw className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
          {saving ? 'Gravando...' : 'Confirmar Assinatura'}
        </Button>
      </footer>
    </div>
  )
}
