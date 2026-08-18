import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScanLine, X, Camera } from 'lucide-react'

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

  const detectLoop = useCallback(() => {
    if (!detectorRef.current || !videoRef.current) return
    const video = videoRef.current
    if (video.readyState >= 2) {
      detectorRef.current
        .detect(video)
        .then((codes: BarcodeDetectorResult[]) => {
          if (codes && codes.length > 0) {
            const value = codes[0].rawValue || codes[0].stringValue || ''
            if (value) {
              stop()
              onDetected(value)
              onOpenChange(false)
              return
            }
          }
        })
        .catch(() => {})
    }
    rafRef.current = requestAnimationFrame(detectLoop)
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

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) stop()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-indigo-600" />
            Escanear Código
          </DialogTitle>
        </DialogHeader>
        {!supported ? (
          <div className="py-6 text-center space-y-3">
            <Camera className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500">
              Seu navegador não suporta a API de detecção de código de barras (
              <code className="text-[10px] bg-slate-100 px-1 rounded">BarcodeDetector</code>). Tente
              usar o Google Chrome no Android ou digite o código manualmente.
            </p>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-1/3 border-2 border-indigo-400 rounded-lg shadow-lg" />
              </div>
              {scanning && (
                <span className="absolute top-2 right-2 text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                  Câmera ativa
                </span>
              )}
            </div>
            {error && <p className="text-[11px] text-red-500 text-center">{error}</p>}
            <p className="text-[11px] text-slate-500 text-center">
              Aponte a câmera para o código de barras ou QR Code.
            </p>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  stop()
                  onOpenChange(false)
                }}
              >
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
