import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { IosInstallGuide } from '@/components/IosInstallGuide'

export function PwaInstallHint() {
  const { canInstall, promptInstall, dismiss, canShowIosGuide, dismissIosGuide } = usePwaInstall()

  if (canShowIosGuide) {
    return <IosInstallGuide onDismiss={dismissIosGuide} />
  }

  if (!canInstall) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-lg animate-fade-in-up sm:left-auto sm:right-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
          <Download className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">Instalar aplicativo</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Instale o app na tela inicial para acesso rápido e modo tela cheia.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={promptInstall}>
              Instalar
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Agora não
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
