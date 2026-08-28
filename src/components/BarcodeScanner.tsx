import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScanLine, X, RefreshCw, AlertTriangle, ArrowRight, Keyboard } from 'lucide-react'

interface BarcodeScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDetected: (code: string) => void
}

const BARCODE_FORMATS: Html5QrcodeSupportedFormats[] = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF,
]

/**
 * Leitor de código de barras 1D compatível com iOS Safari, macOS Safari, Chrome e Android.
 * Utiliza a biblioteca html5-qrcode com foco em formatos de código de barras 1D.
 */
export function BarcodeScanner({ open, onOpenChange, onDetected }: BarcodeScannerProps) {
  const uniqueId = useId()
  const containerId = `html5qr-reader-${uniqueId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isProcessingRef = useRef(false)
  const isOpenRef = useRef(open)

  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [isRetrying, setIsRetrying] = useState(false)

  // Mantém isOpenRef sincronizado para evitar execuções de câmeras órfãs
  useEffect(() => {
    isOpenRef.current = open
  }, [open])

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop()
        }
      } catch (e) {
        console.warn('[BarcodeScanner] Erro ao parar html5-qrcode:', e)
      }
      try {
        scanner.clear()
      } catch (e) {
        console.warn('[BarcodeScanner] Erro ao limpar container html5-qrcode:', e)
      }
      scannerRef.current = null
    }
    setScanning(false)
  }, [])

  const handleDetectedCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim()
      if (!trimmed || isProcessingRef.current) return
      isProcessingRef.current = true

      await stopScanner()
      onOpenChange(false)
      onDetected(trimmed)
    },
    [onDetected, onOpenChange, stopScanner],
  )

  const startScanner = useCallback(async () => {
    setError('')
    console.log('[BarcodeScanner] Iniciando acesso à câmera...')

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      const msg =
        'Acesso à câmera não suportado neste navegador ou ambiente (requer HTTPS ou localhost).'
      console.error('[BarcodeScanner]', msg)
      setError(msg)
      return
    }

    const isMac =
      typeof navigator !== 'undefined' &&
      /Macintosh|MacIntel|MacPPC|Mac68K/i.test(navigator.userAgent || '')

    // Garante que qualquer scanner anterior seja interrompido
    await stopScanner()

    if (!isOpenRef.current) return

    // Garante que o elemento container exista no DOM
    const targetElement = document.getElementById(containerId)
    if (!targetElement) {
      console.warn('[BarcodeScanner] Elemento container não encontrado no DOM:', containerId)
      return
    }

    let instance: Html5Qrcode
    try {
      instance = new Html5Qrcode(containerId, {
        formatsToSupport: BARCODE_FORMATS,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      })
      scannerRef.current = instance
    } catch (err) {
      console.error('[BarcodeScanner] Erro ao instanciar Html5Qrcode:', err)
      setError('Não foi possível inicializar o leitor de código de barras.')
      return
    }

    // Configurações de leitura
    const scanConfig = {
      fps: 15,
      qrbox: { width: 280, height: 160 },
      aspectRatio: 1.777778, // 16:9
      disableFlip: false,
    }

    const onSuccess = (decodedText: string) => {
      if (isProcessingRef.current || !isOpenRef.current) return
      console.log('[BarcodeScanner] Código detectado:', decodedText)
      handleDetectedCode(decodedText)
    }

    const onError = () => {
      // Falhas normais frame-a-frame de leitura (não logar para evitar spam no console)
    }

    // Estratégias de câmera:
    // 1. facingMode: { ideal: 'environment' } (câmera traseira ideal no celular, flexível no Mac/desktop)
    // 2. facingMode: 'user' (câmera frontal ou FaceTime HD no Mac)
    // 3. facingMode: 'environment' (modo exato se suportado)
    // 4. Câmeras enumeradas explicitamente (getCameras) ou fallback genérico
    const cameraStrategies: Array<MediaTrackConstraints | string> = [
      { facingMode: { ideal: 'environment' } as unknown as string },
      { facingMode: 'user' },
      { facingMode: 'environment' },
    ]

    let started = false
    let lastError: unknown = null

    for (let i = 0; i < cameraStrategies.length; i++) {
      if (!isOpenRef.current) {
        await stopScanner()
        return
      }

      const strategy = cameraStrategies[i]
      try {
        console.log(
          `[BarcodeScanner] Tentando iniciar câmera (estratégia ${i + 1}/${cameraStrategies.length}):`,
          strategy,
        )
        await instance.start(
          strategy as unknown as MediaTrackConstraints,
          scanConfig,
          onSuccess,
          onError,
        )
        started = true
        console.log(`[BarcodeScanner] Câmera iniciada com sucesso na estratégia ${i + 1}!`)
        break
      } catch (err: unknown) {
        lastError = err
        const errStr = String(err)
        console.warn(`[BarcodeScanner] Falha na estratégia ${i + 1}:`, errStr)
      }
    }

    // Se as estratégias com facingMode falharam, tenta listar câmeras disponíveis (getCameras)
    if (!started && isOpenRef.current) {
      try {
        const cameras = await Html5Qrcode.getCameras()
        if (cameras && cameras.length > 0) {
          const preferredCam =
            cameras.find((c) => /back|rear|environment|traseira/i.test(c.label)) || cameras[0]
          console.log(
            '[BarcodeScanner] Tentando câmera enumerada:',
            preferredCam.label || preferredCam.id,
          )
          await instance.start(preferredCam.id, scanConfig, onSuccess, onError)
          started = true
        }
      } catch (camErr) {
        console.warn('[BarcodeScanner] Falha ao obter ou iniciar lista de câmeras:', camErr)
      }
    }

    if (!isOpenRef.current) {
      await stopScanner()
      return
    }

    if (!started) {
      console.error(
        '[BarcodeScanner] Todas as estratégias de câmera falharam. Erro final:',
        lastError,
      )
      const errName = lastError instanceof Error ? lastError.name : ''
      const errMsg = String(lastError || '')

      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errMsg.toLowerCase().includes('permission') ||
        errMsg.toLowerCase().includes('notallowed')
      ) {
        if (isMac) {
          setError(
            'Permissão de acesso à câmera negada. No macOS/Safari/Chrome, autorize a câmera nos Ajustes do Sistema > Privacidade e Segurança > Câmera, e nas permissões do site na barra de endereços.',
          )
        } else {
          setError(
            'Permissão de acesso à câmera negada. No iOS/Safari ou Chrome, permita o acesso à câmera nos Ajustes do dispositivo ou na barra de endereços do navegador.',
          )
        }
      } else if (
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError' ||
        errMsg.toLowerCase().includes('notfound')
      ) {
        setError('Nenhuma câmera foi encontrada no dispositivo.')
      } else if (
        errName === 'NotReadableError' ||
        errName === 'TrackStartError' ||
        errMsg.toLowerCase().includes('readable')
      ) {
        setError(
          'A câmera já está em uso por outro aplicativo ou aba. Feche outros apps e tente novamente.',
        )
      } else if (
        errName === 'OverconstrainedError' ||
        errName === 'ConstraintNotSatisfiedError' ||
        errMsg.toLowerCase().includes('overconstrained')
      ) {
        setError(
          'As configurações da câmera não são suportadas pelo dispositivo. Clique em Tentar Novamente.',
        )
      } else {
        setError(
          `Não foi possível acessar a câmera (${errName || errMsg || 'Erro desconhecido'}). Verifique se a página está em conexão segura (HTTPS) e se as permissões estão ativas.`,
        )
      }
      return
    }

    setScanning(true)
  }, [containerId, handleDetectedCode, stopScanner])

  // Efeito principal de abertura/fechamento
  useEffect(() => {
    if (!open) {
      stopScanner()
      return
    }

    isProcessingRef.current = false
    setManualCode('')
    setIsRetrying(false)
    setError('')

    // Dá um tempo breve para o DOM do Dialog montar o container
    const timer = setTimeout(() => {
      if (isOpenRef.current) {
        startScanner()
      }
    }, 150)

    return () => {
      clearTimeout(timer)
      stopScanner()
    }
  }, [open, startScanner, stopScanner])

  const handleManualSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = manualCode.trim()
    if (!trimmed || isProcessingRef.current) return
    isProcessingRef.current = true

    await stopScanner()
    onDetected(trimmed)
    onOpenChange(false)
  }

  const handleRetryCamera = async () => {
    setIsRetrying(true)
    setError('')
    await stopScanner()
    try {
      await startScanner()
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          stopScanner()
        }
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
          <div className="space-y-3">
            {/* Área do vídeo gerenciada por html5-qrcode */}
            <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video shadow-inner border border-slate-800 flex items-center justify-center">
              {/* Container onde a biblioteca html5-qrcode renderiza o vídeo e overlay */}
              <div
                id={containerId}
                className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_img]:hidden [&_button]:hidden [&_select]:hidden [&_br]:hidden"
              />

              {!error && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-3/4 h-1/2 border-2 border-indigo-400/90 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.3)] bg-indigo-500/5 relative">
                    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-indigo-500 -mt-0.5 -ml-0.5" />
                    <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-indigo-500 -mt-0.5 -mr-0.5" />
                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-indigo-500 -mb-0.5 -ml-0.5" />
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-indigo-500 -mb-0.5 -mr-0.5" />
                  </div>
                </div>
              )}

              {scanning && !error && (
                <span className="absolute top-2.5 right-2.5 text-[10px] font-medium bg-emerald-500/90 text-white px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1 z-10">
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
                Aponte a câmera para o código de barras.
              </p>
            )}
          </div>

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
              onClick={async () => {
                await stopScanner()
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
