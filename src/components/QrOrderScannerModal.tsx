import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  QrCode,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
  ArrowRight,
  X,
  Keyboard,
  ShieldAlert,
  Camera,
} from 'lucide-react'
import { parseJucaOrderQr, ParsedQrOrderResult } from '@/lib/qr-order-utils'
import { useToast } from '@/hooks/use-toast'

interface QrOrderScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Leitor de QR Code de Ordens de Serviço (JUCA INFORMÁTICA)
 *
 * ARQUITETURA MOBILE-FIRST ROBUSTA (iOS Safari / Android Chrome / Desktop):
 * 1. O elemento <video> é nativo, fixo no DOM, com playsInline, muted, autoPlay e playsinline
 *    atribuídos antes de qualquer requisição de mídia, contornando a tela preta clássica do WebKit.
 * 2. O stream é obtido diretamente via navigator.mediaDevices.getUserMedia com estratégia
 *    progressiva de constraints: câmera traseira (environment), com fallback para genérica.
 * 3. O elemento <video> recebe o MediaStream via video.srcObject e dispara play() explícito
 *    com tratamento de autoplay policy.
 * 4. O loop de decodificação roda a cada ~200ms por cima do vídeo ativo:
 *    a) Prioridade 1: BarcodeDetector nativo (se suportado pelo navegador, ultra-rápido via GPU).
 *    b) Prioridade 2 (fallback universal): renderiza o frame atual do <video> num OffscreenCanvas/Canvas
 *       oculto, converte em Blob/File JPEG e decodifica via Html5Qrcode.scanFile (ou detector interno).
 * 5. Ciclo de vida impecável: todas as tracks são interrompidas (track.stop()) ao fechar o modal
 *    ou navegar, sem luz de câmera ativa em segundo plano e sem concorrência entre aberturas.
 * 6. Erros transparentes de getUserMedia: NotAllowedError, NotFoundError, NotReadableError,
 *    OverconstrainedError com botões de ação e atalho de busca direta.
 */
export const QrOrderScannerModal: React.FC<QrOrderScannerModalProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate()
  const { toast } = useToast()

  // Referências DOM e controle de ciclo de vida
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const decoderInstanceRef = useRef<Html5Qrcode | null>(null)
  const barcodeDetectorRef = useRef<BarcodeDetector | null>(null)

  const scanLoopTimerRef = useRef<number | null>(null)
  const isStartingRef = useRef(false)
  const isStoppingRef = useRef(false)
  const isProcessingRef = useRef(false)
  const isOpenRef = useRef(open)
  const decoderBusyRef = useRef(false)
  const hiddenContainerId = useRef(`qr-hidden-decoder-${Math.random().toString(36).slice(2, 9)}`)

  // Estados de interface
  const [error, setError] = useState<string>('')
  const [warningMessage, setWarningMessage] = useState<string>('')
  const [isIframeBlocked, setIsIframeBlocked] = useState(false)
  const [streamingReady, setStreamingReady] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [isRetrying, setIsRetrying] = useState(false)
  const [cameraActiveLabel, setCameraActiveLabel] = useState<string>('')

  useEffect(() => {
    isOpenRef.current = open
  }, [open])

  // Parada total do loop de leitura e liberação imediata do hardware
  const stopAllMedia = useCallback(() => {
    // 1. Cancela timer do loop
    if (scanLoopTimerRef.current !== null) {
      window.clearTimeout(scanLoopTimerRef.current)
      scanLoopTimerRef.current = null
    }

    // 2. Interrompe todas as tracks de câmera ativas
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch {
            /* ignore */
          }
        })
      } catch (err) {
        console.warn('[QrOrderScanner] Erro ao parar tracks do stream:', err)
      }
      streamRef.current = null
    }

    // 3. Limpa o elemento de vídeo
    const video = videoRef.current
    if (video) {
      try {
        video.pause()
      } catch {
        /* ignore */
      }
      try {
        video.srcObject = null
      } catch {
        /* ignore */
      }
    }

    // 4. Limpa instância de decoder auxiliar se houver
    if (decoderInstanceRef.current) {
      try {
        decoderInstanceRef.current.clear()
      } catch {
        /* ignore */
      }
      decoderInstanceRef.current = null
    }

    setStreamingReady(false)
    setCameraActiveLabel('')
    decoderBusyRef.current = false
  }, [])

  // Processa o código reconhecido (id ou URL de OS)
  const handleDetectedCode = useCallback(
    (rawCode: string) => {
      const trimmed = rawCode.trim()
      if (!trimmed || isProcessingRef.current) return
      isProcessingRef.current = true

      const parsed: ParsedQrOrderResult = parseJucaOrderQr(trimmed)

      if (parsed.valid === false) {
        isProcessingRef.current = false
        if (parsed.reason === 'invalid_domain') {
          setWarningMessage(
            'Este QR Code aponta para um endereço externo não pertencente ao JUCA INFORMÁTICA. Por segurança, o redirecionamento foi impedido.',
          )
        } else if (parsed.reason === 'invalid_path') {
          setWarningMessage(
            'O QR Code lido é de outro módulo ou formato e não corresponde a uma Ordem de Serviço cadastrada.',
          )
        } else {
          setWarningMessage(
            'QR Code não reconhecido como uma Ordem de Serviço do JUCA INFORMÁTICA. Aponte para a etiqueta correta.',
          )
        }
        return
      }

      if (parsed.valid && parsed.targetPath && parsed.orderId) {
        const orderId = parsed.orderId
        const targetPath = parsed.targetPath
        // Para todas as tracks antes da navegação
        stopAllMedia()
        onOpenChange(false)
        toast({
          title: 'QR Code reconhecido!',
          description: `Abrindo Ordem de Serviço #${orderId.slice(0, 8)}...`,
        })
        navigate(targetPath)
      }
    },
    [navigate, onOpenChange, stopAllMedia, toast],
  )

  // Decodifica um frame do vídeo ativo via BarcodeDetector (se disponível) ou Canvas -> Html5Qrcode
  const processVideoFrame = useCallback(async () => {
    if (!isOpenRef.current || isProcessingRef.current || decoderBusyRef.current) return

    const video = videoRef.current
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return
    }

    // Se o vídeo não tem dimensões válidas ainda
    const videoWidth = video.videoWidth
    const videoHeight = video.videoHeight
    if (videoWidth <= 0 || videoHeight <= 0) {
      return
    }

    decoderBusyRef.current = true

    try {
      // Rota A: BarcodeDetector nativo disponível (Chrome Mobile / Android / navegadores modernos)
      if (barcodeDetectorRef.current) {
        try {
          const barcodes = await barcodeDetectorRef.current.detect(video)
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0].rawValue
            if (raw) {
              handleDetectedCode(raw)
              return
            }
          }
        } catch (detectorErr) {
          // Se o detector falhar por incompatibilidade pontual, continuamos com o fallback
          console.debug(
            '[QrOrderScanner] BarcodeDetector detect error, fallback to canvas:',
            detectorErr,
          )
        }
      }

      // Rota B: Fallback via Canvas -> scanFile do Html5Qrcode (universal: iOS Safari, Firefox, WebView)
      const canvas = hiddenCanvasRef.current || document.createElement('canvas')
      hiddenCanvasRef.current = canvas

      // Reduz resolução máxima de amostragem para 640px para manter alto FPS e baixo uso de CPU no mobile
      const scale = Math.min(1, 640 / Math.max(videoWidth, videoHeight))
      const targetW = Math.round(videoWidth * scale)
      const targetH = Math.round(videoHeight * scale)

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW
        canvas.height = targetH
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      ctx.drawImage(video, 0, 0, targetW, targetH)

      // Garante uma instância oculta do Html5Qrcode para decode de imagem
      if (!decoderInstanceRef.current) {
        try {
          decoderInstanceRef.current = new Html5Qrcode(hiddenContainerId.current, {
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            verbose: false,
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: false,
            },
          })
        } catch (e) {
          console.debug('[QrOrderScanner] Erro ao instanciar decoder auxiliar:', e)
        }
      }

      const decoder = decoderInstanceRef.current
      if (decoder && typeof decoder.scanFile === 'function') {
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8)
        })

        if (blob && isOpenRef.current && !isProcessingRef.current) {
          const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' })
          try {
            const decodedText = await decoder.scanFile(file, false)
            if (decodedText && isOpenRef.current) {
              handleDetectedCode(decodedText)
              return
            }
          } catch {
            // Nenhum QR detectado neste frame — comportamento normal do loop
          }
        }
      }
    } catch (err) {
      console.debug('[QrOrderScanner] Frame process tick:', err)
    } finally {
      decoderBusyRef.current = false
    }
  }, [handleDetectedCode])

  // Inicia o loop contínuo de processamento
  const startScanLoop = useCallback(() => {
    if (scanLoopTimerRef.current !== null) {
      window.clearTimeout(scanLoopTimerRef.current)
      scanLoopTimerRef.current = null
    }

    const loopTick = async () => {
      if (!isOpenRef.current) return
      await processVideoFrame()
      if (isOpenRef.current && !isProcessingRef.current) {
        // Intervalo de ~180ms para leitura fluida sem engasgar o Safari iOS
        scanLoopTimerRef.current = window.setTimeout(loopTick, 180)
      }
    }

    scanLoopTimerRef.current = window.setTimeout(loopTick, 150)
  }, [processVideoFrame])

  // Inicia captura nativa da câmera via getUserMedia
  const startCamera = useCallback(async () => {
    if (isStartingRef.current) return
    isStartingRef.current = true
    setError('')
    setWarningMessage('')
    setIsIframeBlocked(false)

    try {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setError(
          'Acesso à câmera não suportado neste navegador ou ambiente (requer conexão segura HTTPS ou localhost).',
        )
        return
      }

      // Interrompe qualquer stream anterior
      stopAllMedia()

      if (!isOpenRef.current) return

      const videoEl = videoRef.current
      if (!videoEl) {
        return
      }

      // Inicializa BarcodeDetector nativo se o browser suportar
      if ('BarcodeDetector' in window && typeof window.BarcodeDetector === 'function') {
        try {
          barcodeDetectorRef.current = new window.BarcodeDetector({
            formats: ['qr_code'],
          })
        } catch {
          barcodeDetectorRef.current = null
        }
      } else {
        barcodeDetectorRef.current = null
      }

      // Constraints de câmera:
      // Tentativa 1: traseira ideal em alta definição sem travar
      const constraintsList: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        {
          video: {
            facingMode: 'environment',
          },
          audio: false,
        },
        {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        },
        {
          video: true,
          audio: false,
        },
      ]

      let stream: MediaStream | null = null
      let lastErr: unknown = null

      for (const constraints of constraintsList) {
        if (!isOpenRef.current) return
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
          if (stream) {
            break
          }
        } catch (err) {
          lastErr = err
          // Se for erro de permissão negada pelo usuário, não adianta tentar outra constraint
          if (
            err instanceof Error &&
            (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
          ) {
            throw err
          }
          console.debug('[QrOrderScanner] Constraint falhou, tentando próxima:', constraints, err)
        }
      }

      if (!stream) {
        throw lastErr || new Error('Nenhuma constraint de câmera foi aceita pelo dispositivo.')
      }

      if (!isOpenRef.current) {
        // Fechou enquanto solicitava permissão
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      streamRef.current = stream

      // Configura elemento de vídeo controlado
      videoEl.srcObject = stream

      // Garante atributos vitais de inline no iOS Safari
      videoEl.setAttribute('playsinline', 'true')
      videoEl.setAttribute('webkit-playsinline', 'true')
      videoEl.setAttribute('autoplay', 'true')
      videoEl.setAttribute('muted', 'true')
      videoEl.muted = true
      // @ts-expect-error webkitPlaysInline is non-standard WebKit property
      videoEl.webkitPlaysInline = true
      videoEl.playsInline = true
      videoEl.autoplay = true

      // Inicia reprodução
      try {
        await videoEl.play()
      } catch (playErr) {
        console.warn('[QrOrderScanner] video.play() falhou no autoplay:', playErr)
        // No iOS, se play() for rejeitado, tentamos novamente ao toque ou muted
        videoEl.muted = true
        await videoEl.play().catch((e) => console.warn('[QrOrderScanner] Retry play falhou:', e))
      }

      // Identifica label da câmera ativa
      const activeVideoTrack = stream.getVideoTracks()[0]
      if (activeVideoTrack) {
        setCameraActiveLabel(activeVideoTrack.label || 'Câmera traseira ativa')
      }

      setStreamingReady(true)

      // Inicia o loop de detecção
      startScanLoop()
    } catch (startErr: unknown) {
      console.warn('[QrOrderScanner] Erro ao iniciar câmera:', startErr)
      stopAllMedia()

      if (!isOpenRef.current) return

      const errName = startErr instanceof Error ? startErr.name : ''
      const errMsg = String(startErr || '')

      let inIframe = false
      try {
        inIframe = window.self !== window.top
      } catch {
        inIframe = true
      }

      const isPermissionError =
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errMsg.toLowerCase().includes('permission') ||
        errMsg.toLowerCase().includes('notallowed')

      if (isPermissionError) {
        if (inIframe) {
          setIsIframeBlocked(true)
          setError(
            'Acesso à câmera bloqueado no modo de visualização (preview). Abra o aplicativo em uma nova aba para escanear pela câmera do celular.',
          )
        } else {
          setError(
            'Permissão de acesso à câmera negada. Permita o uso da câmera nos ajustes do Safari/Chrome ou do aparelho e toque em Tentar Novamente.',
          )
        }
      } else if (
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError' ||
        errMsg.toLowerCase().includes('notfound')
      ) {
        setError('Nenhuma câmera foi encontrada neste dispositivo.')
      } else if (
        errName === 'NotReadableError' ||
        errName === 'TrackStartError' ||
        errMsg.toLowerCase().includes('readable')
      ) {
        setError(
          'A câmera já está sendo utilizada por outro aplicativo ou aba. Feche os outros aplicativos e tente novamente.',
        )
      } else if (
        errName === 'OverconstrainedError' ||
        errMsg.toLowerCase().includes('overconstrained')
      ) {
        setError(
          'As configurações da câmera exigidas não são suportadas pelo sensor. Toque em Tentar Novamente para usar o modo padrão.',
        )
      } else {
        setError(
          `Câmera indisponível (${errName || errMsg || 'Erro desconhecido'}). Verifique a permissão do navegador e a conexão segura (HTTPS).`,
        )
      }
    } finally {
      isStartingRef.current = false
    }
  }, [isOpenRef, startScanLoop, stopAllMedia])

  // Ciclo de vida controlado pela abertura do modal
  useEffect(() => {
    if (!open) {
      stopAllMedia()
      return
    }

    isProcessingRef.current = false
    setManualCode('')
    setIsRetrying(false)
    setIsIframeBlocked(false)
    setError('')
    setWarningMessage('')

    // Delay calculado para o modal shadcn/Dialog completar montagem no DOM e dimensões ficarem estáveis
    const timer = setTimeout(() => {
      if (isOpenRef.current) {
        void startCamera()
      }
    }, 280)

    return () => {
      clearTimeout(timer)
      stopAllMedia()
    }
  }, [open, startCamera, stopAllMedia])

  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = manualCode.trim()
    if (!trimmed || isProcessingRef.current) return
    handleDetectedCode(trimmed)
  }

  const handleRetryCamera = async () => {
    setIsRetrying(true)
    setError('')
    setWarningMessage('')
    setIsIframeBlocked(false)
    stopAllMedia()
    try {
      await startCamera()
    } finally {
      setIsRetrying(false)
    }
  }

  const handleOpenInNewTab = () => {
    try {
      window.open(window.location.href, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.warn('[QrOrderScanner] Falha ao abrir em nova aba:', err)
    }
  }

  const handleGoToOrderList = () => {
    stopAllMedia()
    onOpenChange(false)
    navigate('/ordens')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          stopAllMedia()
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden">
        {/* Container oculto estático para o Html5Qrcode instance de decode por arquivo/canvas */}
        <div
          id={hiddenContainerId.current}
          aria-hidden="true"
          className="hidden"
          style={{ display: 'none', position: 'absolute', width: 0, height: 0, opacity: 0 }}
        />

        <DialogHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80">
          <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <QrCode className="h-5 w-5 text-indigo-600" />
            Ler QR Code da OS
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Aponte a câmera traseira do celular para o QR Code da etiqueta térmica da OS.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Alerta quando o QR lido não pertence a uma OS do JUCA */}
          {warningMessage && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2 text-amber-800">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <div className="text-xs font-medium leading-relaxed">{warningMessage}</div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-amber-200/60">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setWarningMessage('')}
                  className="h-7 text-xs text-amber-800 hover:text-amber-950 p-1"
                >
                  Tentar outro QR
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleGoToOrderList}
                  className="h-7 text-xs font-semibold border-amber-300 bg-white hover:bg-amber-100/80 text-amber-900"
                >
                  <Search className="h-3 w-3 mr-1" /> Buscar na lista
                </Button>
              </div>
            </div>
          )}

          {/* Área da Câmera: elemento <video> 100% nativo, visível e inline */}
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-square max-h-[290px] mx-auto shadow-inner border border-slate-800 flex items-center justify-center">
              {/* Elemento de vídeo direto e controlado pelo React */}
              <video
                ref={videoRef}
                playsInline
                webkit-playsinline="true"
                muted
                autoPlay
                className="w-full h-full object-cover block bg-black"
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    videoRef.current
                      .play()
                      .catch((e) =>
                        console.debug('[QrOrderScanner] onLoadedMetadata play info:', e),
                      )
                  }
                }}
              />

              {/* Mira de enquadramento do QR */}
              {!error && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="w-56 h-56 border-2 border-indigo-400/90 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.35)] bg-indigo-500/5 relative flex items-center justify-center">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-indigo-400 -mt-0.5 -ml-0.5 rounded-tl-sm" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-indigo-400 -mt-0.5 -mr-0.5 rounded-tr-sm" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-indigo-400 -mb-0.5 -ml-0.5 rounded-bl-sm" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-indigo-400 -mb-0.5 -mr-0.5 rounded-br-sm" />
                  </div>
                </div>
              )}

              {/* Indicador de Câmera Ativa */}
              {streamingReady && !error && (
                <span className="absolute top-2.5 right-2.5 text-[10px] font-medium bg-emerald-600 text-white px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1.5 z-20">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Câmera ativa
                </span>
              )}

              {/* Loading inicial antes do stream estar pronto */}
              {!streamingReady && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 text-white text-xs z-15">
                  <Camera className="h-8 w-8 text-indigo-400 animate-pulse" />
                  <span className="text-slate-300">Iniciando câmera traseira...</span>
                </div>
              )}
            </div>

            {/* Mensagem de Erro e Alternativas */}
            {error ? (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-start gap-2.5 text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <div className="text-xs leading-relaxed font-medium">{error}</div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-rose-100">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleGoToOrderList}
                    className="h-8 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-100"
                  >
                    <Search className="h-3.5 w-3.5 mr-1" /> Buscar OS existente
                  </Button>
                  <div className="flex items-center gap-2">
                    {isIframeBlocked && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleOpenInNewTab}
                        className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Abrir em nova aba
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleRetryCamera}
                      disabled={isRetrying}
                      className="h-8 text-xs font-semibold bg-white border-rose-200 hover:bg-rose-100 text-rose-700"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 mr-1.5 ${isRetrying ? 'animate-spin' : ''}`}
                      />
                      Tentar Novamente
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 text-center">
                Centralize o QR Code no quadro acima para abrir a OS automaticamente.
              </p>
            )}
          </div>

          {/* Opção alternativa: informar número ou link manualmente */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Keyboard className="h-3.5 w-3.5 text-indigo-600" />
                Digitar link ou código da OS
              </span>
              <button
                type="button"
                onClick={handleGoToOrderList}
                className="text-[11px] text-indigo-600 hover:underline font-medium"
              >
                Ver listagem de OS
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Cole a URL (/ordens/...) ou o ID da OS..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="h-9 text-xs font-mono"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!manualCode.trim()}
                className="h-9 px-3 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs"
              >
                Abrir
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
                stopAllMedia()
                onOpenChange(false)
              }}
              className="text-xs h-8"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
