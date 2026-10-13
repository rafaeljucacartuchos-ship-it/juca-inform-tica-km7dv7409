import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign,
  CheckCircle2,
  Wrench,
  Tag,
  Printer,
  FileDown,
  Users,
  UserCheck,
  Calendar,
  AlertCircle,
  HelpCircle,
  Briefcase,
  Layers,
  FileCode,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  ServiceOrder,
  ServiceOrderItem,
  SERVICE_CATEGORY_LABELS,
  User,
  OrderDivisionHistoryRecord,
} from '@/types'
import {
  getServiceOrders,
  getAllOrderItems,
  getAllOrderDivisionHistory,
} from '@/services/service_orders'
import { getAllPayments } from '@/services/payments'
import { getAllUsers } from '@/services/users'
import { buildCategoryReport, type CategoryReportData } from '@/lib/category-report'
import { exportToCSV, exportToExcel, type ExportSection } from '@/lib/export-utils'
import { ExportReportsModal } from '@/components/ExportReportsModal'

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em Andamento',
  paused: 'Pausada',
  waiting_parts: 'Aguardando Peças',
  completed: 'Concluída',
  closed: 'Fechada',
  cancelled: 'Cancelada',
}

function fmtDate(d?: string): string {
  if (!d) return ''
  return d.substring(0, 10).split('-').reverse().join('/')
}

export default function Relatorios() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'categorias' | 'participantes'>('participantes')
  const [report, setReport] = useState<CategoryReportData[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [completedOrders, setCompletedOrders] = useState(0)
  const [payments, setPayments] = useState<any[]>([])
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [orderItems, setOrderItems] = useState<ServiceOrderItem[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [divisionHistory, setDivisionHistory] = useState<OrderDivisionHistoryRecord[]>([])
  const [exportOpen, setExportOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Filtros da aba de Participantes
  const today = new Date().toISOString().substring(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .substring(0, 10)
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all')
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'technician' | 'seller'>(
    'all',
  )

  useEffect(() => {
    Promise.all([
      getServiceOrders(),
      getAllOrderItems(),
      getAllPayments(),
      getAllUsers().catch(() => []),
      getAllOrderDivisionHistory().catch(() => []),
    ])
      .then(
        ([so, items, pay, uList, divHist]: [
          ServiceOrder[],
          ServiceOrderItem[],
          any[],
          User[],
          OrderDivisionHistoryRecord[],
        ]) => {
          setOrders(so)
          setOrderItems(items)
          setPayments(pay)
          setUsers(uList)
          setDivisionHistory(divHist)
          setTotalOrders(so.length)
          setCompletedOrders(
            so.filter((o) => o.status === 'closed' || o.status === 'completed').length,
          )
          const rev = pay
            .filter((p) => p.status === 'paid')
            .reduce((s, p) => s + (p.amount || 0), 0)
          setTotalRevenue(rev)
          setReport(buildCategoryReport(so, items))
        },
      )
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const inDateRange = (dateStr?: string) => {
    if (!dateStr) return false
    const d = dateStr.substring(0, 10)
    return d >= startDate && d <= endDate
  }

  // Ordens filtradas pelo período selecionado
  const periodOrders = useMemo(() => {
    return orders.filter((o) => inDateRange(o.created))
  }, [orders, startDate, endDate])

  // Identificação e consolidação por participante
  const participantsSummary = useMemo(() => {
    // Mapa de participantes: userId -> consolidado
    type ParticipantStat = {
      user: User | { id: string; name: string; role?: string }
      assignedOrders: ServiceOrder[]
      assignedServicesCents: number
      assignedProductsCents: number
      totalAssignedCents: number
      uninformedCount: number
      uninformedOrders: ServiceOrder[]
      rolesInvolved: Set<'primary_tech' | 'second_tech' | 'seller'>
    }

    const map = new Map<string, ParticipantStat>()

    const getOrCreate = (userId: string, fallbackName?: string, fallbackRole?: string) => {
      let stat = map.get(userId)
      if (!stat) {
        const found = users.find((u) => u.id === userId)
        stat = {
          user: found || { id: userId, name: fallbackName || 'Usuário', role: fallbackRole },
          assignedOrders: [],
          assignedServicesCents: 0,
          assignedProductsCents: 0,
          totalAssignedCents: 0,
          uninformedCount: 0,
          uninformedOrders: [],
          rolesInvolved: new Set(),
        }
        map.set(userId, stat)
      }
      return stat
    }

    for (const ord of periodOrders) {
      const t1 = ord.technician
      const t2 = ord.second_technician
      const sel = ord.seller

      // Se a OS tiver division_details com participantes definidos
      if (
        ord.division_details &&
        ord.division_details.participants &&
        ord.division_details.participants.length > 0
      ) {
        for (const p of ord.division_details.participants) {
          if (!p.userId) continue
          const stat = getOrCreate(p.userId, p.userName, p.role)
          stat.rolesInvolved.add(p.role)
          if (!stat.assignedOrders.some((o) => o.id === ord.id)) {
            stat.assignedOrders.push(ord)
          }
          const sCents = Math.round((p.servicesAmount != null ? p.servicesAmount : 0) * 100)
          const pCents = Math.round((p.productsAmount != null ? p.productsAmount : 0) * 100)
          stat.assignedServicesCents += sCents
          stat.assignedProductsCents += pCents
          stat.totalAssignedCents += sCents + pCents
        }
      } else {
        // OS sem division_details -> rotulada como "Divisão não informada"
        const assignedIds = new Set<string>()
        if (t1) {
          const stat = getOrCreate(t1, ord.expand?.technician?.name || 'Técnico 1', 'technician')
          stat.rolesInvolved.add('primary_tech')
          assignedIds.add(t1)
        }
        if (t2) {
          const stat = getOrCreate(
            t2,
            ord.expand?.second_technician?.name || 'Segundo Técnico',
            'technician',
          )
          stat.rolesInvolved.add('second_tech')
          assignedIds.add(t2)
        }
        if (sel) {
          const stat = getOrCreate(sel, ord.expand?.seller?.name || 'Vendedor', 'seller')
          stat.rolesInvolved.add('seller')
          assignedIds.add(sel)
        }

        for (const uid of assignedIds) {
          const stat = map.get(uid)
          if (stat) {
            stat.uninformedCount += 1
            if (!stat.uninformedOrders.some((o) => o.id === ord.id)) {
              stat.uninformedOrders.push(ord)
            }
          }
        }
      }
    }

    // Converte para lista
    let list = Array.from(map.values())

    // Filtros de seleção de usuário ou papel
    if (selectedUserFilter !== 'all') {
      list = list.filter((s) => s.user.id === selectedUserFilter)
    }

    if (selectedRoleFilter === 'technician') {
      list = list.filter(
        (s) =>
          s.rolesInvolved.has('primary_tech') ||
          s.rolesInvolved.has('second_tech') ||
          (s.user as User).role === 'technician' ||
          (s.user as any).funcao === 'tecnico',
      )
    } else if (selectedRoleFilter === 'seller') {
      list = list.filter(
        (s) =>
          s.rolesInvolved.has('seller') ||
          (s.user as any).funcao === 'vendedor' ||
          (s.user as any).role === 'seller',
      )
    }

    // Ordenação alfabética pelo nome
    list.sort((a, b) => (a.user.name || '').localeCompare(b.user.name || ''))

    return list
  }, [periodOrders, users, selectedUserFilter, selectedRoleFilter])

  // Contagem estrita da empresa no período (IDs únicos: cada OS conta UMA ÚNICA VEZ)
  const companyMetrics = useMemo(() => {
    const uniqueOrderIds = new Set(periodOrders.map((o) => o.id))
    const totalOrdersCount = uniqueOrderIds.size
    const completedCount = periodOrders.filter(
      (o) => o.status === 'completed' || o.status === 'closed',
    ).length
    const totalInvoiced = periodOrders.reduce((acc, o) => acc + (o.total || 0), 0)

    const periodPayments = payments.filter((p) => p.status === 'paid' && inDateRange(p.paid_at))
    const totalRevenuePaid = periodPayments.reduce((acc, p) => acc + (p.amount || 0), 0)

    const ordersWithoutDivision = periodOrders.filter(
      (o) => !o.division_details || !o.division_details.configured,
    ).length

    return {
      totalOrdersCount,
      completedCount,
      totalInvoiced,
      totalRevenuePaid,
      ordersWithoutDivision,
    }
  }, [periodOrders, payments, startDate, endDate])

  const handleExportMigrationFiles = (type: 'csv' | 'json') => {
    if (type === 'json') {
      const payload = {
        exported_at: new Date().toISOString(),
        date_range: { start: startDate, end: endDate },
        total_period_orders: periodOrders.length,
        service_orders: periodOrders.map((o) => ({
          id: o.id,
          number: o.number,
          status: o.status,
          total: o.total,
          created: o.created,
          technician: o.technician || null,
          technician_name: o.expand?.technician?.name || null,
          second_technician: o.second_technician || null,
          second_technician_name: o.expand?.second_technician?.name || null,
          seller: o.seller || null,
          seller_name: o.expand?.seller?.name || null,
          division_model:
            o.division_model || (o.division_details ? 'custom' : 'Divisão não informada'),
          division_details: o.division_details || null,
        })),
        order_division_history: divisionHistory.filter((h) =>
          periodOrders.some((o) => o.id === h.service_order),
        ),
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8;',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `migracao_ordens_divisao_${startDate}_${endDate}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } else {
      const ordersHeaders = [
        'id',
        'number',
        'status',
        'created',
        'total',
        'technician_id',
        'technician_name',
        'second_technician_id',
        'second_technician_name',
        'seller_id',
        'seller_name',
        'division_model',
        'division_details_json',
      ]

      const ordersRows = periodOrders.map((o) => [
        o.id,
        o.number,
        o.status,
        o.created || '',
        (o.total || 0).toFixed(2),
        o.technician || '',
        o.expand?.technician?.name || '',
        o.second_technician || '',
        o.expand?.second_technician?.name || '',
        o.seller || '',
        o.expand?.seller?.name || '',
        o.division_model || (o.division_details ? 'definida' : 'Divisão não informada'),
        o.division_details ? JSON.stringify(o.division_details) : '',
      ])

      const relevantHistory = divisionHistory.filter((h) =>
        periodOrders.some((o) => o.id === h.service_order),
      )
      const historyHeaders = [
        'id',
        'service_order_id',
        'user_id',
        'user_name',
        'action',
        'reason',
        'order_status_at_change',
        'created',
        'previous_state_json',
        'new_state_json',
        'previous_details_json',
        'new_details_json',
      ]

      const historyRows = relevantHistory.map((h) => [
        h.id,
        h.service_order,
        h.user || '',
        h.user_name || '',
        h.action || '',
        h.reason || '',
        h.order_status_at_change || '',
        h.created || '',
        h.previous_state ? JSON.stringify(h.previous_state) : '',
        h.new_state ? JSON.stringify(h.new_state) : '',
        h.previous_details ? JSON.stringify(h.previous_details) : '',
        h.new_details ? JSON.stringify(h.new_details) : '',
      ])

      const sections: ExportSection[] = [
        { title: `Migração Estruturada da Divisão - Período ${startDate} a ${endDate}` },
        {
          title: 'service_orders (Campos de Equipe e Divisão)',
          headers: ordersHeaders,
          rows: ordersRows,
        },
        {
          title: 'order_division_history (Auditoria de Alterações)',
          headers: historyHeaders,
          rows: historyRows,
        },
      ]

      exportToCSV(`migracao_ordens_divisao_${startDate}_${endDate}`, sections)
    }
  }

  const handleExportParticipantsCSV = () => {
    const headers = [
      'Participante',
      'Papel Cadastrado',
      'OSs Apuradas',
      'Serviços Atribuídos (R$)',
      'Produtos Atribuídos (R$)',
      'Total Atribuído (R$)',
      'OSs com Divisão Não Informada',
    ]

    const rows = participantsSummary.map((p) => [
      p.user.name || 'Participante',
      (p.user as User).role || '—',
      p.assignedOrders.length,
      (p.assignedServicesCents / 100).toFixed(2),
      (p.assignedProductsCents / 100).toFixed(2),
      (p.totalAssignedCents / 100).toFixed(2),
      p.uninformedCount,
    ])

    const sections: ExportSection[] = [
      {
        title: `Relatório por Participante (Equipe e Divisão) - Período: ${startDate} a ${endDate}`,
      },
      {
        title: 'Totais da Empresa (Contagem Única)',
        headers: ['Métrica', 'Valor'],
        rows: [
          ['Total de O.S. no Período (Únicas)', companyMetrics.totalOrdersCount],
          ['Total Concluídas/Fechadas', companyMetrics.completedCount],
          ['Total Faturado em O.S.', `R$ ${companyMetrics.totalInvoiced.toFixed(2)}`],
          ['Total Pago (Receita)', `R$ ${companyMetrics.totalRevenuePaid.toFixed(2)}`],
          ['O.S. com Divisão Não Informada', companyMetrics.ordersWithoutDivision],
        ],
      },
      {
        title: 'Produção e Valores Atribuídos por Participante',
        headers,
        rows,
      },
    ]

    exportToCSV(`relatorio_participantes_${startDate}_${endDate}`, sections)
  }

  const handleExport = (format: 'csv' | 'excel') => {
    if (activeTab === 'participantes') {
      handleExportParticipantsCSV()
      return
    }

    const sections: ExportSection[] = [
      { title: 'Relatório por Categoria de Serviço' },
      {
        title: 'Resumo por Categoria',
        headers: ['Categoria', 'Qtd. OS', 'Receita (R$)'],
        rows: report
          .filter((c) => c.count > 0)
          .map((c) => [c.label, c.count, c.revenue.toFixed(2)]),
      },
    ]
    for (const cat of report.filter((c) => c.count > 0)) {
      sections.push({
        title: cat.label,
        headers: ['Número', 'Cliente', 'Status', 'Data', 'Total'],
        rows: cat.orders.map((o) => [
          o.number,
          o.expand?.customer?.name || '',
          STATUS_LABELS[o.status] || o.status,
          fmtDate(o.created),
          (o.total || 0).toFixed(2),
        ]),
      })
    }
    const fn = `relatorio_categorias_${new Date().toISOString().substring(0, 10)}`
    if (format === 'csv') exportToCSV(fn, sections)
    else exportToExcel(fn, sections)
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Carregando relatórios...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Relatórios e Auditoria
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Produção de técnicos e vendedores, divisões de OS e agrupamento por categoria.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => navigate('/relatorios/avaliacoes')}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            ★ Avaliações dos Técnicos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            className="gap-1.5"
          >
            <FileDown className="h-4 w-4" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('excel')}
            className="gap-1.5"
          >
            <FileDown className="h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(true)}
            className="gap-1.5"
          >
            <FileDown className="h-4 w-4" /> Rel. Geral / Migração
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/relatorios/categorias/imprimir')}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
          >
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'categorias' | 'participantes')}
        className="space-y-4"
      >
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="participantes" className="gap-2 text-xs font-semibold">
            <Users className="h-3.5 w-3.5" /> Por Participante (Equipe & Divisão)
          </TabsTrigger>
          <TabsTrigger value="categorias" className="gap-2 text-xs font-semibold">
            <Layers className="h-3.5 w-3.5" /> Por Categoria de Serviço
          </TabsTrigger>
        </TabsList>

        <TabsContent value="participantes" className="space-y-6">
          {/* Barra de Filtros por Período, Usuário e Papel */}
          <Card className="border-slate-200 shadow-sm bg-slate-50/50">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Data Inicial
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Data Final
                  </Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> Filtrar Participante
                  </Label>
                  <select
                    value={selectedUserFilter}
                    onChange={(e) => setSelectedUserFilter(e.target.value)}
                    aria-label="Filtrar Participante"
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 shadow-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">Todos os Participantes</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role || 'usuário'})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> Papel na OS
                  </Label>
                  <select
                    value={selectedRoleFilter}
                    onChange={(e) =>
                      setSelectedRoleFilter(e.target.value as 'all' | 'technician' | 'seller')
                    }
                    aria-label="Filtrar por Papel na OS"
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 shadow-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">Todos os Papéis</option>
                    <option value="technician">Apenas Técnicos</option>
                    <option value="seller">Apenas Vendedores</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Totais Gerais da Empresa no Período (CONTAGEM ÚNICA - Regra Inegociável) */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="border-slate-200 shadow-sm border-l-4 border-l-indigo-500">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Total de OSs no Período</p>
                  <p className="text-xl font-bold font-mono text-slate-900">
                    {companyMetrics.totalOrdersCount}{' '}
                    <span className="text-[10px] font-normal text-slate-500 font-sans">
                      (contagem única)
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Faturamento em OSs</p>
                  <p className="text-xl font-bold font-mono text-emerald-600">
                    R${' '}
                    {companyMetrics.totalInvoiced.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm border-l-4 border-l-blue-500">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">OSs Concluídas</p>
                  <p className="text-xl font-bold font-mono text-slate-900">
                    {companyMetrics.completedCount}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm border-l-4 border-l-amber-500">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Divisão Não Informada</p>
                  <p className="text-xl font-bold font-mono text-amber-600">
                    {companyMetrics.ordersWithoutDivision}{' '}
                    <span className="text-[10px] font-normal text-slate-500 font-sans">
                      (OSs históricas)
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista Detalhada por Participante */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Apuração de Valores Atribuídos por Profissional
                </h3>
                <p className="text-xs text-slate-500">
                  Valores apurados conforme divisão registrada em centavos (serviços × produtos).
                  Não são comissões automáticas.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportMigrationFiles('csv')}
                  className="gap-1 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <FileCode className="h-3.5 w-3.5" /> CSV Migração
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportMigrationFiles('json')}
                  className="gap-1 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <FileCode className="h-3.5 w-3.5" /> JSON Migração
                </Button>
              </div>
            </div>

            {participantsSummary.length === 0 ? (
              <Card className="border-slate-200 shadow-sm p-8 text-center text-slate-500 text-xs">
                Nenhum participante com ordens no período selecionado.
              </Card>
            ) : (
              participantsSummary.map((part) => {
                const totalAssignedReais = part.totalAssignedCents / 100
                const servicesReais = part.assignedServicesCents / 100
                const productsReais = part.assignedProductsCents / 100

                return (
                  <Card key={part.user.id} className="border-slate-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 py-3 px-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-xs">
                            {(part.user.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900">
                                {part.user.name}
                              </span>
                              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                                {(part.user as User).role || 'equipe'}
                              </Badge>
                            </div>
                            <span className="text-[11px] text-slate-500">
                              Participou em {part.assignedOrders.length} O.S. com divisão apurada
                              {part.uninformedCount > 0 &&
                                ` • ${part.uninformedCount} O.S. com divisão não informada`}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block">Serviços:</span>
                            <span className="font-mono font-semibold text-indigo-600">
                              R$ {servicesReais.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block">Produtos:</span>
                            <span className="font-mono font-semibold text-emerald-600">
                              R$ {productsReais.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-right bg-indigo-50 border border-indigo-200 px-3 py-1 rounded">
                            <span className="text-[10px] text-indigo-700 font-bold block uppercase">
                              Total Atribuído:
                            </span>
                            <span className="font-mono font-bold text-indigo-800 text-sm">
                              R$ {totalAssignedReais.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-0">
                      {/* O.S. com divisão apurada */}
                      {part.assignedOrders.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-medium">
                              <tr>
                                <th className="py-2 px-4">O.S.</th>
                                <th className="py-2 px-4">Cliente</th>
                                <th className="py-2 px-4">Papel na O.S.</th>
                                <th className="py-2 px-4">Modelo Divisão</th>
                                <th className="py-2 px-4 text-right">Serviços Atribuídos</th>
                                <th className="py-2 px-4 text-right">Produtos Atribuídos</th>
                                <th className="py-2 px-4 text-right font-bold">Total Atribuído</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {part.assignedOrders.map((ord) => {
                                const participantShare = ord.division_details?.participants?.find(
                                  (p) => p.userId === part.user.id,
                                )
                                const pServAmount = participantShare?.servicesAmount || 0
                                const pProdAmount = participantShare?.productsAmount || 0
                                const pTotalAmount = participantShare?.totalAmount || 0
                                const roleLabel =
                                  participantShare?.role === 'primary_tech'
                                    ? 'Técnico Principal'
                                    : participantShare?.role === 'second_tech'
                                      ? 'Segundo Técnico'
                                      : participantShare?.role === 'seller'
                                        ? 'Vendedor'
                                        : 'Participante'

                                return (
                                  <tr
                                    key={ord.id}
                                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                                    onClick={() => navigate(`/ordens/${ord.id}`)}
                                  >
                                    <td className="py-2 px-4 font-mono font-semibold text-indigo-600">
                                      {ord.number}
                                    </td>
                                    <td className="py-2 px-4 text-slate-800">
                                      {ord.expand?.customer?.name || 'Cliente'}
                                    </td>
                                    <td className="py-2 px-4 text-slate-600">
                                      <Badge variant="outline" className="text-[10px]">
                                        {roleLabel}
                                      </Badge>
                                    </td>
                                    <td className="py-2 px-4 text-slate-500 font-mono text-[11px]">
                                      {ord.division_model || 'custom'}
                                    </td>
                                    <td className="py-2 px-4 text-right font-mono text-indigo-600">
                                      R$ {pServAmount.toFixed(2)}
                                    </td>
                                    <td className="py-2 px-4 text-right font-mono text-emerald-600">
                                      R$ {pProdAmount.toFixed(2)}
                                    </td>
                                    <td className="py-2 px-4 text-right font-mono font-bold text-slate-900">
                                      R$ {pTotalAmount.toFixed(2)}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Bloco separado para O.S. antigas com "Divisão não informada" */}
                      {part.uninformedCount > 0 && (
                        <div className="bg-amber-50/40 border-t border-amber-200/60 p-3 space-y-2">
                          <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-xs">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                            <span>
                              {part.uninformedCount} O.S. com{' '}
                              <strong className="underline">Divisão não informada</strong> (mantidas
                              separadas sem redistribuição retroativa):
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {part.uninformedOrders.map((uo) => (
                              <Badge
                                key={uo.id}
                                variant="outline"
                                onClick={() => navigate(`/ordens/${uo.id}`)}
                                className="cursor-pointer bg-white border-amber-300 text-amber-900 hover:bg-amber-100 text-[10px] font-mono gap-1"
                              >
                                {uo.number} (Total OS: R$ {(uo.total || 0).toFixed(2)})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="categorias" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Faturamento Total</p>
                  <p className="text-xl font-bold font-mono text-slate-900">
                    R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Total de OS</p>
                  <p className="text-xl font-bold font-mono text-slate-900">{totalOrders}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Concluídas</p>
                  <p className="text-xl font-bold font-mono text-slate-900">{completedOrders}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {report.map((cat) => {
            if (cat.count === 0) return null
            return (
              <Card key={cat.category} className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-indigo-500" />
                      {cat.label}
                    </span>
                    <span className="flex items-center gap-3 text-xs">
                      <Badge variant="outline">{cat.count} OS</Badge>
                      <span className="font-mono font-bold text-emerald-600">
                        R$ {cat.revenue.toFixed(2)}
                      </span>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">Número</th>
                          <th className="py-2.5 px-4">Cliente</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cat.orders.map((o) => (
                          <tr key={o.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-mono font-semibold text-indigo-600">
                              {o.number}
                            </td>
                            <td className="py-2.5 px-4 font-medium text-slate-800">
                              {o.expand?.customer?.name || '—'}
                            </td>
                            <td className="py-2.5 px-4">{STATUS_LABELS[o.status] || o.status}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold">
                              R$ {(o.total || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>
      </Tabs>

      <ExportReportsModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        orders={orders}
        payments={payments}
        technicians={users.filter((u) => u.role === 'technician')}
        history={[]}
        items={orderItems}
        divisionHistory={divisionHistory}
      />
    </div>
  )
}
