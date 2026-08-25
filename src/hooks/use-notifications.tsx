import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { getNotifications, markAllNotificationsAsRead } from '@/services/notifications'
import { playNotificationSound, showBrowserNotification } from '@/lib/notification-sound'
import { AppNotification, ServiceOrder } from '@/types'

interface NotificationContextType {
  notifications: AppNotification[]
  unreadCount: number
  markAllAsRead: () => void
  requestBrowserPermission: () => Promise<void>
  browserPermission: NotificationPermission | 'unsupported'
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')

  const playedSoundIds = useRef<Set<string>>(new Set())
  // Track which service orders already had a customer signature, so we only
  // fire the alert on the transition (empty -> signed).
  const signedOrderIds = useRef<Set<string>>(new Set())

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([])
      return
    }
    try {
      const data = await getNotifications()
      data.forEach((n) => playedSoundIds.current.add(n.id))
      setNotifications(data)
    } catch {
      /* collection might not exist yet */
    }
  }, [user])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  useRealtime(
    'notifications',
    (e) => {
      if (!user) return
      const record = e.record as unknown as AppNotification
      if (e.action === 'create') {
        if (record.user === user.id) {
          setNotifications((prev) => [record, ...prev].slice(0, 50))
          if (record.title?.includes('Estoque Zerado')) {
            toast.error(record.title, { description: record.message })
          } else {
            toast.info(record.title, { description: record.message })
          }
          showBrowserNotification(record.title, record.message || '', record.id)

          if (
            (record.type === 'service_order' || record.type === 'system') &&
            !playedSoundIds.current.has(record.id)
          ) {
            playedSoundIds.current.add(record.id)
            playNotificationSound()
          }
        }
      } else if (e.action === 'update') {
        setNotifications((prev) => prev.map((n) => (n.id === record.id ? record : n)))
      } else if (e.action === 'delete') {
        setNotifications((prev) => prev.filter((n) => n.id !== record.id))
      }
    },
    !!user,
  )

  // Realtime: dispara alerta sonoro + toast + badge quando o cliente assina
  // uma O.S. (campo customer_signature passa de vazio para preenchido).
  useRealtime(
    'service_orders',
    (e) => {
      if (!user) return
      const record = e.record as unknown as ServiceOrder
      const sig = record.customer_signature
      const hasSig = Array.isArray(sig) ? sig.length > 0 : !!sig
      const orderId = record.id
      const wasSigned = signedOrderIds.current.has(orderId)
      if (hasSig) {
        if (!wasSigned) {
          signedOrderIds.current.add(orderId)
          // Som de alerta (mesmo mecanismo de nova O.S.)
          playNotificationSound()
          // Notificação do navegador
          showBrowserNotification(
            'Cliente assinou a O.S.',
            `O.S. #${record.number} foi assinada pelo cliente`,
            `signature-${orderId}`,
          )
          // Toast na tela
          toast.success('Cliente assinou a O.S.', {
            description: `O.S. #${record.number} foi assinada pelo cliente`,
          })
        }
      } else if (e.action === 'create') {
        // Nova O.S. ainda sem assinatura — apenas registra o estado inicial
        signedOrderIds.current.delete(orderId)
      }
    },
    !!user,
  )

  const markAllAsRead = useCallback(() => {
    if (!user) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    markAllNotificationsAsRead(user.id).catch(() => {})
  }, [user])

  const requestBrowserPermission = useCallback(async () => {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setBrowserPermission(result)
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAllAsRead,
        requestBrowserPermission,
        browserPermission,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
