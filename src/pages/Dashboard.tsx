import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Wrench,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  UserCheck,
  Timer,
  Loader2,
  FileDown,
  Search,
} from 'lucide-react'
import { ExportReportsModal } from '@/components/ExportReportsModal'
import { ExportOrdersListModal } from '@/components/ExportOrdersListModal'
import { DashboardProductSearchModal } from '@/components/DashboardProductSearchModal'
import { EvolutionCharts } from '@/components/EvolutionCharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KpiCard } from '@/components/KpiCard'
import { StatusBadge } from '@/components/StatusBadge'
import { ServiceOrder, User, Payment, StatusHistory } from '@/types'
import { getServiceOrders } from '@/services/service_orders'
import { getTechnicians } from '@/services/users'
import { getAllPayments } from '@/services/payments'
import { getAllStatusHistory } from '@/services/status_history'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  STATUS_CONFIG,
  getPeriodRange,
  computeBilling,
  countCompletedInPeriod,
  computeAverageServiceTime,
  countOrdersInPeriod,
  computeEvolutionData,
  type Period,
} from '@/lib/dashboard-utils'

export default function Dashboard() {
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [history, setHistory] = useState<StatusHistory[]>([])
  const [period, setPeriod] = useState<Period>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportOrdersOpen, setExportOrdersOpen] = useState(false)
  const [productSearchOpen, setProductSearchOpen] = useState(false)
  const { user } = useAuth()
  const isTech = user?.role === 'technician'

  const loadData = async () => {
    try {
      setError(null)
      const isTech = user?.role === 'technician'
      const techFilter = isTech && user?.id ? `technician = "${user.id}"` : ''
      const [so, tech, pay, hist] = await Promise.all([
        getServiceOrders(techFilter),
        getTechnicians(),
        getAllPayments(),
        getAllStatusHistory(),
      ])
      setOrders(so)
      setTechnicians(tech)
      if (isTech) {
        const orderIds = new Set(so.map((o) => o.id))
        setPayments(pay.filter((p) => orderIds.has(p.service_order)))
        setHistory(hist.filter((h) => orderIds.has(h.service_order)))
      } else {
        setPayments(pay)
        setHistory(hist)
      }
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
  useRealtime('products', loadData)

  const range = getPeriodRange(period, customStart, customEnd)
  const billing = computeBilling(payments, range.start, range.end)
  const completedCount = countCompletedInPeriod(orders, history, range.start, range.end)
  const avgTime = computeAverageServiceTime(orders, history, range.start, range.end)
  const evolutionData = computeEvolutionData(orders, payments, range.start, range.end)
  const periodOrderCount = countOrdersInPeriod(orders, range.start, range.end)
  const openCount = orders.filter((o) =>
    ['open', 'in_progress', 'waiting_parts'].includes(o.status),
  ).length

  const sortedTechnicians = [...technicians].sort((a, b) =>
    (a.name || '').localeCompare(b.name || ''),
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Botão de Busca de Produto no Topo do Dashboard */}
      <div className="flex items-center justify-between bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-xl p-3 sm:p-4 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 border border-white/20 backdrop-blur-xs">
            <Search className="h-5 w-5 text-indigo-200" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">
              Consulta Rápida de Estoque
            </h2>
            <p className="text-xs text-indigo-200 hidden sm:block">
              Pesquise produtos por nome, código SKU ou código de barras instantaneamente.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setProductSearchOpen(true)}
          className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-xs sm:text-sm h-9 sm:h-10 px-4 gap-2 shadow-xs shrink-0"
        >
          <Search className="h-4 w-4 text-indigo-600" />
          <span>🔍 Buscar Produto</span>
        </Button>
      </div>

      {/* Topo do Dashboard */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Visão Geral da Operação
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Painel consolidado de atendimentos, ordens de serviço e faturamento.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
            {(['today', 'week', 'month', 'custom'] as Period[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? 'default' : 'ghost'}
                className={`h-8 text-xs font-bold ${
                  period === p
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setPeriod(p)}
              >
                {{ today: 'Hoje', week: 'Semana', month: 'Mês', custom: 'Personalizado' }[p]}
              </Button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200">
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-auto h-8 text-xs font-medium"
              />
              <span className="text-xs text-slate-400 font-bold">até</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-auto h-8 text-xs font-medium"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
              className="gap-1.5 h-8 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <FileDown className="h-3.5 w-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Relatórios</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOrdersOpen(true)}
              className="gap-1.5 h-8 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <FileDown className="h-3.5 w-3.5 text-slate-600" />
              <span className="hidden sm:inline">Lista OS</span>
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {/* 2. Ordens de Serviço Recentes (Full Width) */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">
              Ordens de Serviço Recentes
            </CardTitle>
            <p className="text-[11px] text-slate-500 font-medium">
              Últimos atendimentos em andamento ou finalizados
            </p>
          </div>
          <Link
            to="/ordens"
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
          >
            Ver todas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Número</th>
                  <th className="py-2.5 px-4">Título</th>
                  <th className="py-2.5 px-4">Cliente</th>
                  <th className="py-2.5 px-4">Técnico</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.slice(0, 5).map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                      <Link to={`/ordens/${o.id}`}>{o.number}</Link>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{o.title}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {o.expand?.customer?.name || 'Cliente'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {o.expand?.technician?.name || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      R$ {(o.total || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                      Nenhuma ordem cadastrada no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 3. Carga dos Técnicos (Única seção independente full-width) */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-900">Carga dos Técnicos</CardTitle>
          <p className="text-[11px] text-slate-500 font-medium">
            Distribuição de OS ativas por profissional
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sortedTechnicians.map((t) => {
              const count = orders.filter(
                (o) => o.technician === t.id && o.status !== 'closed' && o.status !== 'cancelled',
              ).length
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200/90 p-3 bg-white shadow-2xs hover:border-indigo-200 transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 border border-indigo-200">
                    <UserCheck className="h-4.5 w-4.5 text-indigo-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 truncate">{t.name}</h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {count} {count === 1 ? 'ordem ativa' : 'ordens ativas'}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0 ${
                      count > 3
                        ? 'bg-amber-100 text-amber-800'
                        : count > 0
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </div>
              )
            })}
            {sortedTechnicians.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6 font-medium col-span-full">
                Nenhum técnico cadastrado.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. Resultados Resumidos (KPIs) */}
      <div className="space-y-3">
        {/* 4 Cards de Destaque / KPIs */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Ordens Abertas"
            value={openCount}
            icon={Wrench}
            colorClass="text-blue-600"
            bgClass="bg-blue-100"
          />
          <KpiCard
            title="O.S Concluídas"
            value={completedCount}
            icon={CheckCircle2}
            colorClass="text-emerald-600"
            bgClass="bg-emerald-100"
          />
          <KpiCard
            title="Tempo Médio de Reparo"
            value={avgTime || '—'}
            icon={Timer}
            colorClass="text-purple-600"
            bgClass="bg-purple-100"
          />
          <KpiCard
            title="Faturamento do Período"
            value={`R$ ${billing.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            colorClass="text-amber-600"
            bgClass="bg-amber-100"
          />
        </div>

        {/* 6 Mini-Cards dos Status de O.S */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {STATUS_CONFIG.map((s) => (
            <Card key={s.value} className={`border-slate-200/80 shadow-2xs ${s.bg}`}>
              <CardContent className="p-3.5">
                <p className={`text-2xl font-bold ${s.color}`}>
                  {orders.filter((o) => o.status === s.value).length}
                </p>
                <p className="text-xs text-slate-700 font-bold mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 5. Gráficos */}
      <EvolutionCharts
        data={evolutionData}
        totalOrders={periodOrderCount}
        totalRevenue={billing}
        showRevenue={!isTech}
      />

      <ExportReportsModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        orders={orders}
        payments={payments}
        technicians={technicians}
        history={history}
      />

      <ExportOrdersListModal
        open={exportOrdersOpen}
        onOpenChange={setExportOrdersOpen}
        orders={orders}
        payments={payments}
      />

      <DashboardProductSearchModal open={productSearchOpen} onOpenChange={setProductSearchOpen} />
    </div>
  )
}
