import { useState, useEffect } from 'react'
import { CloudOff, RefreshCw, Cloud } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { getQueueCount, onQueueChange } from '@/lib/offline-queue'
import { offlinePb } from '@/lib/offline-pb'

type BannerState = 'hidden' | 'offline' | 'syncing'

export function OfflineBanner() {
  const { isOnline } = useOnlineStatus()
  const [pending, setPending] = useState(0)
  const [state, setState] = useState<BannerState>('hidden')

  // Atualiza a contagem de pendentes e o estado visível.
  const refresh = async () => {
    const count = await getQueueCount()
    setPending(count)
    if (!isOnline) {
      setState('offline')
    } else if (count > 0) {
      setState('syncing')
    } else {
      setState('hidden')
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  useEffect(() => {
    const offQueue = onQueueChange(() => void refresh())
    const offSync = offlinePb.onSyncComplete(() => void refresh())
    return () => {
      offQueue()
      offSync()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  if (state === 'hidden') {
    return (
      <div className="max-h-0 overflow-hidden transition-all duration-300" aria-hidden="true" />
    )
  }

  const isOffline = state === 'offline'

  return (
    <div
      className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white transition-all duration-300 shadow-sm ${
        isOffline ? 'bg-amber-600' : 'bg-indigo-600'
      }`}
      role="status"
      aria-live="polite"
    >
      {isOffline ? (
        <>
          <CloudOff className="h-4 w-4 shrink-0 animate-pulse" />
          <span>
            Sem conexão — o app continua operando em modo offline. Os dados serão atualizados assim
            que a conexão retornar.
          </span>
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
          <span>
            Conexão restabelecida! Sincronizando {pending}{' '}
            {pending === 1 ? 'alteração pendente' : 'alterações pendentes'}
            ...
          </span>
        </>
      )}
      <Cloud className="h-3.5 w-3.5 shrink-0 opacity-75" />
    </div>
  )
}
