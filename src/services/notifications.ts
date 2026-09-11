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

export const createNotification = async (data: {
  user: string
  title: string
  message?: string
  type: 'service_order' | 'appointment' | 'payment' | 'system'
  link?: string
}) => {
  return pb.collection('notifications').create<AppNotification>({
    ...data,
    read: false,
  })
}

/**
 * Cria uma notificação para atendentes e administradores do sistema.
 * Útil para avisos de pós-venda, resposta de cliente, etc.
 */
export const notifyStaffMembers = async (params: {
  title: string
  message: string
  type?: 'service_order' | 'appointment' | 'payment' | 'system'
  link?: string
}) => {
  try {
    const staffUsers = await pb.collection('users').getFullList({
      filter: 'role = "admin" || role = "attendant"',
    })
    const promises = staffUsers.map((u) =>
      pb.collection('notifications').create({
        user: u.id,
        title: params.title,
        message: params.message,
        type: params.type || 'system',
        read: false,
        link: params.link || '/pos-venda',
      }),
    )
    return await Promise.allSettled(promises)
  } catch (err) {
    console.error('Falha ao criar notificações para a equipe:', err)
    return []
  }
}
