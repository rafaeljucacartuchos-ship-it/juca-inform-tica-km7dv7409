import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  UserCheck,
  Loader2,
  FileDown,
  Search,
  Calendar,
  TrendingUp,
  Clock,
  FileText,
  AlertTriangle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ExportReportsModal } from '@/components/ExportReportsModal'
import { ExportOrdersListModal } from '@/components/ExportOrdersListModal'
import { DashboardProductSearchModal } from '@/components/DashboardProductSearchModal'
import { DashboardDonutCard } from '@/components/DashboardDonutCard'
import { TechnicianProductionPanel } from '@/components/TechnicianProductionPanel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/StatusBadge'
import { ServiceOrder, User, Payment, StatusHistory, Orcamento } from '@/types'
import { getServiceOrders } from '@/services/service_orders'
import { getTechnicians, getAllUsers } from '@/services/users'
import { getAllPayments } from '@/services/payments'
import { getAllStatusHistory } from '@/services/status_history'
import { getOrcamentos } from '@/services/orcamentos'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { getLatestDraft, removeDraftByKey, type DraftEnvelope } from '@/hooks/use-draft-state'
import {
  STATUS_PRIORITY_MAP,
  getPeriodRange,
  computeStatusDistribution,
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
  const navigate = useNavigate()
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
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

  // Banner "Continuar de onde parei"
  const [activeDraft, setActiveDraft] = useState<{ key: string; draft: DraftEnvelope } | null>(null)

  const checkDraft = useCallback(() => {
    const latest = getLatestDraft()
    setActiveDraft(latest)
  }, [])

  useEffect(() => {
    checkDraft()
    const handleDraftChanged = () => checkDraft()
    window.addEventListener('juca:draft-changed', handleDraftChanged)
    window.addEventListener('storage', handleDraftChanged)
    return () => {
      window.removeEventListener('juca:draft-changed', handleDraftChanged)
      window.removeEventListener('storage', handleDraftChanged)
    }
  }, [checkDraft])

  const handleDiscardDraft = () => {
    if (activeDraft) {
      removeDraftByKey(activeDraft.key)
      setActiveDraft(null)
    }
  }

  const handleContinueDraft = () => {
    if (activeDraft?.draft?.route) {
      navigate(activeDraft.draft.route)
    }
  }
  const { user } = useAuth()
  const isTech = user?.role === 'technician'

  const loadData = async () => {
    try {
      setError(null)
      const isTechRole = user?.role === 'technician'
      const techFilter = isTechRole && user?.id ? `technician = "${user.id}"` : ''
      const [so, rawTechs, pay, hist, orc, usersList] = await Promise.all([
        getServiceOrders(techFilter),
        getTechnicians(),
        getAllPayments(),
        getAllStatusHistory(),
        getOrcamentos(),
        getAllUsers().catch(() => []),
      ])

      // Regra: Listar SOMENTE usuários role='technician' (FABIO, RAFAEL, ROBERT, JOÃO VICTOR, etc.)
      // NUNCA incluir role='admin' nem role='attendant' na carga/atendimentos/produção
      const pureTechs = rawTechs.filter((t) => t.role === 'technician')

      setOrders(so)
      setTechnicians(pureTechs)
      setAllUsers(usersList)
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

  // 1) Métricas de O.S. no período para cômputo de valor (cada O.S. conta na data de conclusão se concluída/fechada, senão na data de criação)
  const periodOrdersForValue = useMemo(() => {
    return orders.filter((o) => {
      if (o.status === 'completed' || o.status === 'closed') {
        const recs = history.filter((h) => h.service_order === o.id && h.status === 'completed')
        const completedDate = recs[recs.length - 1]?.created || o.updated
        if (!completedDate) return false
        const d = completedDate.substring(0, 10)
        return d >= range.start && d <= range.end
      }
      if (!o.created) return false
      const d = o.created.substring(0, 10)
      return d >= range.start && d <= range.end
    })
  }, [orders, history, range.start, range.end])

  // Valor total em O.S. do período (soma do campo total das O.S. com data efetiva no período para os donuts c e d)
  const totalValorEmOS = useMemo(() => {
    return periodOrdersForValue.reduce((sum, o) => sum + (o.total || 0), 0)
  }, [periodOrdersForValue])

  // 2) Métricas de Orçamentos no período (necessárias para os donuts b e d)
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

  const totalValorOrcPendentes = useMemo(() => {
    return orcamentosPendentes.reduce((sum, orc) => sum + (orc.total_geral || 0), 0)
  }, [orcamentosPendentes])

  // v0.0.213: Mapa de usuários para resolução ágil de nomes de responsáveis
  const userMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of allUsers) {
      if (u.id && u.name) map.set(u.id, u.name)
    }
    for (const t of technicians) {
      if (t.id && t.name) map.set(t.id, t.name)
    }
    return map
  }, [allUsers, technicians])

  // v0.0.213: Orçamentos aguardando aprovação desdobrados por responsável
  const orcamentosAguardandoAprovacao = useMemo(() => {
    return orcamentos.filter((orc) => orc.status === 'aguardando_aprovacao')
  }, [orcamentos])

  const orcamentosPorResponsavel = useMemo(() => {
    const groupMap = new Map<
      string,
      {
        responsavelId: string
        nome: string
        quantidade: number
        valorTotal: number
        itensAntigos: number
      }
    >()

    const now = Date.now()
    const seteDiasMs = 7 * 24 * 60 * 60 * 1000

    for (const orc of orcamentosAguardandoAprovacao) {
      const respId = orc.responsavel_id || orc.id_usuario_criador || 'sem_responsavel'
      const nome =
        orc.expand?.responsavel_id?.name ||
        orc.expand?.id_usuario_criador?.name ||
        userMap.get(respId) ||
        (respId === 'sem_responsavel' ? 'Não Atribuído' : 'Sem Responsável')

      const valor = orc.total_geral || 0
      const isAntigo = orc.created ? now - new Date(orc.created).getTime() > seteDiasMs : false

      const existing = groupMap.get(respId)
      if (existing) {
        existing.quantidade += 1
        existing.valorTotal += valor
        if (isAntigo) existing.itensAntigos += 1
      } else {
        groupMap.set(respId, {
          responsavelId: respId,
          nome,
          quantidade: 1,
          valorTotal: valor,
          itensAntigos: isAntigo ? 1 : 0,
        })
      }
    }

    const list = Array.from(groupMap.values())
    // Ordenado por valor desc
    list.sort((a, b) => b.valorTotal - a.valorTotal)

    const totalQtd = list.reduce((sum, item) => sum + item.quantidade, 0)
    const totalVal = list.reduce((sum, item) => sum + item.valorTotal, 0)
    const totalAntigos = list.reduce((sum, item) => sum + item.itensAntigos, 0)

    return {
      list,
      totalQtd,
      totalVal,
      totalAntigos,
    }
  }, [orcamentosAguardandoAprovacao, userMap])

  // v0.0.213: Resumo por todos os status de orçamentos (botões clicáveis)
  const orcamentosStatusResumo = useMemo(() => {
    const STATUS_ORDER = [
      'aguardando_aprovacao',
      'aprovado',
      'faturado',
      'enviado',
      'rascunho',
      'rejeitado',
      'substituido',
    ]

    const STATUS_META: Record<
      string,
      { label: string; badgeClass: string; bgClass: string; borderClass: string }
    > = {
      aguardando_aprovacao: {
        label: 'Aguardando Aprovação',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        bgClass: 'hover:bg-amber-50/70',
        borderClass: 'border-amber-200',
      },
      aprovado: {
        label: 'Aprovado',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        bgClass: 'hover:bg-emerald-50/70',
        borderClass: 'border-emerald-200',
      },
      faturado: {
        label: 'Faturado',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
        bgClass: 'hover:bg-purple-50/70',
        borderClass: 'border-purple-200',
      },
      enviado: {
        label: 'Enviado',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
        bgClass: 'hover:bg-blue-50/70',
        borderClass: 'border-blue-200',
      },
      rascunho: {
        label: 'Rascunho',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        bgClass: 'hover:bg-slate-50',
        borderClass: 'border-slate-200',
      },
      rejeitado: {
        label: 'Rejeitado',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        bgClass: 'hover:bg-rose-50/70',
        borderClass: 'border-rose-200',
      },
      substituido: {
        label: 'Substituído',
        badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-300',
        bgClass: 'hover:bg-zinc-50',
        borderClass: 'border-zinc-200',
      },
    }

    const counts: Record<string, { status: string; label: string; count: number; total: number }> =
      {}

    for (const orc of orcamentos) {
      const st = orc.status || 'rascunho'
      if (!counts[st]) {
        const meta = STATUS_META[st]
        counts[st] = {
          status: st,
          label: meta ? meta.label : st,
          count: 0,
          total: 0,
        }
      }
      counts[st].count += 1
      counts[st].total += orc.total_geral || 0
    }

    // Ordena de acordo com STATUS_ORDER e adiciona eventuais extras no fim
    const sorted = Object.values(counts).sort((a, b) => {
      const idxA = STATUS_ORDER.indexOf(a.status)
      const idxB = STATUS_ORDER.indexOf(b.status)
      const orderA = idxA === -1 ? 99 : idxA
      const orderB = idxB === -1 ? 99 : idxB
      return orderA - orderB
    })

    return {
      items: sorted,
      meta: STATUS_META,
    }
  }, [orcamentos])

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

  // 2) OS 4 GRÁFICOS DE PIZZA (DONUT)
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
    return computeTechnicianValueDistribution(technicians, orders, range.start, range.end, history)
  }, [technicians, orders, range.start, range.end, history])

  // (d) Resultado do período como donut: Valor em O.S. vs Orçamentos Aprovados vs Orçamentos Pendentes
  const periodResultDistribution = useMemo(() => {
    return computePeriodResultDistribution(orders, orcamentos, range.start, range.end, history)
  }, [orders, orcamentos, range.start, range.end, history])

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
      {/* BANNER DISCRETO: CONTINUAR DE ONDE PAREI */}
      {activeDraft && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border border-indigo-200/90 rounded-xl shadow-2xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                  Continuar de onde parei
                </span>
                <span className="text-[10px] font-semibold text-indigo-600 bg-white/80 px-2 py-0.5 rounded-full border border-indigo-200">
                  {activeDraft.draft.title || activeDraft.draft.route}
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Você tem alterações não salvas gravadas às{' '}
                <span className="font-semibold text-slate-900">
                  {new Date(activeDraft.draft.updatedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>{' '}
                de {new Date(activeDraft.draft.updatedAt).toLocaleDateString('pt-BR')}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDiscardDraft}
              className="h-8 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50"
            >
              Descartar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleContinueDraft}
              className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs gap-1.5"
            >
              <span>Continuar</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

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

      {/* CARD DE ORÇAMENTOS: DESDOBRADO POR RESPONSÁVEL E POR STATUS (v0.0.213) */}
      <Card className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                Orçamentos — Pendentes por Responsável e Visão por Status
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Propostas comerciais ativas aguardando aprovação desdobradas por técnico e resumo
                geral
              </p>
            </div>
            <Link
              to="/orcamentos"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Ver todos os orçamentos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-6">
          {/* SEÇÃO 1: AGRUPAMENTO POR RESPONSÁVEL (STATUS 'AGUARDANDO_APROVACAO') */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  Orçamentos Aguardando Aprovação por Responsável
                </h3>
                <p className="text-[11px] text-slate-500">
                  Valores e propostas em negociação com clientes. Clique no responsável para filtrar
                  na listagem.
                </p>
              </div>
              {orcamentosPorResponsavel.totalAntigos > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  {orcamentosPorResponsavel.totalAntigos}{' '}
                  {orcamentosPorResponsavel.totalAntigos === 1
                    ? 'pendência antiga'
                    : 'pendências antigas'}{' '}
                  (&gt; 7 dias)
                </span>
              )}
            </div>

            <div className="overflow-x-auto w-full border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Responsável</th>
                    <th className="py-2.5 px-3 text-center">Quantidade</th>
                    <th className="py-2.5 px-3 text-center">Antigos (&gt; 7 dias)</th>
                    <th className="py-2.5 px-4 text-right">Total Geral</th>
                    <th className="py-2.5 px-3 text-center w-24">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orcamentosPorResponsavel.list.map((item) => (
                    <tr
                      key={item.responsavelId}
                      onClick={() => {
                        navigate(
                          `/orcamentos?status=aguardando_aprovacao&responsavel=${encodeURIComponent(
                            item.responsavelId,
                          )}`,
                        )
                      }}
                      className="hover:bg-amber-50/40 cursor-pointer transition-colors group"
                      title={`Filtrar orçamentos de ${item.nome}`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 group-hover:text-indigo-600 flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                        <span className="uppercase">{item.nome}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                        {item.quantidade}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {item.itensAntigos > 0 ? (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 border text-[10px] font-bold">
                            {item.itensAntigos} antigo{item.itensAntigos > 1 ? 's' : ''} (&gt; 7
                            dias)
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrencyBRL(item.valorTotal)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(
                              `/orcamentos?status=aguardando_aprovacao&responsavel=${encodeURIComponent(
                                item.responsavelId,
                              )}`,
                            )
                          }}
                        >
                          Ver <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {orcamentosPorResponsavel.list.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 font-medium">
                        Nenhum orçamento com status "Aguardando Aprovação".
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Linha TOTAL GERAL no fim */}
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                  <tr>
                    <td className="py-3 px-4 uppercase tracking-wider text-[11px]">TOTAL GERAL</td>
                    <td className="py-3 px-3 text-center font-mono text-sm">
                      {orcamentosPorResponsavel.totalQtd}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {orcamentosPorResponsavel.totalAntigos > 0 && (
                        <Badge className="bg-amber-200 text-amber-950 border-amber-400 border text-[10px] font-bold">
                          {orcamentosPorResponsavel.totalAntigos} no total
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-indigo-900 tabular-nums">
                      {formatCurrencyBRL(orcamentosPorResponsavel.totalVal)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                        onClick={() => navigate('/orcamentos?status=aguardando_aprovacao')}
                      >
                        Filtrar Todos
                      </Button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* SEÇÃO 2: RESUMO POR STATUS COM BOTÕES CLICÁVEIS */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span>Resumo Geral de Orçamentos por Status</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Clique no botão de qualquer status para filtrar a listagem de orçamentos
                imediatamente:
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
              {orcamentosStatusResumo.items.map((item) => {
                const meta = orcamentosStatusResumo.meta[item.status] || {
                  label: item.status,
                  badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
                  bgClass: 'hover:bg-slate-50',
                  borderClass: 'border-slate-200',
                }

                return (
                  <button
                    key={item.status}
                    type="button"
                    onClick={() =>
                      navigate(`/orcamentos?status=${encodeURIComponent(item.status)}`)
                    }
                    className={`flex flex-col justify-between p-3 rounded-lg border text-left transition-all shadow-2xs hover:shadow-sm cursor-pointer bg-white ${meta.borderClass} ${meta.bgClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                    title={`Ver orçamentos com status ${item.label}`}
                  >
                    <div className="space-y-1">
                      <span
                        className={`inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${meta.badgeClass}`}
                      >
                        {item.label}
                      </span>
                      <div className="font-mono text-lg font-black text-slate-900 mt-1">
                        {item.count}{' '}
                        <span className="text-[11px] font-normal text-slate-500">
                          {item.count === 1 ? 'orç.' : 'orçs.'}
                        </span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 mt-2">
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Valor somado:
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-800 tabular-nums">
                        {formatCurrencyBRL(item.total)}
                      </span>
                    </div>
                  </button>
                )
              })}

              {/* Botão Ver Todos */}
              <button
                type="button"
                onClick={() => navigate('/orcamentos')}
                className="flex flex-col justify-between p-3 rounded-lg border border-slate-300 bg-slate-50/60 hover:bg-slate-100 text-left transition-all shadow-2xs hover:shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="Ver todos os orçamentos cadastrados"
              >
                <div className="space-y-1">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-slate-200 text-slate-800 border-slate-300">
                    Todos
                  </span>
                  <div className="font-mono text-lg font-black text-slate-900 mt-1">
                    {orcamentos.length}{' '}
                    <span className="text-[11px] font-normal text-slate-500">total</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200 mt-2 flex items-center justify-between text-indigo-600 font-bold text-xs">
                  <span>Listagem</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </button>
            </div>
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
