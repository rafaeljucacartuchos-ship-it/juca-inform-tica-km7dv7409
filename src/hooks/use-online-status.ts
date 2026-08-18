import { useEffect, useState } from 'react'

/**
 * Monitora o status de conexão do navegador.
 * Retorna `{ isOnline }` que reflete `navigator.onLine` e reage aos
 * eventos `online` / `offline` disparados pela janela.
 */
export function useOnlineStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Em alguns casos o estado inicial pode estar dessincronizado.
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline }
}
