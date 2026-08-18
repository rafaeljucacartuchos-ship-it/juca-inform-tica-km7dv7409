import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScanLine, X, Camera, RefreshCw, AlertTriangle, ArrowRight, Keyboard } from 'lucide-react'

// Tipos mínimos para a Barcode Detection API (ainda não no lib.dom padrão).
interface BarcodeDetectorResult {
  rawValue?: string
  stringValue?: string
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource | ImageBitmap) => Promise<BarcodeDetectorResult[]>
  getSupportedFormats?: () => Promise<string[]>
}
interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}
declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor
  }
}

interface BarcodeScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDetected: (code: string) => void
}

/**
 * Leitor de código de barras / QR Code usando a Barcode Detection API
 * nativa do navegador. Se o navegador não suportar BarcodeDetector,
 * exibe uma mensagem de fallback.
 */
export function BarcodeScanner({ open, onOpenChange, onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [isRetrying, setIsRetrying] = useState(false)

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setScanning(false)
  }, [])

  const isProcessingRef = useRef(false)

  const detectLoop = useCallback(() => {
    if (!detectorRef.current || !videoRef.current || isProcessingRef.current) return
    const video = videoRef.current
    if (video.readyState >= 2) {
      detectorRef.current
        .detect(video)
        .then((codes: BarcodeDetectorResult[]) => {
          if (isProcessingRef.current) return
          if (codes && codes.length > 0) {
            const value = codes[0].rawValue || codes[0].stringValue || ''
            if (value) {
              isProcessingRef.current = true
              stop()
              onDetected(value)
              onOpenChange(false)
              return
            }
          }
        })
        .catch(() => {})
    }
    if (!isProcessingRef.current) {
      rafRef.current = requestAnimationFrame(detectLoop)
    }
  }, [onDetected, onOpenChange, stop])

  const start = useCallback(async () => {
    setError('')
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(
        'Acesso à câmera não suportado neste navegador ou ambiente (requer HTTPS ou localhost).',
      )
      return
    }
    try {
      let stream: MediaStream
      try {
        // Tenta câmera traseira em dispositivos móveis
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      } catch {
        // Fallback para qualquer câmera disponível
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setScanning(true)
      rafRef.current = requestAnimationFrame(detectLoop)
    } catch (err: unknown) {
      const errName = err instanceof Error ? err.name : ''
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setError(
          'Permissão de acesso à câmera foi negada. Permita o acesso à câmera nas configurações do seu navegador.',
        )
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setError('Nenhuma câmera foi encontrada no dispositivo.')
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setError('A câmera já está sendo usada por outro aplicativo.')
      } else {
        setError(
          'Não foi possível acessar a câmera do dispositivo. Verifique as permissões de vídeo ou se a conexão é segura (HTTPS).',
        )
      }
    }
  }, [detectLoop])

  useEffect(() => {
    if (!open) return
    const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window
    setSupported(hasDetector)

    if (hasDetector) {
      const Ctor = window.BarcodeDetector
      if (Ctor) {
        try {
          const formatsPromise = Ctor.getSupportedFormats
            ? Ctor.getSupportedFormats()
            : Promise.resolve([])
          Promise.resolve(formatsPromise)
            .then((f: string[]) => {
              if (!window.BarcodeDetector) return
              try {
                detectorRef.current = new window.BarcodeDetector({
                  formats: f && f.length ? f : undefined,
                })
              } catch {
                detectorRef.current = new Ctor()
              }
              start()
            })
            .catch(() => {
              detectorRef.current = new Ctor()
              start()
            })
        } catch {
          detectorRef.current = new Ctor()
          start()
        }
      } else {
        start()
      }
    } else {
      // Mesmo se BarcodeDetector não existir, chama start() para tentar exibir o vídeo com mensagem informativa
      start()
    }

    return () => {
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Reseta estados quando o modal é reaberto ou fechado
  useEffect(() => {
    if (open) {
      isProcessingRef.current = false
      setManualCode('')
      setIsRetrying(false)
    } else {
      isProcessingRef.current = false
    }
  }, [open])

  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = manualCode.trim()
    if (!trimmed || isProcessingRef.current) return
    isProcessingRef.current = true
    stop()
    onDetected(trimmed)
    onOpenChange(false)
  }

  const handleRetryCamera = async () => {
    setIsRetrying(true)
    stop()
    await start()
    setIsRetrying(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) stop()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-indigo-600" />
            Escanear Código
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!supported ? (
            <div className="py-4 text-center space-y-3 bg-amber-50/50 border border-amber-200/60 rounded-xl p-4">
              <Camera className="h-9 w-9 text-amber-500 mx-auto" />
              <p className="text-xs text-amber-800 font-medium">
                Navegador sem suporte nativo a leitura de código de barras
              </p>
              <p className="text-[11px] text-slate-600">
                A detecção automática requer navegadores modernos (como Google Chrome no
                Android/Desktop). Você ainda pode digitar o código abaixo.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Área do vídeo / Câmera */}
              <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video shadow-inner border border-slate-800 flex items-center justify-center">
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

                {!error && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3/4 h-1/3 border-2 border-indigo-400/90 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.3)] bg-indigo-500/5 relative">
                      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-indigo-500 -mt-0.5 -ml-0.5" />
                      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-indigo-500 -mt-0.5 -mr-0.5" />
                      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-indigo-500 -mb-0.5 -ml-0.5" />
                      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-indigo-500 -mb-0.5 -mr-0.5" />
                    </div>
                  </div>
                )}

                {scanning && !error && (
                  <span className="absolute top-2.5 right-2.5 text-[10px] font-medium bg-emerald-500/90 text-white px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Câmera ativa
                  </span>
                )}
              </div>

              {/* Mensagem de Erro com Botão de Reabertura/Tentar Novamente */}
              {error ? (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2.5 text-rose-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                    <div className="text-xs leading-relaxed font-medium">{error}</div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-rose-100">
                    <span className="text-[11px] text-rose-600">
                      Permita a câmera ou tente novamente.
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleRetryCamera}
                      disabled={isRetrying}
                      className="h-8 text-xs font-semibold bg-white border-rose-200 hover:bg-rose-100 hover:text-rose-900 text-rose-700 shadow-sm"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 mr-1.5 ${isRetrying ? 'animate-spin' : ''}`}
                      />
                      Tentar Novamente
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 text-center">
                  Aponte a câmera para o código de barras ou QR Code.
                </p>
              )}
            </div>
          )}

          {/* Seção de Entrada Manual */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Keyboard className="h-3.5 w-3.5 text-indigo-600" />
              <span>Digitar código manualmente</span>
            </div>

            <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Informe o SKU ou Código de Barras..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="h-9 text-xs"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!manualCode.trim()}
                className="h-9 px-3 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs"
              >
                Confirmar
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </form>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                stop()
                onOpenChange(false)
              }}
              className="text-xs h-8"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
