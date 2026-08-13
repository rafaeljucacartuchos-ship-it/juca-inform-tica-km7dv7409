import pb from '@/lib/pocketbase/client'
import { AppNotification } from '@/types'

export const getNotifications = () =>
  pb.collection('notifications').getFullList<AppNotification>({
    sort: '-created',
  })

export const markNotificationAsRead = (id: string) =>
  pb.collection('notifications').update<AppNotification>(id, { read: true })

export const markAllNotificationsAsRead = async (userId: string) => {
  const unread = await pb.collection('notifications').getFullList<AppNotification>({
    filter: `user = "${userId}" && read = false`,
  })
  await Promise.all(unread.map((n) => pb.collection('notifications').update(n.id, { read: true })))
}
