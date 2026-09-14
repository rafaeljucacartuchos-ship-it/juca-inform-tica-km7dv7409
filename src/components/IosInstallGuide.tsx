import { Share, Plus, X, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function IosInstallGuide({ onDismiss }: { onDismiss: () => void }) {
  const steps = [
    {
      icon: Share,
      title: '1. Toque no botão Compartilhar',
      description:
        'Toque no ícone de Compartilhar (quadrado com a seta apontando para cima) na barra de ferramentas do Safari.',
    },
    {
      icon: Plus,
      title: '2. Selecione "Adicionar à Tela de Início"',
      description: 'Role a lista de opções para baixo e toque em "Adicionar à Tela de Início".',
    },
    {
      icon: Smartphone,
      title: '3. Confirme em "Adicionar"',
      description:
        'Toque em "Adicionar" no canto superior direito. O ícone da JUCA Informática aparecerá na tela do seu iPhone.',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm animate-fade-in sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-fade-in-up sm:rounded-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Instalar no iPhone / iPad</h2>
              <p className="text-xs text-slate-500">Uso ideal para a equipe externa em campo</p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3.5">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <div key={step.title} className="flex gap-3 items-start">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 mt-0.5">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 rounded-lg bg-indigo-50 border border-indigo-100/80 p-3">
          <p className="text-xs text-indigo-900 leading-relaxed font-medium">
            💡 Como PWA instalado, o sistema funciona em tela cheia (sem a barra do navegador),
            mantém o login ativo e respeita o notch/Dynamic Island do aparelho.
          </p>
        </div>

        <Button
          className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          onClick={onDismiss}
        >
          Entendi, vou adicionar
        </Button>
      </div>
    </div>
  )
}
