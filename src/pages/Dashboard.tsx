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
import { ServiceOrder, User, Payment, StatusHistory, Orcamento } from '@/types'
import { getServiceOrders } from '@/services/service_orders'
import { getTechnicians } from '@/services/users'
import { getAllPayments } from '@/services/payments'
import { getAllStatusHistory } from '@/services/status_history'
import { getOrcamentos } from '@/services/orcamentos'
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
  computeTechnicianProduction,
  computeOrcamentosStatusDistribution,
  computeTechnicianValueDistribution,
  computePeriodResultDistribution,
  formatCurrencyBRL,
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
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
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
      const [so, rawTechs, pay, hist, orc] = await Promise.all([
        getServiceOrders(techFilter),
        getTechnicians(),
        getAllPayments(),
        getAllStatusHistory(),
        getOrcamentos(),
      ])

      // Regra: Listar SOMENTE usuários role='technician' (FABIO, RAFAEL, ROBERT, JOÃO VICTOR, etc.)
      // NUNCA incluir role='admin' nem role='attendant' na carga/atendimentos/produção
      const pureTechs = rawTechs.filter((t) => t.role === 'technician')

      setOrders(so)
      setTechnicians(pureTechs)
      setOrcamentos(orc)

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
  useRealtime('orcamentos', loadData)

  const range = getPeriodRange(period, customStart, customEnd)
  const billing = computeBilling(payments, range.start, range.end)
  const completedCount = countCompletedInPeriod(orders, history, range.start, range.end)
  const avgTime = computeAverageServiceTime(orders, history, range.start, range.end)
  const evolutionData = computeEvolutionData(orders, payments, range.start, range.end)
  const periodOrderCount = countOrdersInPeriod(orders, range.start, range.end)

  // 1) Métricas de O.S. no período
  const periodOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!o.created) return false
      const d = o.created.substring(0, 10)
      return d >= range.start && d <= range.end
    })
  }, [orders, range.start, range.end])

  // Valor total em O.S. do período (soma do campo total das O.S. criadas no período)
  const totalValorEmOS = useMemo(() => {
    return periodOrders.reduce((sum, o) => sum + (o.total || 0), 0)
  }, [periodOrders])

  // 2) Métricas de Orçamentos no período
  const periodOrcamentos = useMemo(() => {
    return orcamentos.filter((orc) => {
      if (!orc.created) return false
      const d = orc.created.substring(0, 10)
      return d >= range.start && d <= range.end
    })
  }, [orcamentos, range.start, range.end])

  const orcamentosAprovados = useMemo(() => {
    return periodOrcamentos.filter((orc) => orc.status === 'aprovado' || orc.status === 'faturado')
  }, [periodOrcamentos])

  const countOrcAprovados = orcamentosAprovados.length
  const totalValorOrcAprovados = useMemo(() => {
    return orcamentosAprovados.reduce((sum, orc) => sum + (orc.total_geral || 0), 0)
  }, [orcamentosAprovados])

  const orcamentosPendentes = useMemo(() => {
    return periodOrcamentos.filter(
      (orc) =>
        orc.status === 'rascunho' ||
        orc.status === 'enviado' ||
        orc.status === 'aguardando_aprovacao',
    )
  }, [periodOrcamentos])

  const countOrcPendentes = orcamentosPendentes.length
  const totalValorOrcPendentes = useMemo(() => {
    return orcamentosPendentes.reduce((sum, orc) => sum + (orc.total_geral || 0), 0)
  }, [orcamentosPendentes])

  // 1) TABELA CENTRAL: RESULTADO POR TÉCNICO (role='technician' apenas)
  const technicianProduction = useMemo(() => {
    return computeTechnicianProduction(
      technicians,
      orders,
      orcamentos,
      history,
      range.start,
      range.end,
    )
  }, [technicians, orders, orcamentos, history, range.start, range.end])

  // 3) OS 4 GRÁFICOS DE PIZZA (DONUT)
  // (a) O.S. por status
  const statusDistribution = useMemo(() => {
    return computeStatusDistribution(orders)
  }, [orders])

  // (b) Orçamentos por status (máx 6 fatias e Outros)
  const orcamentosStatusDistribution = useMemo(() => {
    return computeOrcamentosStatusDistribution(orcamentos, range.start, range.end)
  }, [orcamentos, range.start, range.end])

  // (c) Valor gerado por técnico (pizza comparando o valor das O.S. de cada técnico no período)
  const techValueDistribution = useMemo(() => {
    return computeTechnicianValueDistribution(technicians, orders, range.start, range.end)
  }, [technicians, orders, range.start, range.end])

  // (d) Resultado do período como donut: Valor em O.S. vs Orçamentos Aprovados vs Orçamentos Pendentes
  const periodResultDistribution = useMemo(() => {
    return computePeriodResultDistribution(orders, orcamentos, range.start, range.end)
  }, [orders, orcamentos, range.start, range.end])

  // Resultado financeiro mantido, porém adaptado para acompanhamento
  const financialSummary = useMemo(() => {
    return computeFinancialSummary(payments, range.start, range.end, period)
  }, [payments, range.start, range.end, period])

  // Distribuição da carga por técnico (O.S. ativas por técnico em pizza/donut para preservação)
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
          orcamentos={orcamentos}
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

      {/* 2. NÚMEROS GERAIS DO PERÍODO (topo, cards simples e sem vocabulário financeiro de payments) */}
      <div className="space-y-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: O.S. no período */}
          <KpiCard
            title="O.S. no Período"
            value={periodOrderCount}
            icon={Wrench}
            colorClass="text-blue-700"
            bgClass="bg-blue-100"
            to="/ordens"
            subtitle={`${completedCount} ${completedCount === 1 ? 'concluída' : 'concluídas'} no período`}
          />

          {/* Card 2: Valor Total em O.S. */}
          <KpiCard
            title="Valores em O.S."
            value={formatCurrencyBRL(totalValorEmOS)}
            icon={DollarSign}
            colorClass="text-indigo-700"
            bgClass="bg-indigo-100"
            to="/ordens"
            subtitle="Soma do valor das ordens criadas no período"
          />

          {/* Card 3: Orçamentos Aprovados + valor */}
          <KpiCard
            title="Valores em Orçamentos Aprovados"
            value={formatCurrencyBRL(totalValorOrcAprovados)}
            icon={CheckCircle2}
            colorClass="text-emerald-700"
            bgClass="bg-emerald-100"
            to="/orcamentos?status=aprovado"
            subtitle={`${countOrcAprovados} ${countOrcAprovados === 1 ? 'orçamento aprovado' : 'orçamentos aprovados'}`}
          />

          {/* Card 4: Orçamentos Pendentes + valor */}
          <KpiCard
            title="Orçamentos Pendentes"
            value={formatCurrencyBRL(totalValorOrcPendentes)}
            icon={Timer}
            colorClass="text-amber-700"
            bgClass="bg-amber-100"
            to="/orcamentos"
            subtitle={`${countOrcPendentes} ${countOrcPendentes === 1 ? 'orçamento pendente' : 'orçamentos pendentes'}`}
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

      {/* 3. CARD CENTRAL: RESULTADO POR TÉCNICO (Novo Card Central) */}
      <Card className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-indigo-600" />
                Resultado por Técnico no Período
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acompanhamento de produção em O.S. e Orçamentos da equipe técnica (
                {technicianProduction.rows.length}{' '}
                {technicianProduction.rows.length === 1 ? 'técnico' : 'técnicos'})
              </p>
            </div>
            <span className="text-xs text-indigo-700 font-semibold bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1 self-start sm:self-auto">
              Clique na linha para filtrar as O.S. do técnico
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-muted-foreground font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 font-bold text-slate-700">Técnico</th>
                  <th
                    className="py-2.5 px-3 text-center bg-blue-50/50 font-bold text-blue-900 border-l border-blue-100"
                    colSpan={3}
                  >
                    Ordens de Serviço (O.S.)
                  </th>
                  <th
                    className="py-2.5 px-3 text-center bg-emerald-50/50 font-bold text-emerald-900 border-l border-emerald-100"
                    colSpan={5}
                  >
                    Orçamentos
                  </th>
                </tr>
                <tr className="border-t border-slate-200/60 text-[11px] text-slate-600">
                  <th className="py-2 px-4">Nome</th>
                  {/* O.S. */}
                  <th className="py-2 px-3 text-right bg-blue-50/30 border-l border-blue-100">
                    Criadas
                  </th>
                  <th className="py-2 px-3 text-right bg-blue-50/30">Concluídas</th>
                  <th className="py-2 px-3 text-right bg-blue-50/30 font-bold text-blue-950">
                    Valor Total O.S.
                  </th>
                  {/* Orçamentos */}
                  <th className="py-2 px-3 text-right bg-emerald-50/30 border-l border-emerald-100">
                    Criados
                  </th>
                  <th className="py-2 px-3 text-right bg-emerald-50/30 text-emerald-700 font-bold">
                    Aprovados
                  </th>
                  <th className="py-2 px-3 text-right bg-emerald-50/30 text-amber-700">
                    Pendentes
                  </th>
                  <th className="py-2 px-3 text-right bg-emerald-50/30 text-rose-700">
                    Rejeitados
                  </th>
                  <th className="py-2 px-3 text-right bg-emerald-50/30 font-bold text-emerald-950">
                    Valor Aprovados
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {technicianProduction.rows.map((row) => (
                  <tr
                    key={row.technicianId}
                    onClick={() => {
                      window.location.href = `/ordens?tecnico=${encodeURIComponent(row.technicianName)}`
                    }}
                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                    title={`Clique para filtrar ordens de ${row.technicianName}`}
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                      <UserCheck className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                      <span>{row.technicianName}</span>
                    </td>

                    {/* O.S. */}
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-slate-700 border-l border-slate-100">
                      {row.osCriadas}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-emerald-600">
                      {row.osConcluidas}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-blue-700">
                      {formatCurrencyBRL(row.osValorTotal)}
                    </td>

                    {/* Orçamentos */}
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-slate-700 border-l border-slate-100">
                      {row.orcCriados}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-emerald-700 bg-emerald-50/30">
                      {row.orcAprovados}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium text-amber-700">
                      {row.orcPendentes}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium text-rose-700">
                      {row.orcRejeitados}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-emerald-800 bg-emerald-50/40">
                      {formatCurrencyBRL(row.orcValorAprovados)}
                    </td>
                  </tr>
                ))}

                {technicianProduction.rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground font-medium">
                      Nenhum técnico com perfil "technician" localizado.
                    </td>
                  </tr>
                )}
              </tbody>
              {/* Rodapé com Totais */}
              <tfoot className="bg-slate-100/90 border-t-2 border-slate-300 font-extrabold text-slate-900">
                <tr>
                  <td className="py-3 px-4 uppercase tracking-wider text-[11px]">Totais Gerais</td>
                  {/* O.S. Totais */}
                  <td className="py-3 px-3 text-right tabular-nums border-l border-slate-200">
                    {technicianProduction.totals.osCriadas}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-emerald-700">
                    {technicianProduction.totals.osConcluidas}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-blue-900">
                    {formatCurrencyBRL(technicianProduction.totals.osValorTotal)}
                  </td>
                  {/* Orçamentos Totais */}
                  <td className="py-3 px-3 text-right tabular-nums border-l border-slate-200">
                    {technicianProduction.totals.orcCriados}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-emerald-800">
                    {technicianProduction.totals.orcAprovados}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-amber-800">
                    {technicianProduction.totals.orcPendentes}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-rose-800">
                    {technicianProduction.totals.orcRejeitados}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-emerald-900">
                    {formatCurrencyBRL(technicianProduction.totals.orcValorAprovados)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 4. OS 4 GRÁFICOS DE PIZZA (DONUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* (a) O.S. por status */}
        <DashboardDonutCard
          title="O.S. por Status"
          subtitle="Distribuição de ordens de serviço por status"
          data={statusDistribution}
          centerLabel="Total O.S."
          centerValue={orders.length}
          emptyMessage="Nenhuma ordem de serviço encontrada"
        />

        {/* (b) Orçamentos por status (rascunho/enviado/aprovado/pendente/rejeitado) */}
        <DashboardDonutCard
          title="Orçamentos por Status"
          subtitle="Propostas no período selecionado (quantidade, valor e %)"
          data={orcamentosStatusDistribution}
          centerLabel="Orçamentos"
          centerValue={periodOrcamentos.length}
          emptyMessage="Nenhum orçamento no período"
          showAmountInLegend
        />

        {/* (c) Valor gerado por técnico (pizza comparando o valor das O.S. de cada técnico no período) */}
        <DashboardDonutCard
          title="Valor Gerado por Técnico (O.S.)"
          subtitle="Comparativo do valor das O.S. produzidas por técnico no período"
          data={techValueDistribution}
          centerLabel="Total O.S."
          centerValue={totalValorEmOS}
          emptyMessage="Nenhuma ordem com valor no período"
          valueIsCurrency
        />

        {/* (d) Resultado do período como donut: Valor em O.S. vs Orçamentos Aprovados vs Orçamentos pendentes */}
        <DashboardDonutCard
          title="Resultado do Período"
          subtitle="Valores em O.S. vs Orçamentos Aprovados vs Pendentes"
          data={periodResultDistribution}
          centerLabel="Montante"
          centerValue={totalValorEmOS + totalValorOrcAprovados + totalValorOrcPendentes}
          emptyMessage="Sem movimentações registradas no período"
          valueIsCurrency
        />
      </div>

      {/* 5. ACOMPANHAMENTO DE RESULTADO / PAGAMENTOS DO REDESIGN ANTERIOR (MANTIDO E RENOMEADO) */}
      {!isTech && (
        <FinancialResultCard
          summary={financialSummary}
          chartData={evolutionData}
          periodLabel={PERIOD_LABELS[period]}
          totalOrcamentosAprovados={totalValorOrcAprovados}
          countOrcamentosAprovados={countOrcAprovados}
          totalOrcamentosPendentes={totalValorOrcPendentes}
          countOrcamentosPendentes={countOrcPendentes}
        />
      )}

      {/* 6. DISTRIBUIÇÃO DA CARGA POR TÉCNICO (PRESERVADO) */}
      <div className="grid grid-cols-1 gap-4">
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
                  to={`/ordens?tecnico=${encodeURIComponent(t.name || t.id)}`}
                  className="flex flex-col rounded-xl border border-slate-200/90 p-3.5 bg-white shadow-2xs hover:border-indigo-400 hover:shadow-md hover:scale-[1.015] hover:bg-indigo-50/20 cursor-pointer transition-all duration-200 group"
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
                          to={`/ordens?tecnico=${encodeURIComponent(o.expand.technician.name)}`}
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
