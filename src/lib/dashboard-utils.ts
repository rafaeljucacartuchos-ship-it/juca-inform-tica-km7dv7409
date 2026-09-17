import { ServiceOrder, StatusHistory, Payment, OrderStatus, Orcamento, User } from '@/types'

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
  amount?: number // Valor financeiro opcional em R$ (pt-BR)
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

/**
 * Retorna a data efetiva da O.S. para fins de dashboard:
 * - Se concluída ou fechada ('completed' ou 'closed'): usa a data do registro 'completed' no status_history,
 *   com fallback para o campo updated da O.S.
 * - Caso contrário (não concluída): usa a data de criação (created).
 */
export function getOrderEffectiveDate(
  order: ServiceOrder,
  history?: StatusHistory[],
): string | undefined {
  if (order.status === 'completed' || order.status === 'closed') {
    if (history && history.length > 0) {
      const recs = history.filter((h) => h.service_order === order.id && h.status === 'completed')
      const date = recs[recs.length - 1]?.created || order.updated
      if (date) return date
    }
    return order.updated || order.created
  }
  return order.created
}

/**
 * Verifica se a O.S. conta seu valor/resultado no período especificado:
 * Usa a data de conclusão (status_history 'completed' -> updated) se concluída/fechada,
 * ou a data de criação (created) se em aberto/outros status.
 */
export function isOrderInPeriodForValue(
  order: ServiceOrder,
  history: StatusHistory[] | undefined,
  start: string,
  end: string,
): boolean {
  const effectiveDate = getOrderEffectiveDate(order, history)
  return isDateInRange(effectiveDate, start, end)
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

export function isDateInRangeString(dateStr: string | undefined, start: string, end: string) {
  return isDateInRange(dateStr, start, end)
}

/**
 * Resolução do técnico de um orçamento:
 * 1) orcamento.responsavel_id (se houver)
 * 2) orcamento.id_usuario_criador (se criador tiver role technician)
 * 3) orcamento.expand?.responsavel_id?.id
 * 4) técnico da O.S. vinculada via id_os / expand.id_os
 */
export function getOrcamentoTechnicianId(
  orc: Orcamento,
  ordersMap?: Map<string, ServiceOrder>,
): string | undefined {
  if (orc.responsavel_id) return orc.responsavel_id
  if (orc.expand?.responsavel_id?.id) return orc.expand.responsavel_id.id
  if (orc.id_os) {
    if (ordersMap && ordersMap.has(orc.id_os)) {
      const so = ordersMap.get(orc.id_os)
      if (so?.technician) return so.technician
    }
    if (orc.expand?.id_os?.technician) {
      return orc.expand.id_os.technician
    }
  }
  return undefined
}

export interface TechnicianProductionRow {
  technicianId: string
  technicianName: string
  // (a) Ordens de Serviço
  osCriadas: number
  osConcluidas: number
  osValorTotal: number
  // (b) Orçamentos
  orcCriados: number
  orcAprovados: number
  orcPendentes: number
  orcRejeitados: number
  orcValorAprovados: number
}

export interface TechnicianProductionSummary {
  rows: TechnicianProductionRow[]
  totals: {
    osCriadas: number
    osConcluidas: number
    osValorTotal: number
    orcCriados: number
    orcAprovados: number
    orcPendentes: number
    orcRejeitados: number
    orcValorAprovados: number
  }
}

/**
 * Agrega resultado e produção por técnico no período selecionado.
 * Regra: técnicos com role='technician' (NUNCA admin/attendant).
 */
export function computeTechnicianProduction(
  technicians: User[],
  orders: ServiceOrder[],
  orcamentos: Orcamento[],
  history: StatusHistory[],
  start: string,
  end: string,
): TechnicianProductionSummary {
  // Apenas role='technician'
  const pureTechs = technicians.filter((t) => t.role === 'technician')

  const ordersMap = new Map<string, ServiceOrder>()
  for (const o of orders) {
    ordersMap.set(o.id, o)
  }

  const rows: TechnicianProductionRow[] = pureTechs.map((tech) => {
    // (a) O.S. do técnico
    const techOrders = orders.filter((o) => o.technician === tech.id)

    // O.S. criadas no período
    const createdOrders = techOrders.filter((o) => isDateInRange(o.created, start, end))
    const osCriadas = createdOrders.length

    // O.S. concluídas/fechadas no período
    const osConcluidas = techOrders.filter((o) => {
      if (o.status !== 'completed' && o.status !== 'closed') return false
      const recs = history.filter((h) => h.service_order === o.id && h.status === 'completed')
      const completedDate = recs[recs.length - 1]?.created || o.updated
      return isDateInRange(completedDate, start, end)
    }).length

    // Valor total das O.S. dele no período:
    // Conta na DATA DE CONCLUSÃO se concluída/fechada ('completed' ou 'closed');
    // senão na data de criação (created).
    const valueOrders = techOrders.filter((o) => isOrderInPeriodForValue(o, history, start, end))
    const osValorTotal = valueOrders.reduce((sum, o) => sum + (o.total || 0), 0)

    // (b) Orçamentos sem vínculo com O.S. do técnico no período (v0.0.230: orçamentos sem id_os)
    const techOrcamentosSemVinculo = orcamentos.filter((orc) => {
      // Orçamento COM O.S. vinculada NÃO entra mais neste bloco — nem na contagem, nem nas somas
      const temVinculoOs = Boolean(orc.id_os || orc.expand?.id_os)
      if (temVinculoOs) return false

      const techId = getOrcamentoTechnicianId(orc, ordersMap)
      return techId === tech.id && isDateInRange(orc.created, start, end)
    })

    const orcCriados = techOrcamentosSemVinculo.length
    // Aprovados: status 'aprovado' ou 'faturado'
    const orcAprovados = techOrcamentosSemVinculo.filter(
      (orc) => orc.status === 'aprovado' || orc.status === 'faturado',
    ).length
    // Pendentes: rascunho, enviado, aguardando_aprovacao
    const orcPendentes = techOrcamentosSemVinculo.filter(
      (orc) =>
        orc.status === 'rascunho' ||
        orc.status === 'enviado' ||
        orc.status === 'aguardando_aprovacao',
    ).length
    // Rejeitados: status 'rejeitado'
    const orcRejeitados = techOrcamentosSemVinculo.filter(
      (orc) => orc.status === 'rejeitado',
    ).length

    // Valor total dos orçamentos aprovados sem vínculo O.S.: soma de total_geral
    const orcValorAprovados = techOrcamentosSemVinculo
      .filter((orc) => orc.status === 'aprovado' || orc.status === 'faturado')
      .reduce((sum, orc) => sum + (orc.total_geral || 0), 0)

    return {
      technicianId: tech.id,
      technicianName: tech.name || 'Técnico',
      osCriadas,
      osConcluidas,
      osValorTotal,
      orcCriados,
      orcAprovados,
      orcPendentes,
      orcRejeitados,
      orcValorAprovados,
    }
  })

  // Ordena por nome
  rows.sort((a, b) => a.technicianName.localeCompare(b.technicianName))

  const totals = rows.reduce(
    (acc, r) => ({
      osCriadas: acc.osCriadas + r.osCriadas,
      osConcluidas: acc.osConcluidas + r.osConcluidas,
      osValorTotal: acc.osValorTotal + r.osValorTotal,
      orcCriados: acc.orcCriados + r.orcCriados,
      orcAprovados: acc.orcAprovados + r.orcAprovados,
      orcPendentes: acc.orcPendentes + r.orcPendentes,
      orcRejeitados: acc.orcRejeitados + r.orcRejeitados,
      orcValorAprovados: acc.orcValorAprovados + r.orcValorAprovados,
    }),
    {
      osCriadas: 0,
      osConcluidas: 0,
      osValorTotal: 0,
      orcCriados: 0,
      orcAprovados: 0,
      orcPendentes: 0,
      orcRejeitados: 0,
      orcValorAprovados: 0,
    },
  )

  return { rows, totals }
}

export const ORCAMENTO_STATUS_CONFIG = [
  { value: 'aprovado', label: 'Aprovado', color: '#10b981' },
  { value: 'enviado', label: 'Enviado', color: '#6366f1' },
  { value: 'rascunho', label: 'Rascunho', color: '#64748b' },
  { value: 'aguardando_aprovacao', label: 'Pendente', color: '#f59e0b' },
  { value: 'faturado', label: 'Faturado', color: '#8b5cf6' },
  { value: 'rejeitado', label: 'Rejeitado', color: '#ef4444' },
  { value: 'substituido', label: 'Substituído', color: '#94a3b8' },
] as const

/**
 * 3.b) Orçamentos por status no período (donut: máx 6 fatias e Outros)
 * Legenda: quantidade + valor R$ pt-BR + %
 */
export function computeOrcamentosStatusDistribution(
  orcamentos: Orcamento[],
  start: string,
  end: string,
): DonutSlice[] {
  const periodOrcs = orcamentos.filter((orc) => isDateInRange(orc.created, start, end))
  const totalCount = periodOrcs.length
  if (totalCount === 0) return []

  const groups = new Map<string, { count: number; amount: number; label: string; color: string }>()

  // Mapeamento normalizado
  for (const orc of periodOrcs) {
    const statusKey = orc.status
    let label: string = statusKey
    let color: string = '#94a3b8'

    if (statusKey === 'aprovado' || statusKey === 'faturado') {
      label = statusKey === 'faturado' ? 'Faturado' : 'Aprovado'
      color = statusKey === 'faturado' ? '#8b5cf6' : '#10b981'
    } else if (statusKey === 'rascunho') {
      label = 'Rascunho'
      color = '#64748b'
    } else if (statusKey === 'enviado') {
      label = 'Enviado'
      color = '#6366f1'
    } else if (statusKey === 'aguardando_aprovacao') {
      label = 'Pendente'
      color = '#f59e0b'
    } else if (statusKey === 'rejeitado') {
      label = 'Rejeitado'
      color = '#ef4444'
    } else if (statusKey === 'substituido') {
      label = 'Substituído'
      color = '#94a3b8'
    }

    const current = groups.get(statusKey) || { count: 0, amount: 0, label, color }
    current.count++
    current.amount += orc.total_geral || 0
    groups.set(statusKey, current)
  }

  const items = Array.from(groups.values()).sort((a, b) => b.count - a.count)

  if (items.length > 6) {
    const top5 = items.slice(0, 5)
    const rest = items.slice(5)
    const restCount = rest.reduce((s, r) => s + r.count, 0)
    const restAmount = rest.reduce((s, r) => s + r.amount, 0)

    const result: DonutSlice[] = top5.map((it) => ({
      name: it.label,
      value: it.count,
      amount: it.amount,
      color: it.color,
      percentage: Math.round((it.count / totalCount) * 100),
    }))

    if (restCount > 0) {
      result.push({
        name: 'Outros',
        value: restCount,
        amount: restAmount,
        color: '#94a3b8',
        percentage: Math.round((restCount / totalCount) * 100),
      })
    }
    return result
  }

  return items.map((it) => ({
    name: it.label,
    value: it.count,
    amount: it.amount,
    color: it.color,
    percentage: Math.round((it.count / totalCount) * 100),
  }))
}

/**
 * 3.c) Valor gerado por técnico (pizza comparando o valor das O.S. de cada técnico no período)
 * Legenda: quantidade de OSs + valor R$ pt-BR + %
 */
export function computeTechnicianValueDistribution(
  technicians: User[],
  orders: ServiceOrder[],
  start: string,
  end: string,
  history?: StatusHistory[],
): DonutSlice[] {
  const pureTechs = technicians.filter((t) => t.role === 'technician')
  const periodOrders = orders.filter((o) => isOrderInPeriodForValue(o, history, start, end))

  const techMap = new Map<string, string>()
  pureTechs.forEach((t) => techMap.set(t.id, t.name || 'Sem nome'))

  const techData = new Map<string, { count: number; amount: number }>()
  let unassignedCount = 0
  let unassignedAmount = 0

  for (const o of periodOrders) {
    const val = o.total || 0
    if (!o.technician || !techMap.has(o.technician)) {
      unassignedCount++
      unassignedAmount += val
    } else {
      const name = techMap.get(o.technician)!
      const cur = techData.get(name) || { count: 0, amount: 0 }
      cur.count++
      cur.amount += val
      techData.set(name, cur)
    }
  }

  const items: { name: string; count: number; amount: number }[] = []
  techData.forEach((data, name) => {
    items.push({ name, count: data.count, amount: data.amount })
  })

  // Ordenar decrescente pelo valor gerado
  items.sort((a, b) => b.amount - a.amount)

  if (unassignedAmount > 0 || unassignedCount > 0) {
    items.push({
      name: 'Não atribuídas',
      count: unassignedCount,
      amount: unassignedAmount,
    })
  }

  const totalAmount = items.reduce((s, it) => s + it.amount, 0)
  if (totalAmount === 0 && items.length === 0) return []

  let topItems = items
  let othersCount = 0
  let othersAmount = 0
  if (items.length > 6) {
    topItems = items.slice(0, 5)
    const rest = items.slice(5)
    othersCount = rest.reduce((s, it) => s + it.count, 0)
    othersAmount = rest.reduce((s, it) => s + it.amount, 0)
  }

  const result: DonutSlice[] = topItems.map((item, idx) => ({
    name: item.name,
    value: item.amount, // value é o montante para o arco da pizza
    amount: item.amount,
    color: item.name === 'Não atribuídas' ? '#cbd5e1' : TECH_PALETTE[idx % TECH_PALETTE.length],
    percentage: totalAmount > 0 ? Math.round((item.amount / totalAmount) * 100) : 0,
  }))

  if (othersAmount > 0 || othersCount > 0) {
    result.push({
      name: 'Outros',
      value: othersAmount,
      amount: othersAmount,
      color: '#94a3b8',
      percentage: totalAmount > 0 ? Math.round((othersAmount / totalAmount) * 100) : 0,
    })
  }

  return result
}

/**
 * 3.d) Resultado do período como donut:
 * Valor em O.S. vs Valor em Orçamentos Aprovados vs Orçamentos pendentes
 */
export function computePeriodResultDistribution(
  orders: ServiceOrder[],
  orcamentos: Orcamento[],
  start: string,
  end: string,
  history?: StatusHistory[],
): DonutSlice[] {
  const periodOrders = orders.filter((o) => isOrderInPeriodForValue(o, history, start, end))
  const periodOrcs = orcamentos.filter((orc) => isDateInRange(orc.created, start, end))

  const valorOS = periodOrders.reduce((sum, o) => sum + (o.total || 0), 0)
  const countOS = periodOrders.length

  const orcAprovados = periodOrcs.filter(
    (orc) => orc.status === 'aprovado' || orc.status === 'faturado',
  )
  const valorOrcAprovados = orcAprovados.reduce((sum, orc) => sum + (orc.total_geral || 0), 0)
  const countOrcAprovados = orcAprovados.length

  const orcPendentes = periodOrcs.filter(
    (orc) =>
      orc.status === 'rascunho' ||
      orc.status === 'enviado' ||
      orc.status === 'aguardando_aprovacao',
  )
  const valorOrcPendentes = orcPendentes.reduce((sum, orc) => sum + (orc.total_geral || 0), 0)
  const countOrcPendentes = orcPendentes.length

  const totalGeral = valorOS + valorOrcAprovados + valorOrcPendentes

  const slices: DonutSlice[] = [
    {
      name: 'Valores em O.S.',
      value: valorOS,
      amount: valorOS,
      color: '#3b82f6', // blue-500
      percentage: totalGeral > 0 ? Math.round((valorOS / totalGeral) * 100) : 0,
    },
    {
      name: 'Orçamentos Aprovados',
      value: valorOrcAprovados,
      amount: valorOrcAprovados,
      color: '#10b981', // emerald-500
      percentage: totalGeral > 0 ? Math.round((valorOrcAprovados / totalGeral) * 100) : 0,
    },
    {
      name: 'Orçamentos Pendentes',
      value: valorOrcPendentes,
      amount: valorOrcPendentes,
      color: '#f59e0b', // amber-500
      percentage: totalGeral > 0 ? Math.round((valorOrcPendentes / totalGeral) * 100) : 0,
    },
  ]

  // Se tudo for 0, retorna vazio para emptyMessage
  if (totalGeral === 0 && countOS === 0 && countOrcAprovados === 0 && countOrcPendentes === 0) {
    return []
  }

  return slices
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
