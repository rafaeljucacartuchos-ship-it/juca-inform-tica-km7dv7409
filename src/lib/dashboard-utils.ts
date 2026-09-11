import { ServiceOrder, StatusHistory, Payment, OrderStatus } from '@/types'

export type Period = 'today' | 'week' | 'month' | 'custom'
export type TechPeriod = 'today' | 'month' | 'year'

export const STATUS_PRIORITY_MAP: Record<OrderStatus, number> = {
  aguardando_orcamento: 1,
  orcamento_enviado: 2,
  orcamento_aprovado: 3,
  open: 4,
  in_progress: 5,
  paused: 6,
  waiting_parts: 7,
  completed: 8,
  closed: 9,
  orcamento_rejeitado: 10,
  cancelled: 11,
}

export const STATUS_CONFIG = [
  { value: 'open', label: 'Aberta', color: 'text-blue-600', bg: 'bg-blue-50' },
  {
    value: 'aguardando_orcamento',
    label: 'Aguardando Orçamento',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
  },
  {
    value: 'orcamento_enviado',
    label: 'Orçamento Enviado',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
  {
    value: 'orcamento_aprovado',
    label: 'Orçamento Aprovado',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  { value: 'in_progress', label: 'Em Andamento', color: 'text-purple-600', bg: 'bg-purple-50' },
  { value: 'paused', label: 'Pausada', color: 'text-orange-600', bg: 'bg-orange-50' },
  { value: 'waiting_parts', label: 'Aguardando Peças', color: 'text-amber-600', bg: 'bg-amber-50' },
  { value: 'completed', label: 'Concluída', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { value: 'closed', label: 'Fechada', color: 'text-slate-600', bg: 'bg-slate-50' },
  {
    value: 'orcamento_rejeitado',
    label: 'Orçamento Rejeitado',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
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

export function getTechPeriodRange(period: TechPeriod) {
  const now = new Date()
  const todayStr = now.toISOString().substring(0, 10)
  switch (period) {
    case 'today':
      return { start: todayStr, end: todayStr }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return {
        start: first.toISOString().substring(0, 10),
        end: last.toISOString().substring(0, 10),
      }
    }
    case 'year': {
      const first = new Date(now.getFullYear(), 0, 1)
      const last = new Date(now.getFullYear(), 11, 31)
      return {
        start: first.toISOString().substring(0, 10),
        end: last.toISOString().substring(0, 10),
      }
    }
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

export function formatCurrencyBRL(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function computeBilling(payments: Payment[], start: string, end: string) {
  return payments
    .filter((p) => p.status === 'paid' && isDateInRange(p.paid_at || p.created, start, end))
    .reduce((sum, p) => sum + (p.amount || 0), 0)
}

export interface FinancialSummary {
  recebido: number
  aReceber: number
  ticketMedio: number
  paidOrdersCount: number
  growthPct: number | null
}

export function computeFinancialSummary(
  payments: Payment[],
  start: string,
  end: string,
  period: Period,
): FinancialSummary {
  const currentPaid = payments.filter(
    (p) => p.status === 'paid' && isDateInRange(p.paid_at || p.created, start, end),
  )
  const recebido = currentPaid.reduce((sum, p) => sum + (p.amount || 0), 0)

  // 'A Receber' = soma dos pagamentos status='pending'
  const pendingPayments = payments.filter((p) => p.status === 'pending')
  const aReceber = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0)

  // Nº de O.S. distintas pagas no período
  const paidOrdersSet = new Set(
    currentPaid.map((p) => p.service_order).filter((id): id is string => Boolean(id)),
  )
  const paidOrdersCount = paidOrdersSet.size || currentPaid.length
  const ticketMedio = paidOrdersCount > 0 ? recebido / paidOrdersCount : 0

  // Período anterior para calcular variação %
  const currentStartDate = new Date(start + 'T00:00:00')
  const currentEndDate = new Date(end + 'T23:59:59')
  const durationMs = currentEndDate.getTime() - currentStartDate.getTime()

  const prevEndDate = new Date(currentStartDate.getTime() - 1)
  const prevStartDate = new Date(prevEndDate.getTime() - durationMs)
  const prevStartStr = prevStartDate.toISOString().substring(0, 10)
  const prevEndStr = prevEndDate.toISOString().substring(0, 10)

  const prevPaid = payments.filter(
    (p) => p.status === 'paid' && isDateInRange(p.paid_at || p.created, prevStartStr, prevEndStr),
  )
  const prevRecebido = prevPaid.reduce((sum, p) => sum + (p.amount || 0), 0)

  let growthPct: number | null = null
  if (prevRecebido > 0) {
    growthPct = Math.round(((recebido - prevRecebido) / prevRecebido) * 100)
  } else if (recebido > 0 && prevRecebido === 0) {
    growthPct = 100
  }

  return {
    recebido,
    aReceber,
    ticketMedio,
    paidOrdersCount,
    growthPct,
  }
}

export interface DonutSlice {
  name: string
  value: number
  color: string
  percentage: number
}

const STATUS_COLOR_MAP: Record<string, string> = {
  open: '#3b82f6', // blue-500
  aguardando_orcamento: '#06b6d4', // cyan-500
  orcamento_enviado: '#6366f1', // indigo-500
  orcamento_aprovado: '#10b981', // emerald-500
  in_progress: '#a855f7', // purple-500
  paused: '#f97316', // orange-500
  waiting_parts: '#f59e0b', // amber-500
  completed: '#059669', // emerald-600
  closed: '#64748b', // slate-500
  orcamento_rejeitado: '#e11d48', // rose-600
  cancelled: '#ef4444', // red-500
}

export function computeStatusDistribution(orders: ServiceOrder[]): DonutSlice[] {
  const counts = new Map<string, number>()
  for (const o of orders) {
    counts.set(o.status, (counts.get(o.status) || 0) + 1)
  }

  const total = orders.length
  if (total === 0) return []

  // Agrupamento dos status mais expressivos
  const groupedList: { status: string; label: string; count: number; color: string }[] = []

  for (const cfg of STATUS_CONFIG) {
    const count = counts.get(cfg.value) || 0
    if (count > 0) {
      groupedList.push({
        status: cfg.value,
        label: cfg.label,
        count,
        color: STATUS_COLOR_MAP[cfg.value] || '#94a3b8',
      })
    }
  }

  // Ordenar decrescente
  groupedList.sort((a, b) => b.count - a.count)

  // Máximo 5 fatias principais + Outros
  if (groupedList.length > 6) {
    const top5 = groupedList.slice(0, 5)
    const rest = groupedList.slice(5)
    const restSum = rest.reduce((s, r) => s + r.count, 0)
    const result: DonutSlice[] = top5.map((item) => ({
      name: item.label,
      value: item.count,
      color: item.color,
      percentage: Math.round((item.count / total) * 100),
    }))
    if (restSum > 0) {
      result.push({
        name: 'Outros',
        value: restSum,
        color: '#94a3b8',
        percentage: Math.round((restSum / total) * 100),
      })
    }
    return result
  }

  return groupedList.map((item) => ({
    name: item.label,
    value: item.count,
    color: item.color,
    percentage: Math.round((item.count / total) * 100),
  }))
}

const TECH_PALETTE = [
  '#4f46e5', // indigo-600
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // purple-500
  '#ec4899', // pink-500
]

export function computeTechnicianDistribution(
  orders: ServiceOrder[],
  technicians: { id: string; name?: string }[],
): DonutSlice[] {
  // Apenas O.S. ativas: não fechadas e não canceladas
  const activeOrders = orders.filter((o) => o.status !== 'closed' && o.status !== 'cancelled')
  const totalActive = activeOrders.length
  if (totalActive === 0) return []

  const techMap = new Map<string, string>()
  technicians.forEach((t) => {
    techMap.set(t.id, t.name || 'Sem nome')
  })

  const techCounts = new Map<string, number>()
  let unassignedCount = 0

  for (const o of activeOrders) {
    if (!o.technician || !techMap.has(o.technician)) {
      unassignedCount++
    } else {
      const name = techMap.get(o.technician)!
      techCounts.set(name, (techCounts.get(name) || 0) + 1)
    }
  }

  const items: { name: string; count: number }[] = []
  techCounts.forEach((count, name) => {
    items.push({ name, count })
  })

  items.sort((a, b) => b.count - a.count)

  if (unassignedCount > 0) {
    items.push({ name: 'Não atribuídas', count: unassignedCount })
  }

  // Se mais que 6 fatias, agrupar em Outros
  let topItems = items
  let othersCount = 0
  if (items.length > 6) {
    topItems = items.slice(0, 5)
    othersCount = items.slice(5).reduce((s, it) => s + it.count, 0)
  }

  const result: DonutSlice[] = topItems.map((item, idx) => ({
    name: item.name,
    value: item.count,
    color: item.name === 'Não atribuídas' ? '#cbd5e1' : TECH_PALETTE[idx % TECH_PALETTE.length],
    percentage: Math.round((item.count / totalActive) * 100),
  }))

  if (othersCount > 0) {
    result.push({
      name: 'Outros',
      value: othersCount,
      color: '#94a3b8',
      percentage: Math.round((othersCount / totalActive) * 100),
    })
  }

  return result
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

export function countOrdersInPeriod(orders: ServiceOrder[], start: string, end: string) {
  return orders.filter((o) => isDateInRange(o.created, start, end)).length
}

export interface EvolutionDataPoint {
  label: string
  orders: number
  revenue: number
}

export function computeEvolutionData(
  orders: ServiceOrder[],
  payments: Payment[],
  start: string,
  end: string,
): EvolutionDataPoint[] {
  const startDate = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T23:59:59')
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1
  const useWeeks = totalDays > 31

  const buckets = new Map<string, { orders: number; revenue: number }>()

  const resolveBucket = (dateStr: string | undefined): string | null => {
    if (!dateStr) return null
    const d = new Date(dateStr.substring(0, 10) + 'T00:00:00')
    if (d < startDate || d > endDate) return null
    if (useWeeks) {
      const dayOfWeek = d.getDay() || 7
      const monday = new Date(d)
      monday.setDate(d.getDate() - dayOfWeek + 1)
      return monday.toISOString().substring(0, 10)
    }
    return d.toISOString().substring(0, 10)
  }

  for (const order of orders) {
    const key = resolveBucket(order.created)
    if (!key) continue
    const b = buckets.get(key) || { orders: 0, revenue: 0 }
    b.orders++
    buckets.set(key, b)
  }

  for (const payment of payments) {
    if (payment.status !== 'paid') continue
    const key = resolveBucket(payment.paid_at || payment.created)
    if (!key) continue
    const b = buckets.get(key) || { orders: 0, revenue: 0 }
    b.revenue += payment.amount || 0
    buckets.set(key, b)
  }

  const result: EvolutionDataPoint[] = []
  const cursor = new Date(startDate)
  while (cursor <= endDate) {
    let key: string
    let label: string
    if (useWeeks) {
      const dayOfWeek = cursor.getDay() || 7
      const monday = new Date(cursor)
      monday.setDate(cursor.getDate() - dayOfWeek + 1)
      key = monday.toISOString().substring(0, 10)
      label = monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      cursor.setDate(cursor.getDate() + 7)
    } else {
      key = cursor.toISOString().substring(0, 10)
      label = cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      cursor.setDate(cursor.getDate() + 1)
    }
    const b = buckets.get(key)
    result.push({
      label,
      orders: b?.orders || 0,
      revenue: b?.revenue || 0,
    })
  }

  return result
}
