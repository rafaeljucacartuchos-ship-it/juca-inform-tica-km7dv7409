import { useState, useEffect, useCallback, useRef } from 'react'
import pb from '@/lib/pocketbase/client'

/**
 * Chave pública VAPID usada pelo navegador para inscrever o dispositivo no
 * push service. A chave PRIVADA correspondente fica no backend (secrets
 * `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` / `VAPID_SUBJECT`) e é usada pelo
 * proxy web-push (`PUSH_PROXY_URL`) para assinar/criptografar as mensagens.
 *
 * Este par ECDSA P-256 DEVE ser o mesmo usado no proxy e nos secrets do
 * backend — caso contrário o envio de push não funcionará. Para rotacionar as
 * chaves, rode `npx web-push generate-vapid-keys` e atualize esta constante,
 * os secrets do backend e as variáveis de ambiente do proxy simultaneamente
 * (atenção: trocar as chaves invalida todas as subscriptions existentes).
 */
export const VAPID_PUBLIC_KEY =
  'BGtkbcjrO12YMoDuq2sCQeHlu47uPx3SHTgFKZFYiBW8Qr0D9vgyZSZPdw6_4ZFEI9Snk1VEAj2qTYI1I1YxBXE'

export type PushPermission = 'default' | 'granted' | 'denied'

export interface PushSubscriptionRecord {
  id: string
  user: string
  endpoint: string
  p256dh: string
  auth: string
  active: boolean
  created?: string
  updated?: string
}

export interface UsePushNotificationsResult {
  permission: PushPermission
  isSubscribed: boolean
  loading: boolean
  unsupported: boolean
  requestNotificationPermission: () => Promise<PushPermission>
  subscribeToPush: () => Promise<boolean>
  unsubscribeFromPush: () => Promise<boolean>
  refresh: () => Promise<void>
}

/**
 * Converte a chave pública VAPID (base64url sem padding) para Uint8Array,
 * formato exigido por `pushManager.subscribe({ applicationServerKey })`.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const output = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; ++i) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function usePushNotifications(userId?: string): UsePushNotificationsResult {
  const [permission, setPermission] = useState<PushPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  )
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [unsupported, setUnsupported] = useState(!isPushSupported())

  // Guarda o id do registro no PocketBase para permitir unsubscribe rápido.
  const subscriptionRecordIdRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setUnsupported(true)
      return
    }
    setPermission(Notification.permission as PushPermission)

    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      setIsSubscribed(!!existing)

      if (existing && userId) {
        // Confere se a subscription está registrada no backend.
        try {
          const rec = await pb
            .collection('push_subscriptions')
            .getFirstListItem<PushSubscriptionRecord>(
              `endpoint = "${existing.endpoint}" && user = "${userId}"`,
            )
          subscriptionRecordIdRef.current = rec.id
          // Se marcada inativa no backend, reativa.
          if (!rec.active) {
            await pb.collection('push_subscriptions').update(rec.id, { active: true })
          }
        } catch {
          // Não encontrada no backend: recria o registro.
          try {
            const subJson = existing.toJSON()
            const created = await pb
              .collection('push_subscriptions')
              .create<PushSubscriptionRecord>({
                user: userId,
                endpoint: subJson.endpoint,
                p256dh: subJson.keys?.p256dh || '',
                auth: subJson.keys?.auth || '',
                active: true,
              })
            subscriptionRecordIdRef.current = created.id
          } catch {
            // ignora erro de duplicidade/etc
          }
        }
      } else if (!existing) {
        subscriptionRecordIdRef.current = null
      }
    } catch {
      // SW não pronto ou indisponível
    }
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const requestNotificationPermission = useCallback(async (): Promise<PushPermission> => {
    if (!isPushSupported()) return 'denied'
    try {
      const result = await Notification.requestPermission()
      setPermission(result as PushPermission)
      return result as PushPermission
    } catch {
      return 'denied'
    }
  }, [])

  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported() || !userId) return false
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      let subscription = existing
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        })
      }

      const subJson = subscription.toJSON()
      const endpoint = subJson.endpoint
      const p256dh = subJson.keys?.p256dh || ''
      const auth = subJson.keys?.auth || ''

      // Upsert no backend: se já existe (mesmo endpoint + usuário), atualiza;
      // senão cria. Assim múltiplos logins no mesmo dispositivo não duplicam.
      let recId: string | null = null
      try {
        const rec = await pb
          .collection('push_subscriptions')
          .getFirstListItem<PushSubscriptionRecord>(
            `endpoint = "${endpoint}" && user = "${userId}"`,
          )
        await pb.collection('push_subscriptions').update(rec.id, {
          p256dh,
          auth,
          active: true,
        })
        recId = rec.id
      } catch {
        try {
          const created = await pb.collection('push_subscriptions').create<PushSubscriptionRecord>({
            user: userId,
            endpoint,
            p256dh,
            auth,
            active: true,
          })
          recId = created.id
        } catch (err) {
          // Pode ser unique constraint em endpoint (outro usuário) — ignora.
          console.warn('Falha ao salvar subscription no backend:', err)
        }
      }

      subscriptionRecordIdRef.current = recId
      setIsSubscribed(true)
      return true
    } catch (err) {
      console.error('Falha ao inscrever em push:', err)
      return false
    } finally {
      setLoading(false)
    }
  }, [userId])

  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) return false
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        await existing.unsubscribe()
      }

      // Marca como inativa (ou deleta) no backend.
      const recId = subscriptionRecordIdRef.current
      if (recId) {
        try {
          await pb.collection('push_subscriptions').update(recId, { active: false })
        } catch {
          // pode já ter sido removido
        }
        subscriptionRecordIdRef.current = null
      }

      setIsSubscribed(false)
      return true
    } catch (err) {
      console.error('Falha ao cancelar push:', err)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    permission,
    isSubscribed,
    loading,
    unsupported,
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
    refresh,
  }
}
