import { useState, useEffect, useCallback } from 'react'
import { registerServiceWorker } from '@/lib/register-sw'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const IOS_DISMISS_KEY = 'atm-ios-guide-dismissed'

function detectIOS(): boolean {
  const ua = window.navigator.userAgent
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua)
  const isMacWithTouch =
    window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1
  return isIOSDevice || isMacWithTouch
}

function detectSafari(): boolean {
  const ua = window.navigator.userAgent
  const isChrome = /CriOS/.test(ua)
  const isFirefox = /FxiOS/.test(ua)
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua)
  return isSafari && !isChrome && !isFirefox
}

export function usePwaInstall() {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [isStandalone, setIsStandalone] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isSafari, setIsSafari] = useState(false)
  const [iosGuideDismissed, setIosGuideDismissed] = useState(false)
  const [iosModalOpen, setIosModalOpen] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    setIsStandalone(standalone)
    setIsIOS(detectIOS())
    setIsSafari(detectSafari())

    try {
      setIosGuideDismissed(localStorage.getItem(IOS_DISMISS_KEY) === 'true')
    } catch {
      setIosGuideDismissed(false)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPromptEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => {
      setInstallPromptEvent(null)
      setIsStandalone(true)
    }
    window.addEventListener('appinstalled', installedHandler)

    // Register with updateViaCache:'none' so deployed SW updates are detected.
    void registerServiceWorker()

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!installPromptEvent) {
      if (isIOS) {
        setIosModalOpen(true)
      }
      return
    }
    await installPromptEvent.prompt()
    const choice = await installPromptEvent.userChoice
    if (choice.outcome === 'accepted') {
      setInstallPromptEvent(null)
    }
  }, [installPromptEvent, isIOS])

  const dismiss = useCallback(() => {
    setIsDismissed(true)
  }, [])

  const dismissIosGuide = useCallback(() => {
    setIosGuideDismissed(true)
    setIosModalOpen(false)
    try {
      localStorage.setItem(IOS_DISMISS_KEY, 'true')
    } catch {
      // ignore
    }
  }, [])

  const showIosGuide = useCallback(() => {
    setIosModalOpen(true)
  }, [])

  const closeIosModal = useCallback(() => {
    setIosModalOpen(false)
  }, [])

  // Mostra o prompt/botão quando não está instalado standalone
  const canInstall = !isStandalone && !isDismissed && !!installPromptEvent
  // Banner automático para iOS (apenas se safari, não instalado, e não dispensado anteriormente)
  const canShowIosGuide = isIOS && isSafari && !isStandalone && !iosGuideDismissed
  // Permite ação manual de instalação (Android com evento prompt OU iOS)
  const isInstallable = !isStandalone && (!!installPromptEvent || isIOS)

  return {
    canInstall,
    isInstallable,
    promptInstall,
    dismiss,
    isStandalone,
    isIOS,
    isSafari,
    canShowIosGuide,
    dismissIosGuide,
    showIosGuide,
    iosModalOpen,
    closeIosModal,
  }
}
