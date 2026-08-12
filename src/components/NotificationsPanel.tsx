import { Wrench, Check, BellOff, BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AppNotification } from '@/hooks/use-notifications'

interface NotificationsPanelProps {
  notifications: AppNotification[]
  unreadCount: number
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onRequestPermission: () => void
  browserPermission: NotificationPermission | 'unsupported'
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Agora'
  if (min < 60) return `Há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Há ${h}h`
  return `Há ${Math.floor(h / 24)}d`
}

export function NotificationsPanel({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onRequestPermission,
  browserPermission,
}: NotificationsPanelProps) {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/50">
        <h3 className="text-xs font-semibold text-slate-800">Notificações</h3>
        {unreadCount > 0 && (
          <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
            {unreadCount} nova{unreadCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">Nenhuma notificação recebida.</p>
        ) : (
          notifications.slice(0, 20).map((n) => (
            <div
              key={n.id}
              className={cn(
                'flex gap-3 p-3 hover:bg-slate-50 transition-colors',
                !n.read && 'bg-indigo-50/40',
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Wrench className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 text-xs space-y-0.5">
                <p className="font-medium text-slate-800 truncate">Nova OS: {n.orderNumber}</p>
                <p className="text-slate-500 text-[11px] truncate">
                  {n.title} — {n.customerName}
                </p>
                <p className="text-[10px] text-slate-400">{formatRelativeTime(n.createdAt)}</p>
              </div>
              {!n.read && (
                <button
                  onClick={() => onMarkAsRead(n.id)}
                  className="self-center text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
      <div className="border-t border-slate-100 px-3 py-2 flex items-center justify-between gap-2">
        {browserPermission !== 'granted' && browserPermission !== 'unsupported' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRequestPermission}
            className="text-[11px] h-7 gap-1 text-slate-500"
          >
            <BellRing className="h-3 w-3" /> Ativar notificações
          </Button>
        ) : (
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            {browserPermission === 'granted' ? (
              <>
                <BellRing className="h-3 w-3" /> Notificações ativas
              </>
            ) : (
              <>
                <BellOff className="h-3 w-3" /> Não suportado
              </>
            )}
          </span>
        )}
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllAsRead}
            className="text-[11px] h-7 text-slate-500"
          >
            Marcar todas
          </Button>
        )}
      </div>
    </div>
  )
}
