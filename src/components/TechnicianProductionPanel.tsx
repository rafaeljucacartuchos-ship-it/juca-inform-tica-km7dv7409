import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Wrench,
  CheckCircle2,
  Timer,
  DollarSign,
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
  ClipboardList,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/StatusBadge'
import { ServiceOrder, Payment, StatusHistory, User } from '@/types'
import {
  getTechPeriodRange,
  computeAverageServiceTime,
  countCompletedInPeriod,
  computeBilling,
  STATUS_PRIORITY_MAP,
  type TechPeriod,
} from '@/lib/dashboard-utils'

interface TechnicianProductionPanelProps {
  user: User
  orders: ServiceOrder[]
  payments: Payment[]
  history: StatusHistory[]
}

export function TechnicianProductionPanel({
  user,
  orders,
  payments,
  history,
}: TechnicianProductionPanelProps) {
  const [techPeriod, setTechPeriod] = useState<TechPeriod>('today')

  const techRange = useMemo(() => getTechPeriodRange(techPeriod), [techPeriod])

  // O.S. atribuídas ao técnico
  const myOrders = useMemo(() => {
    return orders.filter((o) => o.technician === user.id)
  }, [orders, user.id])

  // O.S. atribuídas a ele criadas no período selecionado
  const assignedInPeriod = useMemo(() => {
    return myOrders.filter((o) => {
      if (!o.created) return false
      const d = o.created.substring(0, 10)
      return d >= techRange.start && d <= techRange.end
    }).length
  }, [myOrders, techRange])

  // Concluídas pelo técnico no período (usando status_history status 'completed' + o.updated)
  const completedInPeriod = useMemo(() => {
    return countCompletedInPeriod(myOrders, history, techRange.start, techRange.end)
  }, [myOrders, history, techRange])

  // Tempo médio de atendimento dele no período
  const avgTime = useMemo(() => {
    return computeAverageServiceTime(myOrders, history, techRange.start, techRange.end)
  }, [myOrders, history, techRange])

  // Valor gerado: soma dos payments 'paid' das O.S. dele no período via paid_at
  const myOrderIds = useMemo(() => new Set(myOrders.map((o) => o.id)), [myOrders])

  const myPayments = useMemo(() => {
    return payments.filter((p) => myOrderIds.has(p.service_order))
  }, [payments, myOrderIds])

  const billingInPeriod = useMemo(() => {
    return computeBilling(myPayments, techRange.start, techRange.end)
  }, [myPayments, techRange])

  // O.S. dele do dia (criadas ou atualizadas hoje)
  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), [])

  const todayOrders = useMemo(() => {
    const list = myOrders.filter((o) => {
      const createdDate = o.created ? o.created.substring(0, 10) : ''
      const updatedDate = o.updated ? o.updated.substring(0, 10) : ''
      return createdDate === todayStr || updatedDate === todayStr
    })

    return list.sort((a, b) => {
      const pA = STATUS_PRIORITY_MAP[a.status] ?? 99
      const pB = STATUS_PRIORITY_MAP[b.status] ?? 99
      if (pA !== pB) return pA - pB
      const timeA = a.updated || a.created ? new Date(a.updated || a.created || '').getTime() : 0
      const timeB = b.updated || b.created ? new Date(b.updated || b.created || '').getTime() : 0
      return timeB - timeA
    })
  }, [myOrders, todayStr])

  return (
    <Card className="border-indigo-100 bg-gradient-to-br from-white via-indigo-50/20 to-slate-50/50 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-indigo-100/70 bg-white/70 backdrop-blur-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900">Minha Produção</CardTitle>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  Técnico
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Desempenho pessoal, ordens concluídas e faturamento gerado
              </p>
            </div>
          </div>

          {/* Seletor HOJE / ESTE MÊS / ESTE ANO */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs self-start sm:self-auto">
            {(
              [
                { id: 'today', label: 'Hoje' },
                { id: 'month', label: 'Este Mês' },
                { id: 'year', label: 'Este Ano' },
              ] as const
            ).map((tab) => (
              <Button
                key={tab.id}
                size="sm"
                variant={techPeriod === tab.id ? 'default' : 'ghost'}
                className={`h-8 text-xs font-bold transition-all ${
                  techPeriod === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs hover:bg-indigo-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setTechPeriod(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* 4 KPIs de Produtividade do Técnico */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Atribuídas
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Wrench className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                {assignedInPeriod}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">no período</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Concluídas
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-emerald-600 tracking-tight">
                {completedInPeriod}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">no período</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Tempo Médio
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <Timer className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold font-mono text-purple-700 tracking-tight">
                {avgTime || '—'}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">reparo</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Valor Gerado
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold font-mono text-amber-600 tracking-tight">
                R$ {billingInPeriod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">pago</span>
            </div>
          </div>
        </div>

        {/* Lista das O.S. dele do dia */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800">
                Minhas Ordens de Serviço do Dia ({todayOrders.length})
              </h3>
            </div>
            <Link
              to="/ordens"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
            >
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {todayOrders.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-slate-300 stroke-1" />
              <p className="text-xs font-medium">
                Nenhuma ordem movimentada ou criada por você hoje.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Suas tarefas atribuídas aparecerão listadas aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {todayOrders.map((o) => (
                <div
                  key={o.id}
                  className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded shrink-0">
                      {o.number}
                    </span>
                    <div className="min-w-0">
                      <Link
                        to={`/ordens/${o.id}`}
                        className="text-xs sm:text-sm font-bold text-slate-900 hover:text-indigo-600 truncate block"
                      >
                        {o.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span className="font-medium text-slate-700">
                          {o.expand?.customer?.razao_social ||
                            o.expand?.customer?.nome_fantasia ||
                            o.expand?.customer?.name ||
                            'Cliente'}
                        </span>
                        {o.equipment && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="truncate max-w-[200px]">{o.equipment}</span>
                          </>
                        )}
                        {o.attendance_time && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="inline-flex items-center gap-0.5 text-slate-600">
                              <Clock className="h-3 w-3" />
                              {o.attendance_time}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <StatusBadge status={o.status} />
                    <span className="text-xs font-mono font-bold text-slate-900">
                      R$ {(o.total || 0).toFixed(2)}
                    </span>
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                    >
                      <Link to={`/ordens/${o.id}`}>
                        Abrir <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
