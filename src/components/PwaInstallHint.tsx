import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { IosInstallGuide } from '@/components/IosInstallGuide'

export function PwaInstallHint() {
  const {
    canInstall,
    promptInstall,
    dismiss,
    canShowIosGuide,
    dismissIosGuide,
    iosModalOpen,
    closeIosModal,
  } = usePwaInstall()

  if (canShowIosGuide || iosModalOpen) {
    return <IosInstallGuide onDismiss={iosModalOpen ? closeIosModal : dismissIosGuide} />
  }

  if (!canInstall) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur animate-fade-in-up sm:left-auto sm:right-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Instalar JUCA Informática</p>
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
            Instale no celular para usar em campo em tela cheia, com acesso rápido e operação
            estável.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              onClick={promptInstall}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-3"
            >
              Instalar app
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={dismiss}
              className="text-xs h-8 px-3 text-slate-600 hover:text-slate-900"
            >
              Agora não
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
