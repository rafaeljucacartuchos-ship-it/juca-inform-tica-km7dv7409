import { useEffect, useRef } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'

/**
 * Hook for real-time subscriptions to a PocketBase collection.
 * ALWAYS use this hook instead of subscribing inline.
 * Uses the per-listener UnsubscribeFunc so multiple components
 * can safely subscribe to the same collection without conflicts.
 *
 * Generic over the record type: pass your collection's interface as
 * `useRealtime<MyRecord>(...)` to get a typed subscription payload
 * instead of `unknown`.
 */
export function useRealtime<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false

    try {
      pb.collection<TRecord>(collectionName)
        .subscribe('*', (e) => {
          try {
            callbackRef.current(e)
          } catch (cbErr) {
            console.warn(`[useRealtime] Erro no callback de ${collectionName}:`, cbErr)
          }
        })
        .then((fn) => {
          if (cancelled) {
            try {
              fn().catch(() => {})
            } catch {
              /* ignore */
            }
          } else {
            unsubscribeFn = fn
          }
        })
        .catch((err) => {
          // Captura falhas transientes ("Invalid realtime client", desconexões, etc.)
          console.warn(`[useRealtime] Falha ao assinar ${collectionName}:`, err)
        })
    } catch (err) {
      console.warn(`[useRealtime] Exceção síncrona ao assinar ${collectionName}:`, err)
    }

    return () => {
      cancelled = true
      if (unsubscribeFn) {
        try {
          unsubscribeFn().catch(() => {})
        } catch {
          /* ignore */
        }
      }
    }
  }, [collectionName, enabled])
}

export default useRealtime
