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
  const isStartingRef = useRef(false)
  const isStoppingRef = useRef(false)
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
    if (isStoppingRef.current) return
    isStoppingRef.current = true

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
    isStoppingRef.current = false
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
    // Evita chamadas concorrentes a startScanner
    if (isStartingRef.current) {
      console.warn(
        '[BarcodeScanner] startScanner já está em execução, ignorando chamada concorrente.',
      )
      return
    }

    isStartingRef.current = true
    setError('')
    console.log('[BarcodeScanner] Iniciando leitor de código de barras...')

    try {
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

      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
      const isIOS =
        /iPad|iPhone|iPod/.test(ua) ||
        (typeof navigator !== 'undefined' &&
          navigator.platform === 'MacIntel' &&
          navigator.maxTouchPoints > 1)
      const isMobile = isIOS || /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
      const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/i.test(ua) && !isIOS
      const isSafari = /^((?!chrome|android).)*safari/i.test(ua)

      console.log('[BarcodeScanner] Plataforma detectada:', {
        ua,
        isMobile,
        isIOS,
        isMac,
        isSafari,
      })

      // Garante que qualquer scanner anterior seja interrompido de forma limpa
      await stopScanner()

      if (!isOpenRef.current) return

      // Garante que o elemento container exista no DOM e tenha dimensões calculadas
      const targetElement = document.getElementById(containerId)
      if (!targetElement) {
        console.warn('[BarcodeScanner] Elemento container não encontrado no DOM:', containerId)
        return
      }

      // 3. Verificação de Visibilidade: aguarda dimensões calculadas (evita NotAllowedError em Safari se elemento estiver colapsado)
      const rect = targetElement.getBoundingClientRect()
      console.log('[BarcodeScanner] Dimensões do container no DOM:', {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
      })

      // Se dimensões forem 0, aguardar um frame extra para o CSS/DOM renderizar
      if (rect.width === 0 || rect.height === 0) {
        console.log(
          '[BarcodeScanner] Container com tamanho zero, aguardando renderização do layout...',
        )
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }

      // 1. Obter lista de câmeras disponíveis com log de diagnóstico
      let cameras: Array<{ id: string; label: string }> = []
      try {
        cameras = await Html5Qrcode.getCameras()
        console.log('[BarcodeScanner] Câmeras detectadas via getCameras():', cameras)
      } catch (camErr) {
        console.warn('[BarcodeScanner] Erro ao listar câmeras (getCameras):', camErr)
      }

      if (!isOpenRef.current) return

      // 1. Simplificar Constraints:
      // No macOS, o Safari frequentemente falha ao solicitar IDs específicos quando labels estão vazias
      // ou bloqueia constraints rígidas. Iniciar com { facingMode: 'user' } é mais bem aceito.
      let selectedCameraTarget: string | MediaTrackConstraints

      if (isMac) {
        // No macOS, prefere facingMode user ou câmera FaceTime/padrão sem travar em deviceId opaco
        if (cameras && cameras.length === 1 && cameras[0].label) {
          // Se só tem 1 câmera identificada e com label válida, podemos tentar o id ou facingMode
          selectedCameraTarget = { facingMode: 'user' }
        } else {
          selectedCameraTarget = { facingMode: 'user' }
        }
        console.log(
          '[BarcodeScanner] [macOS] Usando constraint simplificada:',
          selectedCameraTarget,
        )
      } else if (cameras && cameras.length > 0) {
        if (isMobile) {
          // Em dispositivos móveis, priorizar câmeras traseiras ("back", "rear", "environment", "traseira")
          const backCam = cameras.find((c) => /back|rear|environment|traseira/i.test(c.label || ''))
          selectedCameraTarget = backCam
            ? backCam.id
            : cameras[cameras.length - 1]?.id || { facingMode: 'environment' }
        } else {
          // Em outros desktops, priorizar câmera padrão/FaceTime HD ou a primeira câmera disponível
          const defaultCam =
            cameras.find((c) =>
              /facetime|integrated|built-in|default|principal/i.test(c.label || ''),
            ) || cameras[0]
          selectedCameraTarget = defaultCam ? defaultCam.id : { facingMode: 'user' }
        }
        console.log('[BarcodeScanner] Câmera selecionada:', selectedCameraTarget)
      } else {
        // Fallback genérico quando getCameras() retorna vazio ou falha
        selectedCameraTarget = isMobile
          ? ({ facingMode: { ideal: 'environment' } } as unknown as MediaTrackConstraints)
          : ({ facingMode: 'user' } as unknown as MediaTrackConstraints)
        console.log(
          '[BarcodeScanner] Nenhuma câmera listada por ID, usando constraint fallback:',
          selectedCameraTarget,
        )
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

      // 2. Afrouxar Constraints de Resolução/Aspect Ratio:
      // Removemos aspectRatio fixo (1.777778 / 16:9) que causa recusa de stream em webcams antigas de MacBooks e Safari.
      // Usamos qrbox responsivo e sem travar aspectRatio fixo.
      const scanConfig: {
        fps: number
        qrbox: { width: number; height: number }
        disableFlip: boolean
        aspectRatio?: number
      } = {
        fps: 15,
        qrbox: { width: 280, height: 160 },
        disableFlip: false,
      }

      console.log('[BarcodeScanner] Configurações de scan enviadas:', {
        selectedCameraTarget,
        scanConfig,
      })

      const onSuccess = (decodedText: string) => {
        if (isProcessingRef.current || !isOpenRef.current) return
        console.log('[BarcodeScanner] Código detectado com sucesso:', decodedText)
        handleDetectedCode(decodedText)
      }

      const onError = () => {
        // Falhas normais frame-a-frame de leitura (não poluir logs)
      }

      if (!isOpenRef.current) {
        await stopScanner()
        return
      }

      // Tentativa de inicialização da câmera
      try {
        console.log('[BarcodeScanner] Iniciando leitura na câmera:', selectedCameraTarget)
        await instance.start(selectedCameraTarget, scanConfig, onSuccess, onError)

        if (!isOpenRef.current) {
          await stopScanner()
          return
        }

        setScanning(true)
        console.log('[BarcodeScanner] Câmera iniciada com sucesso!')
      } catch (startErr: unknown) {
        console.error('[BarcodeScanner] Falha ao iniciar câmera na primeira tentativa:', startErr)

        // Fallback secundário para Mac/Safari se a constraint inicial falhou:
        // Tentar um fallback mais genérico ainda (ex: facingMode 'user' ou 'environment' ou deviceId)
        if (isMac && typeof selectedCameraTarget !== 'string' && cameras && cameras.length > 0) {
          try {
            console.log(
              '[BarcodeScanner] [macOS] Tentando fallback com ID da primeira câmera:',
              cameras[0].id,
            )
            await instance.start(cameras[0].id, scanConfig, onSuccess, onError)
            if (!isOpenRef.current) {
              await stopScanner()
              return
            }
            setScanning(true)
            console.log('[BarcodeScanner] [macOS] Câmera iniciada com sucesso no fallback!')
            return
          } catch (fallbackErr) {
            console.warn('[BarcodeScanner] [macOS] Fallback também falhou:', fallbackErr)
          }
        }

        await stopScanner()

        if (!isOpenRef.current) return

        const errName = startErr instanceof Error ? startErr.name : ''
        const errMsg = String(startErr || '')

        console.log('[BarcodeScanner] Detalhes do erro ao abrir câmera:', {
          errName,
          errMsg,
          startErr,
          isMac,
          isSafari,
          isIOS,
        })

        if (
          errName === 'NotAllowedError' ||
          errName === 'PermissionDeniedError' ||
          errMsg.toLowerCase().includes('permission') ||
          errMsg.toLowerCase().includes('notallowed')
        ) {
          if (isMac) {
            setError(
              'Permissão de acesso à câmera negada ou bloqueada. No macOS/Safari/Chrome: 1) Verifique se a câmera não está em uso por outro aplicativo (FaceTime, Zoom, Teams); 2) Autorize em Ajustes do Sistema > Privacidade e Segurança > Câmera; 3) Verifique as permissões de câmera nas configurações do Safari (Preferências > Sites > Câmera).',
            )
          } else if (isIOS) {
            setError(
              'Permissão de acesso à câmera negada. No iOS/Safari: toque no ícone "aA" na barra de endereços > Ajustes do Site > Câmera (Permitir), ou vá em Ajustes do iOS > Safari > Câmera.',
            )
          } else {
            setError(
              'Permissão de acesso à câmera negada. Permita o acesso à câmera nas configurações do navegador ou na barra de endereços e tente novamente.',
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
            'A câmera já está em uso por outro aplicativo ou aba (como FaceTime, Zoom, Teams). Feche os outros programas e clique em Tentar Novamente.',
          )
        } else if (
          errName === 'OverconstrainedError' ||
          errName === 'ConstraintNotSatisfiedError' ||
          errMsg.toLowerCase().includes('overconstrained')
        ) {
          setError(
            'As configurações de resolução da câmera não foram aceitas pelo sensor. Clique em Tentar Novamente para usar modo compatível.',
          )
        } else {
          setError(
            `Não foi possível acessar a câmera (${errName || errMsg || 'Erro desconhecido'}). Verifique se a página está em conexão segura (HTTPS), se a câmera não está em uso por outro app e se as permissões estão ativas.`,
          )
        }
      }
    } finally {
      isStartingRef.current = false
    }
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

    // 5. Aumentar Delay Inicial para 300ms garantindo que o modal e o container DOM estejam 100% estáveis no Safari
    const timer = setTimeout(() => {
      if (isOpenRef.current) {
        startScanner()
      }
    }, 300)

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
