import { useState } from 'react'
import { X } from 'lucide-react'
import { usePwaUpdate } from '@/hooks/use-pwa-update'

/**
 * Banner fixo no topo da página que avisa quando há uma nova versão do PWA
 * aguardando para ser ativada. Tem prioridade máxima — deve aparecer acima de
 * quaisquer banners de offline/push.
 */
export function PwaUpdateBanner() {
  const { updateAvailable, updateApp } = usePwaUpdate()
  const [dismissed, setDismissed] = useState(false)

  // Visível apenas quando há update E o usuário não dispensou. O banner volta
  // na próxima recarga se o SW ainda estiver waiting.
  const visible = updateAvailable && !dismissed

  return (
    <div
      className={`fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-white shadow-lg transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <span className="text-sm font-medium">⬆️ Nova versão disponível! Clique para atualizar.</span>
      <button
        type="button"
        onClick={updateApp}
        className="rounded-md bg-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        Atualizar agora
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-1 rounded-md p-1 text-white/80 transition hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60"
        aria-label="Fechar aviso de atualização"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
