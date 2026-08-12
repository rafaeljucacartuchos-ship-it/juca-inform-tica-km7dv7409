import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Wrench,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Clock,
  UserCheck,
  Timer,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KpiCard } from '@/components/KpiCard'
import { StatusBadge } from '@/components/StatusBadge'
import { ServiceOrder, Appointment, User, Payment, StatusHistory } from '@/types'
import { getServiceOrders } from '@/services/service_orders'
import { getAppointments } from '@/services/appointments'
import { getTechnicians } from '@/services/users'
import { getAllPayments } from '@/services/payments'
import { getAllStatusHistory } from '@/services/status_history'
import { useRealtime } from '@/hooks/use-realtime'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  STATUS_CONFIG,
  getPeriodRange,
  computeBilling,
  countCompletedInPeriod,
  computeAverageServiceTime,
  type Period,
} from '@/lib/dashboard-utils'

export default function Dashboard() {
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [history, setHistory] = useState<StatusHistory[]>([])
  const [period, setPeriod] = useState<Period>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setError(null)
      const [so, appt, tech, pay, hist] = await Promise.all([
        getServiceOrders(),
        getAppointments(),
        getTechnicians(),
        getAllPayments(),
        getAllStatusHistory(),
      ])
      setOrders(so)
      setAppointments(appt)
      setTechnicians(tech)
      setPayments(pay)
      setHistory(hist)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('service_orders', loadData)
  useRealtime('payments', loadData)
  useRealtime('status_history', loadData)

  const range = getPeriodRange(period, customStart, customEnd)
  const billing = computeBilling(payments, range.start, range.end)
  const completedCount = countCompletedInPeriod(orders, history, range.start, range.end)
  const avgTime = computeAverageServiceTime(orders, history, range.start, range.end)
  const openCount = orders.filter((o) =>
    ['open', 'in_progress', 'waiting_parts'].includes(o.status),
  ).length
  const todayStr = new Date().toISOString().substring(0, 10)
  const todayAppts = appointments.filter((a) => a.date?.substring(0, 10) === todayStr)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Visão Geral da Operação
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Indicadores financeiros e operacionais em tempo real.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['today', 'week', 'month', 'custom'] as Period[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? 'default' : 'outline'}
              className={period === p ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
              onClick={() => setPeriod(p)}
            >
              {{ today: 'Hoje', week: 'Semana', month: 'Mês', custom: 'Personalizado' }[p]}
            </Button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-auto h-8 text-xs"
              />
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-auto h-8 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Ordens Abertas"
          value={openCount}
          icon={Wrench}
          colorClass="text-blue-600"
          bgClass="bg-blue-100"
        />
        <KpiCard
          title="OSs Concluídas"
          value={completedCount}
          icon={CheckCircle2}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-100"
        />
        <KpiCard
          title="Tempo Médio"
          value={avgTime || '—'}
          icon={Timer}
          colorClass="text-purple-600"
          bgClass="bg-purple-100"
        />
        <KpiCard
          title="Faturamento"
          value={`R$ ${billing.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          colorClass="text-amber-600"
          bgClass="bg-amber-100"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATUS_CONFIG.map((s) => (
          <Card key={s.value} className={`border-slate-200/80 shadow-sm ${s.bg}`}>
            <CardContent className="p-4">
              <p className={`text-2xl font-bold ${s.color}`}>
                {orders.filter((o) => o.status === s.value).length}
              </p>
              <p className="text-xs text-slate-600 font-medium">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-bold text-slate-900">Ordens Recentes</CardTitle>
            <Link
              to="/ordens"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-y border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Número</th>
                    <th className="py-2.5 px-4">Cliente</th>
                    <th className="py-2.5 px-4">Técnico</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.slice(0, 5).map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-indigo-600">
                        <Link to={`/ordens/${o.id}`}>{o.number}</Link>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {o.expand?.customer?.name || 'Cliente'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {o.expand?.technician?.name || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        R$ {(o.total || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        Nenhuma ordem cadastrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-bold text-slate-900">Visitas de Hoje</CardTitle>
            <Link
              to="/agendamentos"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Agenda
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayAppts.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 bg-slate-50/50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0 text-xs space-y-0.5">
                  <p className="font-semibold text-slate-900 truncate">
                    {a.expand?.customer?.name || 'Cliente'}
                  </p>
                  <p className="text-slate-500 font-mono text-[11px]">
                    {a.start_time} - {a.end_time || '18:00'}
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    {a.expand?.technician?.name ? `Técnico: ${a.expand.technician.name}` : ''}
                  </p>
                </div>
              </div>
            ))}
            {todayAppts.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">
                Nenhum agendamento para hoje.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-slate-900">Carga dos Técnicos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {technicians.map((t) => {
              const count = orders.filter(
                (o) => o.technician === t.id && o.status !== 'closed' && o.status !== 'cancelled',
              ).length
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 bg-white shadow-xs"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 border border-slate-200">
                    <UserCheck className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 truncate">{t.name}</h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {count} {count === 1 ? 'ordem ativa' : 'ordens ativas'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
