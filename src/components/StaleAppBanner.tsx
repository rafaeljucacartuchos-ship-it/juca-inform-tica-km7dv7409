import { useState } from 'react'
import { X, RefreshCw } from 'lucide-react'
import { useStaleApp } from '@/hooks/use-app-version'

/**
 * Banner fixo no topo (z-index acima de tudo) que avisa quando o app carregado
 * está desatualizado em relação ao deploy atual: o `<html data-app-version>`
 * diverge da versão reportada por `sw.js`. Isso acontece quando um Service
 * Worker antigo continua servendo um index.html cacheado.
 *
 * Tem prioridade máxima sobre o PwaUpdateBanner e o OfflineBanner — se este
 * aparece, os mecanismos automáticos de atualização provavelmente não rodaram.
 * Montado em App.tsx (fora do Layout) para aparecer inclusive na tela de login.
 */
export function StaleAppBanner() {
  const { stale } = useStaleApp()
  const [dismissed, setDismissed] = useState(false)
  const visible = stale && !dismissed

  return (
    <div
      className={`fixed inset-x-0 top-0 z-[10000] flex items-center justify-center gap-3 bg-gradient-to-r from-rose-600 to-orange-600 px-4 py-2.5 text-white shadow-lg transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
      role="alert"
      aria-live="assertive"
      aria-hidden={!visible}
    >
      <span className="text-sm font-semibold">
        ⚠️ App desatualizado — feche e abra novamente para atualizar.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex items-center gap-1 rounded-md bg-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <RefreshCw className="h-3 w-3" />
        Atualizar
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-1 rounded-md p-1 text-white/80 transition hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60"
        aria-label="Fechar aviso de app desatualizado"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
