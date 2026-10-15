import React, { useEffect, useRef, useState, useCallback, useId } from 'react'
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
} from 'lucide-react'
import { parseJucaOrderQr } from '@/lib/qr-order-utils'
import { useToast } from '@/hooks/use-toast'

interface QrOrderScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const QrOrderScannerModal: React.FC<QrOrderScannerModalProps> = ({ open, onOpenChange }) => {
  const uniqueId = useId().replace(/:/g, '')
  const containerId = `qr-order-reader-${uniqueId}`

  const navigate = useNavigate()
  const { toast } = useToast()

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isStartingRef = useRef(false)
  const isStoppingRef = useRef(false)
  const isProcessingRef = useRef(false)
  const isOpenRef = useRef(open)

  const [error, setError] = useState<string>('')
  const [warningMessage, setWarningMessage] = useState<string>('')
  const [isIframeBlocked, setIsIframeBlocked] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    isOpenRef.current = open
  }, [open])

  // Liberação estrita de todas as tracks de câmera ativas
  const stopAllMediaTracks = useCallback(() => {
    try {
      const container = document.getElementById(containerId)
      if (container) {
        const videoEls = container.querySelectorAll('video')
        videoEls.forEach((v) => {
          const stream = v.srcObject as MediaStream | null
          if (stream && typeof stream.getTracks === 'function') {
            stream.getTracks().forEach((track) => {
              try {
                track.stop()
              } catch {
                /* ignore */
              }
            })
          }
          v.srcObject = null
        })
      }
    } catch (e) {
      console.warn('[QrOrderScanner] Erro ao parar tracks de mídia:', e)
    }
  }, [containerId])

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
        console.warn('[QrOrderScanner] Erro ao parar html5-qrcode:', e)
      }
      try {
        scanner.clear()
      } catch (e) {
        console.warn('[QrOrderScanner] Erro ao limpar container html5-qrcode:', e)
      }
      scannerRef.current = null
    }

    // Garante que nenhuma track de câmera permaneça ligada em background
    stopAllMediaTracks()

    setScanning(false)
    isStoppingRef.current = false
  }, [stopAllMediaTracks])

  // Tratamento de resultado reconhecido
  const handleDetectedCode = useCallback(
    async (rawCode: string) => {
      const trimmed = rawCode.trim()
      if (!trimmed || isProcessingRef.current) return
      isProcessingRef.current = true

      const parsed = parseJucaOrderQr(trimmed)

      if (parsed.valid) {
        // Encerra imediatamente a câmera antes de navegar
        await stopScanner()
        onOpenChange(false)
        toast({
          title: 'QR Code reconhecido!',
          description: `Abrindo Ordem de Serviço #${parsed.orderId.slice(0, 8)}...`,
        })
        navigate(parsed.targetPath)
        return
      }

      // Se o QR não for uma OS válida do JUCA
      isProcessingRef.current = false
      if (parsed.reason === 'invalid_domain') {
        setWarningMessage(
          'Este QR Code aponta para um endereço externo não pertencente ao JUCA INFORMÁTICA. Por segurança, a navegação automática foi bloqueada.',
        )
      } else if (parsed.reason === 'invalid_path') {
        setWarningMessage(
          'O QR Code lido é de outro módulo ou formato e não corresponde a uma Ordem de Serviço cadastrada.',
        )
      } else {
        setWarningMessage(
          'QR Code não reconhecido como uma Ordem de Serviço do JUCA INFORMÁTICA. Verifique se apontou para a etiqueta correta.',
        )
      }
    },
    [navigate, onOpenChange, stopScanner, toast],
  )

  const startScanner = useCallback(async () => {
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
        const msg =
          'Acesso à câmera não suportado neste navegador ou ambiente (requer conexão segura HTTPS ou localhost).'
        setError(msg)
        return
      }

      await stopScanner()

      if (!isOpenRef.current) return

      const targetElement = document.getElementById(containerId)
      if (!targetElement) {
        return
      }

      // Aguarda dimensões calculadas
      const rect = targetElement.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }

      if (!isOpenRef.current) return

      let cameras: Array<{ id: string; label: string }> = []
      try {
        cameras = await Html5Qrcode.getCameras()
      } catch (camErr) {
        console.warn('[QrOrderScanner] Erro ao listar câmeras:', camErr)
      }

      if (!isOpenRef.current) return

      // Preferência explícita por câmera traseira (facingMode: 'environment')
      let selectedCameraTarget: string | MediaTrackConstraints = {
        facingMode: { ideal: 'environment' } as any,
      }

      if (cameras && cameras.length > 0) {
        const backCam = cameras.find((c) =>
          /back|rear|environment|traseira|ambiente/i.test(c.label || ''),
        )
        if (backCam) {
          selectedCameraTarget = backCam.id
        } else {
          selectedCameraTarget = cameras[cameras.length - 1]?.id || {
            facingMode: 'environment',
          }
        }
      }

      let instance: Html5Qrcode
      try {
        instance = new Html5Qrcode(containerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        })
        scannerRef.current = instance
      } catch (err) {
        console.error('[QrOrderScanner] Erro ao instanciar Html5Qrcode:', err)
        setError('Não foi possível inicializar o leitor de QR Code.')
        return
      }

      const scanConfig = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        disableFlip: false,
      }

      const onSuccess = (decodedText: string) => {
        if (isProcessingRef.current || !isOpenRef.current) return
        handleDetectedCode(decodedText)
      }

      const onError = () => {
        // Leitura frame a frame
      }

      if (!isOpenRef.current) {
        await stopScanner()
        return
      }

      try {
        await instance.start(selectedCameraTarget, scanConfig, onSuccess, onError)

        if (!isOpenRef.current) {
          await stopScanner()
          return
        }

        setScanning(true)
      } catch (startErr: unknown) {
        console.warn(
          '[QrOrderScanner] Falha na primeira câmera, tentando fallback facingMode:',
          startErr,
        )

        // Fallback genérico para facingMode: environment simples
        try {
          await instance.start({ facingMode: 'environment' }, scanConfig, onSuccess, onError)
          if (!isOpenRef.current) {
            await stopScanner()
            return
          }
          setScanning(true)
          return
        } catch (fbErr) {
          console.warn(
            '[QrOrderScanner] Fallback environment também falhou, tentando qualquer câmera:',
            fbErr,
          )
        }

        await stopScanner()

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
              'Acesso à câmera bloqueado no modo de visualização (preview). Abra o aplicativo em uma nova aba para escanear pela câmera.',
            )
          } else {
            setError(
              'Permissão de acesso à câmera negada. Permita o uso da câmera nas configurações do navegador ou celular e tente novamente.',
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
            'A câmera já está sendo utilizada por outro aplicativo ou aba. Feche outros apps e tente novamente.',
          )
        } else {
          setError(
            `Câmera indisponível (${errName || errMsg || 'Erro desconhecido'}). Verifique se o dispositivo possui câmera traseira e conexão segura (HTTPS).`,
          )
        }
      }
    } finally {
      isStartingRef.current = false
    }
  }, [containerId, handleDetectedCode, stopScanner])

  // Ciclo de vida: abre e fecha câmera de forma rigorosa
  useEffect(() => {
    if (!open) {
      stopScanner()
      return
    }

    isProcessingRef.current = false
    setManualCode('')
    setIsRetrying(false)
    setIsIframeBlocked(false)
    setError('')
    setWarningMessage('')

    const timer = setTimeout(() => {
      if (isOpenRef.current) {
        startScanner()
      }
    }, 280)

    return () => {
      clearTimeout(timer)
      stopScanner()
    }
  }, [open, startScanner, stopScanner])

  const handleManualSubmit = async (e?: React.FormEvent) => {
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
    await stopScanner()
    try {
      await startScanner()
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

  const handleGoToOrderList = async () => {
    await stopScanner()
    onOpenChange(false)
    navigate('/ordens')
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
      <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden">
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
          {/* Alerta de aviso quando o QR lido não pertence a uma OS do JUCA */}
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

          {/* Área da Câmera */}
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-square max-h-[290px] mx-auto shadow-inner border border-slate-800 flex items-center justify-center">
              <div
                id={containerId}
                className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_img]:hidden [&_button]:hidden [&_select]:hidden [&_br]:hidden"
              />

              {!error && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-56 border-2 border-indigo-400/90 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.35)] bg-indigo-500/5 relative flex items-center justify-center">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-indigo-400 -mt-0.5 -ml-0.5 rounded-tl-sm" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-indigo-400 -mt-0.5 -mr-0.5 rounded-tr-sm" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-indigo-400 -mb-0.5 -ml-0.5 rounded-bl-sm" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-indigo-400 -mb-0.5 -mr-0.5 rounded-br-sm" />
                  </div>
                </div>
              )}

              {scanning && !error && (
                <span className="absolute top-2.5 right-2.5 text-[10px] font-medium bg-emerald-600 text-white px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1.5 z-10">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Câmera ativa
                </span>
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
              onClick={async () => {
                await stopScanner()
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
