import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
  recoveryKey: number
}

function isDomMutationError(error: unknown): boolean {
  if (!error) return false
  const errName =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name?: unknown }).name)
      : ''
  const errMsg =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message)
      : ''
  const fullText = `${errName} ${errMsg}`.toLowerCase()

  return (
    fullText.includes('notfounderror') ||
    fullText.includes('removechild') ||
    fullText.includes('insertbefore') ||
    fullText.includes('not a child') ||
    fullText.includes('o nó a ser removido não é filho')
  )
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
    recoveryKey: 0,
  }

  private autoRecoverAttempts = 0
  private lastAutoRecoverTime = 0
  private recoverTimer: number | null = null

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Erro capturado pela fronteira:', error, errorInfo)
    this.setState({ errorInfo })

    // Se for o erro clássico de reparentamento de nós pelo tradutor/extensão (removeChild / insertBefore / NotFoundError),
    // tenta auto-recuperar silenciosamente sem assustar o usuário com a tela cheia de erro.
    if (isDomMutationError(error)) {
      const now = Date.now()
      // Reseta contagem se passou mais de 15 segundos desde a última tentativa
      if (now - this.lastAutoRecoverTime > 15000) {
        this.autoRecoverAttempts = 0
      }

      if (this.autoRecoverAttempts < 2) {
        this.autoRecoverAttempts += 1
        this.lastAutoRecoverTime = now
        console.warn(
          `[GlobalErrorBoundary] Detectado erro de mutação DOM externa ('removeChild'/'insertBefore'). Tentando auto-recuperação (tentativa ${this.autoRecoverAttempts}/2)...`,
        )

        if (this.recoverTimer) {
          window.clearTimeout(this.recoverTimer)
        }

        // Aguarda micro-pausa para o DOM estabilizar e remonta
        this.recoverTimer = window.setTimeout(() => {
          this.setState((prev) => ({
            hasError: false,
            error: null,
            errorInfo: null,
            showDetails: false,
            recoveryKey: prev.recoveryKey + 1,
          }))
        }, 120)
      }
    }
  }

  public componentWillUnmount() {
    if (this.recoverTimer) {
      window.clearTimeout(this.recoverTimer)
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    })
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    })
    window.location.href = '/'
  }

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }))
  }

  public render() {
    if (this.state.hasError) {
      const errorMessage =
        this.state.error?.message || 'Ocorreu um erro inesperado ao renderizar esta página.'

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Ops! Algo deu errado
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Uma falha inesperada impediu a exibição desta tela. Seus dados cadastrados no banco
                estão preservados. Você pode tentar recarregar ou voltar para o início.
              </p>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-left">
              <p className="text-xs font-mono font-semibold text-rose-900 break-words">
                {errorMessage}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                onClick={this.handleReload}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-4 gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
              <Button
                variant="outline"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto text-xs h-10 px-4 gap-2 border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                <Home className="h-4 w-4" />
                Voltar ao início
              </Button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={this.toggleDetails}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <span>{this.state.showDetails ? 'Ocultar detalhes' : 'Ver detalhes técnicos'}</span>
                {this.state.showDetails ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-3 bg-slate-900 text-slate-100 rounded-lg text-left overflow-x-auto max-h-60 text-[10px] font-mono whitespace-pre-wrap">
                  <div className="font-bold text-rose-400 mb-1">Stack trace:</div>
                  {this.state.error?.stack || errorMessage}
                  {this.state.errorInfo?.componentStack && (
                    <div className="mt-2 text-slate-400">
                      <div className="font-bold text-indigo-400 mb-0.5">Component stack:</div>
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    return <React.Fragment key={this.state.recoveryKey}>{this.props.children}</React.Fragment>
  }
}

export default GlobalErrorBoundary
