import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Wrench,
  Calendar,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Clock,
  UserCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/KpiCard'
import { ServiceOrder, Appointment, User } from '@/types'
import { getServiceOrders } from '@/services/service_orders'
import { getAppointments } from '@/services/appointments'
import { getTechnicians } from '@/services/users'
import { getAllPayments } from '@/services/payments'
import { useRealtime } from '@/hooks/use-realtime'

export default function Dashboard() {
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const [monthBilling, setMonthBilling] = useState(0)

  const loadData = async () => {
    try {
      const [soData, apptData, techData, payData] = await Promise.all([
        getServiceOrders(),
        getAppointments(),
        getTechnicians(),
        getAllPayments(),
      ])
      setOrders(soData)
      setAppointments(apptData)
      setTechnicians(techData)

      const totalPaid = payData
        .filter((p) => p.status === 'paid')
        .reduce((sum, p) => sum + (p.amount || 0), 0)
      setMonthBilling(totalPaid)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('service_orders', loadData)
  useRealtime('appointments', loadData)
  useRealtime('payments', loadData)

  const openOrdersCount = orders.filter(
    (o) => o.status === 'open' || o.status === 'in_progress' || o.status === 'waiting_parts',
  ).length
  const todayStr = new Date().toISOString().substring(0, 10)
  const todayAppts = appointments.filter((a) => a.date?.substring(0, 10) === todayStr)
  const completedTodayCount = orders.filter(
    (o) => o.status === 'completed' && o.updated?.substring(0, 10) === todayStr,
  ).length

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Aberta</Badge>
      case 'in_progress':
        return (
          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Em Andamento</Badge>
        )
      case 'waiting_parts':
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Aguardando Peças</Badge>
        )
      case 'completed':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Concluída</Badge>
        )
      case 'closed':
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Fechada</Badge>
      default:
        return <Badge variant="outline">Cancelada</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Visão Geral da Operação
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Acompanhe ordens de serviço, agendamentos técnicos e desempenho em tempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Ordens Abertas"
          value={openOrdersCount}
          icon={Wrench}
          trend="+12%"
          colorClass="text-blue-600"
          bgClass="bg-blue-100"
        />
        <KpiCard
          title="Agendamentos Hoje"
          value={todayAppts.length}
          icon={Calendar}
          trend="No prazo"
          colorClass="text-purple-600"
          bgClass="bg-purple-100"
        />
        <KpiCard
          title="Concluídas Hoje"
          value={completedTodayCount}
          icon={CheckCircle2}
          trend="+5%"
          colorClass="text-emerald-600"
          bgClass="bg-emerald-100"
        />
        <KpiCard
          title="Faturamento do Mês"
          value={`R$ ${monthBilling.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          trend="+18%"
          colorClass="text-amber-600"
          bgClass="bg-amber-100"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-bold text-slate-900">
              Ordens de Serviço Recentes
            </CardTitle>
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
                        {o.expand?.technician?.name || 'Não atribuído'}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(o.status)}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        R$ {(o.total || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        Nenhuma ordem de serviço cadastrada.
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
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-semibold text-xs">
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
          <CardTitle className="text-sm font-bold text-slate-900">
            Carga e Alocação dos Técnicos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {technicians.map((t) => {
              const techOrdersCount = orders.filter(
                (o) => o.technician === t.id && o.status !== 'closed' && o.status !== 'cancelled',
              ).length
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 bg-white shadow-xs"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                    <UserCheck className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 truncate">{t.name}</h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {techOrdersCount} {techOrdersCount === 1 ? 'ordem ativa' : 'ordens ativas'}
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
