import { ServiceOrder, StatusHistory, Payment } from '@/types'

export type Period = 'today' | 'week' | 'month' | 'custom'

export const STATUS_CONFIG = [
  { value: 'open', label: 'Aberta', color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'in_progress', label: 'Em Andamento', color: 'text-purple-600', bg: 'bg-purple-50' },
  { value: 'waiting_parts', label: 'Aguardando Peças', color: 'text-amber-600', bg: 'bg-amber-50' },
  { value: 'completed', label: 'Concluída', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { value: 'closed', label: 'Fechada', color: 'text-slate-600', bg: 'bg-slate-50' },
  { value: 'cancelled', label: 'Cancelada', color: 'text-red-600', bg: 'bg-red-50' },
] as const

export function getPeriodRange(period: Period, customStart?: string, customEnd?: string) {
  const now = new Date()
  const todayStr = now.toISOString().substring(0, 10)
  switch (period) {
    case 'today':
      return { start: todayStr, end: todayStr }
    case 'week': {
      const day = now.getDay() || 7
      const monday = new Date(now)
      monday.setDate(now.getDate() - day + 1)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return {
        start: monday.toISOString().substring(0, 10),
        end: sunday.toISOString().substring(0, 10),
      }
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return {
        start: first.toISOString().substring(0, 10),
        end: last.toISOString().substring(0, 10),
      }
    }
    case 'custom':
      return { start: customStart || todayStr, end: customEnd || todayStr }
  }
}

function isDateInRange(dateStr: string | undefined, start: string, end: string) {
  if (!dateStr) return false
  const d = dateStr.substring(0, 10)
  return d >= start && d <= end
}

function formatDuration(ms: number) {
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  if (hours === 0) return `${minutes}min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}min`
}

export function computeBilling(payments: Payment[], start: string, end: string) {
  return payments
    .filter((p) => p.status === 'paid' && isDateInRange(p.paid_at, start, end))
    .reduce((sum, p) => sum + (p.amount || 0), 0)
}

export function countCompletedInPeriod(
  orders: ServiceOrder[],
  history: StatusHistory[],
  start: string,
  end: string,
) {
  return orders.filter((o) => {
    if (o.status !== 'completed' && o.status !== 'closed') return false
    const recs = history.filter((h) => h.service_order === o.id && h.status === 'completed')
    const completedDate = recs[recs.length - 1]?.created || o.updated
    return isDateInRange(completedDate, start, end)
  }).length
}

export function computeAverageServiceTime(
  orders: ServiceOrder[],
  history: StatusHistory[],
  start: string,
  end: string,
) {
  const completed = orders.filter((o) => o.status === 'completed' || o.status === 'closed')
  let totalDuration = 0
  let count = 0
  for (const order of completed) {
    const oh = history
      .filter((h) => h.service_order === order.id)
      .sort((a, b) => (a.created || '').localeCompare(b.created || ''))
    const startRec = oh.find((h) => h.status === 'in_progress')
    const completedRecs = oh.filter((h) => h.status === 'completed')
    const endRec = completedRecs[completedRecs.length - 1]
    const completedDate = endRec?.created || order.updated
    if (!isDateInRange(completedDate, start, end)) continue
    const startTime = startRec?.created || order.created
    const endTime = endRec?.created || order.updated
    if (!startTime || !endTime) continue
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime()
    if (duration > 0) {
      totalDuration += duration
      count++
    }
  }
  if (count === 0) return null
  return formatDuration(totalDuration / count)
}
