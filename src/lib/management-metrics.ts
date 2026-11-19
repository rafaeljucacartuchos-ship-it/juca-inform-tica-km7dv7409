export interface ManagementOrder { id: string; status: string; technician?: string }
export interface ManagementQuote { id: string; status: string; created?: string }
export interface ManagementPayment { id: string; status: string; amount: number; paid_at?: string }

export function periodStart(days: number, now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - Math.max(0, days - 1))
  return start
}

function inPeriod(value: string | undefined, start: Date, end: Date) {
  if (!value) return false
  const normalized = value.replace(' ', 'T')
  const date = new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : normalized + 'Z')
  return Number.isFinite(date.getTime()) && date >= start && date <= end
}

export function managementMetrics(
  orders: ManagementOrder[], quotes: ManagementQuote[], payments: ManagementPayment[],
  start: Date, end = new Date(),
) {
  const active = orders.filter((o) => !['completed', 'closed', 'cancelled'].includes(o.status))
  const periodQuotes = quotes.filter((q) => q.status !== 'substituido' && q.status !== 'rascunho' && inPeriod(q.created, start, end))
  const approved = periodQuotes.filter((q) => ['aprovado', 'faturado'].includes(q.status)).length
  const cents = (amount: number) => Number.isFinite(Number(amount)) ? Math.round(Number(amount) * 100) : 0
  return {
    activeOrders: active.length,
    waitingParts: active.filter((o) => o.status === 'waiting_parts').length,
    unassigned: active.filter((o) => !o.technician).length,
    quotes: periodQuotes.length,
    approved,
    conversion: periodQuotes.length ? Math.round(approved / periodQuotes.length * 100) : null,
    received: payments.filter((p) => p.status === 'paid' && inPeriod(p.paid_at, start, end)).reduce((s, p) => s + cents(p.amount), 0) / 100,
    pending: payments.filter((p) => p.status === 'pending').reduce((s, p) => s + cents(p.amount), 0) / 100,
    workload: Object.entries(active.reduce<Record<string, number>>((result, order) => {
      const key = order.technician || ''
      result[key] = (result[key] || 0) + 1
      return result
    }, {})).sort((a, b) => b[1] - a[1]),
  }
}
