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
  Calendar,
  TrendingUp,
} from 'lucide-react'
import { ExportReportsModal } from '@/components/ExportReportsModal'
import { ExportOrdersListModal } from '@/components/ExportOrdersListModal'
import { DashboardProductSearchModal } from '@/components/DashboardProductSearchModal'
import { DashboardDonutCard } from '@/components/DashboardDonutCard'
import { FinancialResultCard } from '@/components/FinancialResultCard'
import { EvolutionCharts } from '@/components/EvolutionCharts'
import { TechnicianProductionPanel } from '@/components/TechnicianProductionPanel'
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
  STATUS_PRIORITY_MAP,
  getPeriodRange,
  computeBilling,
  computeFinancialSummary,
  computeStatusDistribution,
  computeTechnicianDistribution,
  countCompletedInPeriod,
  computeAverageServiceTime,
  countOrdersInPeriod,
  computeEvolutionData,
  type Period,
} from '@/lib/dashboard-utils'

function getGreeting(name?: string) {
  const hour = new Date().getHours()
  let greet = 'Bom dia'
  if (hour >= 12 && hour < 18) {
    greet = 'Boa tarde'
  } else if (hour >= 18 || hour < 5) {
    greet = 'Boa noite'
  }

  const firstName = name?.trim()?.split(' ')?.[0] || 'Usuário'
  return `${greet}, ${firstName}`
}

function getTodayFormatted() {
  const d = new Date()
  const formatted = d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoje',
  week: 'Esta Semana',
  month: 'Este Mês',
  custom: 'Personalizado',
}

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
      const isTechRole = user?.role === 'technician'
      const techFilter = isTechRole && user?.id ? `technician = "${user.id}"` : ''
      const [so, rawTechs, pay, hist] = await Promise.all([
        getServiceOrders(techFilter),
        getTechnicians(),
        getAllPayments(),
        getAllStatusHistory(),
      ])

      // Regra 6: Listar SOMENTE usuários role='technician' (FABIO, RAFAEL, ROBERT, JOÃO VICTOR, etc.)
      // NUNCA incluir role='admin' nem role='attendant' na carga/atendimentos
      const pureTechs = rawTechs.filter((t) => t.role === 'technician')

      setOrders(so)
      setTechnicians(pureTechs)

      if (isTechRole) {
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
    ['open', 'in_progress', 'paused', 'waiting_parts'].includes(o.status),
  ).length

  // Resultado financeiro estruturado
  const financialSummary = useMemo(() => {
    return computeFinancialSummary(payments, range.start, range.end, period)
  }, [payments, range.start, range.end, period])

  // Distribuição de O.S. por status (gráfico de pizza)
  const statusDistribution = useMemo(() => {
    return computeStatusDistribution(orders)
  }, [orders])

  // Distribuição da carga por técnico (O.S. ativas por técnico em pizza/donut)
  const techDistribution = useMemo(() => {
    return computeTechnicianDistribution(orders, technicians)
  }, [orders, technicians])

  const sortedTechnicians = useMemo(() => {
    return [...technicians].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [technicians])

  // Métricas por técnico para os cards da seção de Carga dos Técnicos
  const techMetrics = useMemo(() => {
    const map = new Map<
      string,
      {
        activeCount: number
        completedCount: number
        billing: number
      }
    >()

    const ordersByTech = new Map<string, ServiceOrder[]>()
    for (const o of orders) {
      if (!o.technician) continue
      const list = ordersByTech.get(o.technician) || []
      list.push(o)
      ordersByTech.set(o.technician, list)
    }

    for (const t of technicians) {
      const techOrders = ordersByTech.get(t.id) || []
      const activeCount = techOrders.filter(
        (o) => o.status !== 'closed' && o.status !== 'cancelled',
      ).length

      const completedInPer = countCompletedInPeriod(techOrders, history, range.start, range.end)

      const techOrderIds = new Set(techOrders.map((o) => o.id))
      const techPayments = payments.filter((p) => techOrderIds.has(p.service_order))
      const techBilling = computeBilling(techPayments, range.start, range.end)

      map.set(t.id, {
        activeCount,
        completedCount: completedInPer,
        billing: techBilling,
      })
    }

    return map
  }, [technicians, orders, history, payments, range.start, range.end])

  const sortedRecentOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const pA = STATUS_PRIORITY_MAP[a.status] ?? 99
      const pB = STATUS_PRIORITY_MAP[b.status] ?? 99
      if (pA !== pB) {
        return pA - pB
      }
      const timeA = a.created ? new Date(a.created).getTime() : 0
      const timeB = b.created ? new Date(b.created).getTime() : 0
      return timeB - timeA
    })
  }, [orders])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Cabeçalho Moderno e Limpo com Saudação, Data e Ações Discretas */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {getGreeting(user?.name)}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs sm:text-sm text-muted-foreground font-medium">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span>{getTodayFormatted()}</span>
            <span className="text-slate-300">•</span>
            <span>JUCA INFORMÁTICA</span>
          </div>
        </div>

        {/* Botões discretos de Estoque e Relatórios no cabeçalho */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setProductSearchOpen(true)}
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs font-semibold gap-1.5 border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 shadow-2xs"
          >
            <Search className="h-3.5 w-3.5 text-indigo-600" />
            <span>Consultar Estoque</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(true)}
            className="gap-1.5 h-9 px-3 text-xs font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-2xs"
          >
            <FileDown className="h-3.5 w-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Relatórios</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportOrdersOpen(true)}
            className="gap-1.5 h-9 px-3 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <FileDown className="h-3.5 w-3.5 text-slate-600" />
            <span className="hidden sm:inline">Lista OS</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 shadow-2xs">
          {error}
        </div>
      )}

      {/* 2. PAINEL DO TÉCNICO ("MINHA PRODUÇÃO") — visível quando o usuário logado é técnico */}
      {isTech && user && (
        <TechnicianProductionPanel
          user={user}
          orders={orders}
          payments={payments}
          history={history}
        />
      )}

      {/* 3. BARRA DE FILTRO POR PERÍODO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-indigo-600 shrink-0" />
          <span className="text-xs font-semibold text-slate-800">Período de Análise:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 shadow-2xs">
            {(['today', 'week', 'month', 'custom'] as Period[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? 'default' : 'ghost'}
                className={`h-8 text-xs font-semibold transition-all ${
                  period === p
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs'
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
              <span className="text-xs text-muted-foreground font-semibold">até</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-auto h-8 text-xs font-medium"
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. OS 4 KPIS NO TOPO (CLICÁVEIS COMO ATALHOS) + MINI-CARDS DE STATUS */}
      <div className="space-y-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Faturamento do Período em destaque */}
          <KpiCard
            title="Faturamento do Período"
            value={`R$ ${billing.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={DollarSign}
            colorClass="text-amber-700"
            bgClass="bg-amber-100"
            to="/relatorios"
            subtitle="Toque para ver detalhes financeiros"
          />

          <KpiCard
            title="O.S. Abertas"
            value={openCount}
            icon={Wrench}
            colorClass="text-blue-700"
            bgClass="bg-blue-100"
            to="/ordens?status=open"
            subtitle="Em atendimento ou triagem"
          />

          <KpiCard
            title="O.S. Concluídas"
            value={completedCount}
            icon={CheckCircle2}
            colorClass="text-emerald-700"
            bgClass="bg-emerald-100"
            to="/ordens?status=completed"
            subtitle="Finalizadas no período"
          />

          <KpiCard
            title="Tempo Médio de Reparo"
            value={avgTime || '—'}
            icon={Timer}
            colorClass="text-purple-700"
            bgClass="bg-purple-100"
            to="/ordens?status=completed"
            subtitle="Início até a conclusão"
          />
        </div>

        {/* Mini-Cards dos Status de O.S (clicáveis para filtro imediato) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {STATUS_CONFIG.map((s) => (
            <Link
              key={s.value}
              to={`/ordens?status=${s.value}`}
              className="block group"
              title={`Filtrar ordens com status ${s.label}`}
            >
              <Card
                className={`border border-slate-200/90 shadow-2xs ${s.bg} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer rounded-xl`}
              >
                <CardContent className="p-3">
                  <div className={`text-3xl font-bold tabular-nums ${s.color}`}>
                    {orders.filter((o) => o.status === s.value).length}
                  </div>
                  <p className="text-xs text-slate-700 font-semibold mt-1 truncate">{s.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* 5. RESULTADO FINANCEIRO (novo card dedicado completo) */}
      {!isTech && (
        <FinancialResultCard
          summary={financialSummary}
          chartData={evolutionData}
          periodLabel={PERIOD_LABELS[period]}
        />
      )}

      {/* 6. GRÁFICOS DE PIZZA (DONUT) — Status + Distribuição por Técnico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardDonutCard
          title="O.S. por Status"
          subtitle="Visão geral de todas as ordens cadastradas no sistema"
          data={statusDistribution}
          centerLabel="Total O.S."
          centerValue={orders.length}
          emptyMessage="Nenhuma ordem de serviço encontrada"
        />

        <DashboardDonutCard
          title="Distribuição da Carga por Técnico"
          subtitle="Proporção de O.S. ativas distribuídas entre a equipe técnica"
          data={techDistribution}
          centerLabel="Ativas"
          centerValue={
            orders.filter((o) => o.status !== 'closed' && o.status !== 'cancelled').length
          }
          emptyMessage="Nenhuma ordem ativa no momento"
        />
      </div>

      {/* 7. CARGA DOS TÉCNICOS (SOMENTE ROLE='technician') */}
      <Card className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 tracking-tight">
                Carga dos Técnicos
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Equipe técnica responsável pelos atendimentos ({sortedTechnicians.length}{' '}
                {sortedTechnicians.length === 1 ? 'técnico ativo' : 'técnicos ativos'})
              </p>
            </div>
            {!isTech && (
              <span className="text-xs text-muted-foreground font-medium">
                Concluídas e gerado calculados no período selecionado
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sortedTechnicians.map((t) => {
              const metrics = techMetrics.get(t.id) || {
                activeCount: 0,
                completedCount: 0,
                billing: 0,
              }
              const { activeCount, completedCount: techCompleted, billing: techBilling } = metrics

              return (
                <Link
                  key={t.id}
                  to={`/ordens?technician=${t.id}`}
                  className="flex flex-col rounded-xl border border-slate-200/90 p-3.5 bg-white shadow-2xs hover:border-indigo-400 hover:shadow-md hover:bg-indigo-50/20 cursor-pointer transition-all duration-200 group"
                  title={`Filtrar ordens de ${t.name}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 border border-indigo-200 group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-colors">
                      <UserCheck className="h-5 w-5 text-indigo-700 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-900 transition-colors">
                        {t.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {activeCount} {activeCount === 1 ? 'ativa' : 'ativas'}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold tabular-nums px-2.5 py-0.5 rounded-md shrink-0 transition-colors ${
                        activeCount > 3
                          ? 'bg-amber-100 text-amber-800'
                          : activeCount > 0
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {activeCount}
                    </span>
                  </div>

                  {/* Concluídas no período + Valor Gerado no período */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 rounded-lg p-2 group-hover:bg-white transition-colors">
                      <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                        Concluídas
                      </span>
                      <span className="text-xs font-bold tabular-nums text-emerald-600">
                        {techCompleted} {techCompleted === 1 ? 'OS' : 'OSs'}
                      </span>
                    </div>

                    {!isTech ? (
                      <div className="bg-slate-50 rounded-lg p-2 group-hover:bg-white transition-colors">
                        <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                          Gerado
                        </span>
                        <span className="text-xs font-bold tabular-nums text-amber-700">
                          R${' '}
                          {techBilling.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-lg p-2 group-hover:bg-white transition-colors">
                        <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                          Desempenho
                        </span>
                        <span className="text-xs font-semibold text-indigo-600">
                          {techCompleted > 0 ? 'Produtivo' : 'Disponível'}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
            {sortedTechnicians.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6 col-span-full">
                Nenhum técnico cadastrado com o perfil "technician".
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 8. GRÁFICOS DE EVOLUÇÃO (Histórico comparativo do período) */}
      <EvolutionCharts
        data={evolutionData}
        totalOrders={periodOrderCount}
        totalRevenue={billing}
        showRevenue={!isTech}
      />

      {/* 9. ORDENS DE SERVIÇO RECENTES */}
      <Card className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 bg-white">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900 tracking-tight">
              Ordens de Serviço Recentes
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Últimos atendimentos em andamento ou finalizados
            </p>
          </div>
          <Link
            to="/ordens"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Ver todas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-muted-foreground font-semibold uppercase tracking-wider">
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
                {sortedRecentOrders.slice(0, 5).map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-indigo-600 tabular-nums">
                      <Link to={`/ordens/${o.id}`}>{o.number}</Link>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{o.title}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {o.expand?.customer?.razao_social ||
                        o.expand?.customer?.nome_fantasia ||
                        o.expand?.customer?.name ||
                        'Cliente'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {o.expand?.technician?.name ? (
                        <Link
                          to={`/ordens?technician=${o.technician || o.expand.technician.id}`}
                          className="text-slate-600 hover:text-indigo-600 hover:underline font-medium"
                          title={`Filtrar ordens de ${o.expand.technician.name}`}
                        >
                          {o.expand.technician.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                      R${' '}
                      {(o.total || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
                {sortedRecentOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground font-medium">
                      Nenhuma ordem cadastrada no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
