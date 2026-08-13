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
import { useSoundPreferences } from '@/hooks/use-sound-preferences'
import { getNotifications, markAllNotificationsAsRead } from '@/services/notifications'
import { playNotificationSound, showBrowserNotification } from '@/lib/notification-sound'
import { AppNotification } from '@/types'

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
  const { soundEnabled } = useSoundPreferences()
  const soundEnabledRef = useRef(soundEnabled)
  soundEnabledRef.current = soundEnabled

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')

  const playedSoundIds = useRef<Set<string>>(new Set())

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
          toast.info(record.title, { description: record.message })
          showBrowserNotification(record.title, record.message || '', record.id)

          if (
            record.type === 'service_order' &&
            soundEnabledRef.current &&
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
