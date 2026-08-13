import { Share, Plus, X, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function IosInstallGuide({ onDismiss }: { onDismiss: () => void }) {
  const steps = [
    {
      icon: Share,
      title: '1. Toque no botão Compartilhar',
      description:
        'Toque no ícone de Compartilhar (quadrado com seta para cima) na barra de ferramentas do Safari, na parte inferior ou superior da tela.',
    },
    {
      icon: Plus,
      title: '2. Selecione "Adicionar à Tela de Início"',
      description:
        'Role a lista de opções e toque em "Adicionar à Tela de Início" para criar o atalho do app.',
    },
    {
      icon: Smartphone,
      title: '3. Confirme com "Adicionar"',
      description:
        'Revise o nome do app e toque em "Adicionar" no canto superior direito. O app aparecerá na sua tela inicial.',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-5 shadow-xl animate-fade-in-up sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
              <Smartphone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Instalar no iPhone</h2>
              <p className="text-xs text-slate-500">Siga os passos abaixo</p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <div key={step.title} className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <Icon className="h-5 w-5 text-slate-700" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-5 rounded-lg bg-blue-50 p-3">
          <p className="text-xs text-blue-700">
            Após instalar, o app abrirá em tela cheia, como um aplicativo nativo, e funcionará mesmo
            sem conexão com a internet.
          </p>
        </div>

        <Button className="mt-4 w-full" onClick={onDismiss}>
          Entendi
        </Button>
      </div>
    </div>
  )
}
