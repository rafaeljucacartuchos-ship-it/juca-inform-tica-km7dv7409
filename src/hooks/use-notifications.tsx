import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { getServiceOrders } from '@/services/service_orders'
import { playNotificationSound, showBrowserNotification } from '@/lib/notification-sound'
import { ServiceOrder } from '@/types'

export interface AppNotification {
  id: string
  orderId: string
  orderNumber: string
  title: string
  customerName: string
  read: boolean
  createdAt: string
}

interface NotificationContextType {
  notifications: AppNotification[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearNotifications: () => void
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
  const [knownOrderIds, setKnownOrderIds] = useState<Set<string>>(new Set())
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')

  useEffect(() => {
    if (!user) {
      setNotifications([])
      setKnownOrderIds(new Set())
      return
    }
    try {
      const stored = localStorage.getItem(`notifications_${user.id}`)
      if (stored) setNotifications(JSON.parse(stored))
    } catch {
      /* parse error */
    }
    getServiceOrders(`technician = "${user.id}"`)
      .then((orders) => setKnownOrderIds(new Set(orders.map((o) => o.id))))
      .catch(() => {})
  }, [user])

  useEffect(() => {
    if (user) {
      localStorage.setItem(`notifications_${user.id}`, JSON.stringify(notifications.slice(0, 50)))
    }
  }, [notifications, user])

  const triggerNotification = useCallback((order: ServiceOrder) => {
    const customerName = order.expand?.customer?.name || 'Cliente'
    const notif: AppNotification = {
      id: `${order.id}_${Date.now()}`,
      orderId: order.id,
      orderNumber: order.number,
      title: order.title,
      customerName,
      read: false,
      createdAt: new Date().toISOString(),
    }
    setNotifications((prev) => [notif, ...prev].slice(0, 50))
    playNotificationSound()
    toast.info(`Nova OS atribuída: ${order.number}`, {
      description: `${order.title} — ${customerName}`,
    })
    showBrowserNotification(
      `Nova OS atribuída: ${order.number}`,
      `${order.title} — ${customerName}`,
    )
  }, [])

  useRealtime(
    'service_orders',
    (e) => {
      if (!user) return
      const record = e.record as unknown as ServiceOrder
      if (e.action === 'create' && record.technician === user.id) {
        triggerNotification(record)
        setKnownOrderIds((prev) => new Set(prev).add(record.id))
      } else if (e.action === 'update') {
        if (record.technician === user.id && !knownOrderIds.has(record.id)) {
          triggerNotification(record)
        }
        setKnownOrderIds((prev) => {
          const next = new Set(prev)
          if (record.technician === user.id) next.add(record.id)
          else next.delete(record.id)
          return next
        })
      }
    },
    !!user,
  )

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const clearNotifications = useCallback(() => setNotifications([]), [])

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
        markAsRead,
        markAllAsRead,
        clearNotifications,
        requestBrowserPermission,
        browserPermission,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
