import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus,
  LayoutGrid,
  List,
  Search,
  Filter,
  Wrench,
  X,
  MessageCircle,
  Calendar,
  CalendarClock,
  Clock,
  ArrowRightLeft,
  ExternalLink,
  Printer,
  Trash2,
  Share2,
  ArrowUpDown,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ServiceOrder, OrderStatus, Customer, User } from '@/types'
import {
  getServiceOrders,
  updateServiceOrder,
  addStatusHistory,
  deleteServiceOrder,
  syncServiceOrderTotal,
} from '@/services/service_orders'
import { autoApproveOrcamentosOnOsClosed, getOrcamentosByOs } from '@/services/orcamentos'
import { getCustomers, getCustomerDisplayName, getCustomerPhone } from '@/services/customers'
import { getTechnicians } from '@/services/users'
import { StatusBadge } from '@/components/StatusBadge'
import { NewOrderModal } from '@/components/NewOrderModal'
import { TransferTechnicianModal } from '@/components/TransferTechnicianModal'
import { RescheduleOrderModal } from '@/components/RescheduleOrderModal'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { RecordActionsMenu, RecordActionItem } from '@/components/RecordActionsMenu'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { openWhatsApp, triggerWhatsAppEvaluation, buildServiceMessage } from '@/lib/whatsapp'
import { STATUS_PRIORITY_MAP } from '@/lib/dashboard-utils'

/**
 * Converte attendance_date (ex: "2026-09-14", "2026-09-14 00:00:00.000Z") e attendance_time (ex: "08:30")
 * em um timestamp numérico em milissegundos.
 * Se não houver data de atendimento válida, retorna null.
 */
function getAttendanceTimestamp(order: ServiceOrder): number | null {
  if (!order.attendance_date) return null

  // Extrai a porção de data YYYY-MM-DD
  const dateMatch = order.attendance_date.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!dateMatch) return null

  const [, yStr, mStr, dStr] = dateMatch
  const year = parseInt(yStr, 10)
  const month = parseInt(mStr, 10) - 1
  const day = parseInt(dStr, 10)

  let hour = 0
  let min = 0
  if (order.attendance_time) {
    const timeMatch = order.attendance_time.match(/^(\d{1,2}):(\d{2})/)
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10)
      min = parseInt(timeMatch[2], 10)
    }
  }

  const dt = new Date(year, month, day, hour, min, 0, 0)
  const ts = dt.getTime()
  return isNaN(ts) ? null : ts
}

/**
 * Ordena ordens de serviço por data e horário de atendimento MAIS RECENTE no topo.
 * - Registros com atendimento definido têm prioridade máxima (mais recente primeiro).
 * - Registros sem data de atendimento definida vão para o final (desempate por created desc).
 */
function compareOrdersByAttendanceDesc(a: ServiceOrder, b: ServiceOrder): number {
  const tsA = getAttendanceTimestamp(a)
  const tsB = getAttendanceTimestamp(b)

  // Se ambos têm data/hora de atendimento, o mais recente fica no topo
  if (tsA !== null && tsB !== null) {
    if (tsA !== tsB) {
      return tsB - tsA
    }
    // Desempate: data de criação mais recente
    const cA = a.created ? new Date(a.created).getTime() : 0
    const cB = b.created ? new Date(b.created).getTime() : 0
    return cB - cA
  }

  // Com data de atendimento vem antes de sem data
  if (tsA !== null && tsB === null) return -1
  if (tsA === null && tsB !== null) return 1

  // Ambos sem data de atendimento: desempate por criação mais recente
  const cA = a.created ? new Date(a.created).getTime() : 0
  const cB = b.created ? new Date(b.created).getTime() : 0
  return cB - cA
}

/** Formata data de atendimento para exibição amigável: DD/MM/AAAA */
function formatAttendanceDateDisplay(dateStr?: string): string {
  if (!dateStr) return ''
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return dateStr
  return `${m[3]}/${m[2]}/${m[1]}`
}

export default function OrdensDeServico() {
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [periodTab, setPeriodTab] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const [filterText, setFilterText] = useState(searchParams.get('search') || '')
  const [sortBy, setSortBy] = useState<'attendance_desc' | 'created_desc' | 'status_priority'>(
    'attendance_desc',
  )
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [deleteOrderTarget, setDeleteOrderTarget] = useState<ServiceOrder | null>(null)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [orderToTransfer, setOrderToTransfer] = useState<ServiceOrder | null>(null)
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false)
  const [orderToReschedule, setOrderToReschedule] = useState<ServiceOrder | null>(null)
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [customerFilter, setCustomerFilter] = useState<string>('all')
  const [technicianFilter, setTechnicianFilter] = useState<string>(
    searchParams.get('technician') || searchParams.get('tecnico') || 'all',
  )
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const { user } = useAuth()
  const { toast } = useToast()

  // Sincroniza technician (ou tecnico por nome/id), status e search da query string se mudar na URL
  useEffect(() => {
    const techParam = searchParams.get('technician') || searchParams.get('tecnico')
    if (techParam) {
      // Se techParam for um id ou nome de técnico
      const matchTech = technicians.find(
        (t) => t.id === techParam || (t.name && t.name.toLowerCase() === techParam.toLowerCase()),
      )
      if (matchTech) {
        setTechnicianFilter(matchTech.id)
      } else {
        setTechnicianFilter(techParam)
      }
    }
    const statusParam = searchParams.get('status')
    if (statusParam) {
      setStatusFilter(statusParam)
    }
    const searchParam = searchParams.get('search')
    if (searchParam !== null) {
      setFilterText(searchParam)
    }
  }, [searchParams, technicians])

  const loadData = async () => {
    try {
      const filters: string[] = []
      if (user?.role === 'technician' && user?.id) {
        filters.push(`technician = "${user.id}"`)
      } else if (technicianFilter !== 'all') {
        filters.push(`technician = "${technicianFilter}"`)
      }
      if (dateStart) {
        filters.push(`created >= "${dateStart} 00:00:00.000Z"`)
      }
      if (dateEnd) {
        filters.push(`created <= "${dateEnd} 23:59:59.999Z"`)
      }
      if (statusFilter !== 'all') {
        filters.push(`status = "${statusFilter}"`)
      }
      if (customerFilter !== 'all') {
        filters.push(`customer = "${customerFilter}"`)
      }
      const filterStr = filters.join(' && ')
      const data = await getServiceOrders(filterStr)
      setOrders(data)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    getCustomers()
      .then(setCustomers)
      .catch(() => {})
    getTechnicians()
      .then(setTechnicians)
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadData()
  }, [dateStart, dateEnd, statusFilter, customerFilter, technicianFilter])

  useRealtime('service_orders', loadData)

  const columns: { status: OrderStatus; label: string; bg: string }[] = [
    { status: 'open', label: 'Abertas', bg: 'border-t-blue-500' },
    { status: 'aguardando_orcamento', label: 'Aguardando Orçamento', bg: 'border-t-cyan-500' },
    { status: 'orcamento_enviado', label: 'Orçamento Enviado', bg: 'border-t-indigo-500' },
    { status: 'in_progress', label: 'Em Andamento', bg: 'border-t-purple-500' },
    { status: 'paused', label: 'Pausadas', bg: 'border-t-orange-500' },
    { status: 'waiting_parts', label: 'Aguardando Peças', bg: 'border-t-amber-500' },
    { status: 'completed', label: 'Concluídas', bg: 'border-t-emerald-500' },
    { status: 'closed', label: 'Fechadas', bg: 'border-t-slate-500' },
    { status: 'orcamento_rejeitado', label: 'Orçamento Rejeitado', bg: 'border-t-rose-500' },
    { status: 'cancelled', label: 'Canceladas', bg: 'border-t-red-500' },
  ]

  const periodFilteredOrders = useMemo(() => {
    if (periodTab === 'all') return orders

    const now = new Date()
    const todayStr = now.toISOString().substring(0, 10)

    // Semana atual: segunda a domingo
    const currentDay = now.getDay()
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    const mondayStr = monday.toISOString().substring(0, 10)
    const sundayStr = sunday.toISOString().substring(0, 10)

    // Mês atual
    const year = now.getFullYear()
    const month = now.getMonth()
    const firstDayMonthStr = new Date(year, month, 1).toISOString().substring(0, 10)
    const lastDayMonthStr = new Date(year, month + 1, 0).toISOString().substring(0, 10)

    return orders.filter((o) => {
      const createdDate = o.created ? o.created.substring(0, 10) : ''
      if (!createdDate) return true

      if (periodTab === 'today') {
        return createdDate === todayStr
      }
      if (periodTab === 'week') {
        return createdDate >= mondayStr && createdDate <= sundayStr
      }
      if (periodTab === 'month') {
        return createdDate >= firstDayMonthStr && createdDate <= lastDayMonthStr
      }
      return true
    })
  }, [orders, periodTab])

  const filteredOrders = useMemo(() => {
    const list = periodFilteredOrders.filter((o) => {
      if (!filterText.trim()) return true
      const q = filterText.toLowerCase()
      const cust = o.expand?.customer
      const custName = (cust?.razao_social || cust?.nome_fantasia || cust?.name || '').toLowerCase()
      return (
        o.number.toLowerCase().includes(q) ||
        o.title.toLowerCase().includes(q) ||
        custName.includes(q) ||
        (o.expand?.technician?.name || '').toLowerCase().includes(q)
      )
    })

    return [...list].sort((a, b) => {
      if (sortBy === 'created_desc') {
        const timeA = a.created ? new Date(a.created).getTime() : 0
        const timeB = b.created ? new Date(b.created).getTime() : 0
        return timeB - timeA
      }
      if (sortBy === 'status_priority') {
        const pA = STATUS_PRIORITY_MAP[a.status] ?? 99
        const pB = STATUS_PRIORITY_MAP[b.status] ?? 99
        if (pA !== pB) {
          return pA - pB
        }
        return compareOrdersByAttendanceDesc(a, b)
      }
      // Padrão: data e horário de atendimento mais recente no topo
      return compareOrdersByAttendanceDesc(a, b)
    })
  }, [periodFilteredOrders, filterText, sortBy])

  const handleMoveStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateServiceOrder(orderId, { status: newStatus })
      await addStatusHistory({
        service_order: orderId,
        status: newStatus,
        note: `Status alterado no Kanban`,
        changed_by: user?.id,
      })
      // Sincroniza o total da OS ao mudar status (especialmente ao concluir/fechar)
      try {
        await syncServiceOrderTotal(orderId)
      } catch {
        /* best effort */
      }

      const changedOrder = orders.find((o) => o.id === orderId)

      if (newStatus === 'completed' || newStatus === 'closed') {
        try {
          const vinculados = await getOrcamentosByOs(orderId)
          const hasPendentes = vinculados.some(
            (o) =>
              o.status !== 'aprovado' &&
              o.status !== 'faturado' &&
              o.status !== 'substituido' &&
              (o.status === 'rascunho' ||
                o.status === 'aguardando_aprovacao' ||
                o.status === 'enviado'),
          )
          const approvedCount = await autoApproveOrcamentosOnOsClosed(
            orderId,
            changedOrder?.number,
            user?.id,
            user?.name,
          )
          if (approvedCount > 0) {
            toast({
              title: 'O.S. fechada',
              description: 'Orçamento aprovado automaticamente',
            })
          } else if (hasPendentes) {
            toast({
              title: 'Falha ao aprovar orçamento automaticamente',
              description: 'Verifique o orçamento vinculado.',
              variant: 'destructive',
            })
          }
        } catch (errAuto) {
          console.error('Falha ao auto-aprovar orçamentos vinculados:', errAuto)
          toast({
            title: 'Falha ao aprovar orçamento automaticamente',
            description: 'Verifique o orçamento vinculado.',
            variant: 'destructive',
          })
        }
      }

      toast({ title: 'Status da OS atualizado com sucesso!' })
      if (changedOrder && user?.role !== 'technician') {
        const phone = getCustomerPhone(changedOrder.expand?.customer)
        if (phone) {
          const shareUrl = `${window.location.origin}/share/${changedOrder.id}`
          const name = getCustomerDisplayName(changedOrder.expand?.customer)
          if (newStatus === 'completed') {
            const equip = changedOrder.equipment || changedOrder.expand?.equipment_ref?.name || ''
            const techName = changedOrder.expand?.technician?.name
            triggerWhatsAppEvaluation(phone, name, changedOrder.number, shareUrl, {
              equipment: equip,
              serviceReport: changedOrder.service_report || changedOrder.description,
              technicianName: techName,
            })
          } else {
            openWhatsApp(phone, buildServiceMessage(name, changedOrder.number, newStatus, shareUrl))
          }
        }
      }
      loadData()
    } catch (_) {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  const handleNotifyClient = (order: ServiceOrder) => {
    const phone = getCustomerPhone(order.expand?.customer)
    if (!phone) {
      toast({ title: 'Cliente sem telefone cadastrado', variant: 'destructive' })
      return
    }
    const shareUrl = `${window.location.origin}/share/${order.id}`
    openWhatsApp(
      phone,
      buildServiceMessage(
        getCustomerDisplayName(order.expand?.customer),
        order.number,
        order.status,
        shareUrl,
      ),
    )
  }

  const handleDeleteOrder = async () => {
    if (!deleteOrderTarget) return
    try {
      await deleteServiceOrder(deleteOrderTarget.id)
      toast({ title: 'Ordem de serviço excluída com sucesso!' })
      setDeleteOrderTarget(null)
      loadData()
    } catch {
      toast({ title: 'Erro ao excluir ordem de serviço', variant: 'destructive' })
    }
  }

  const canDeleteOs = hasPermission('os_delete')

  // Construtor dos itens de ação em cascata de uma O.S.
  const buildOrderActions = (o: ServiceOrder): RecordActionItem[] => [
    {
      key: 'open',
      label: 'Abrir O.S.',
      icon: ExternalLink,
      onClick: () => navigate(`/ordens/${o.id}`),
    },
    {
      key: 'reschedule',
      label: 'Reagendar O.S.',
      icon: CalendarClock,
      hidden: o.status === 'completed' || o.status === 'closed',
      onClick: () => {
        setOrderToReschedule(o)
        setRescheduleModalOpen(true)
      },
    },
    {
      key: 'transfer',
      label: 'Transferir técnico',
      icon: ArrowRightLeft,
      onClick: () => {
        setOrderToTransfer(o)
        setTransferModalOpen(true)
      },
    },
    {
      key: 'print',
      label: 'Imprimir PDF (A4)',
      icon: Printer,
      onClick: () => window.open(`/ordens/${o.id}/print`, '_blank'),
    },
    {
      key: 'whatsapp',
      label: 'Notificar cliente (WhatsApp)',
      icon: MessageCircle,
      hidden: user?.role === 'technician',
      onClick: () => handleNotifyClient(o),
    },
    {
      key: 'public_link',
      label: 'Página pública / Compartilhar',
      icon: Share2,
      onClick: () => window.open(`/share/${o.id}`, '_blank'),
    },
    {
      key: 'delete',
      label: 'Excluir O.S.',
      icon: Trash2,
      variant: 'destructive',
      separatorBefore: true,
      hidden: !canDeleteOs,
      onClick: () => setDeleteOrderTarget(o),
    },
  ]

  const clearFilters = () => {
    setDateStart('')
    setDateEnd('')
    setStatusFilter('all')
    setCustomerFilter('all')
    setTechnicianFilter('all')
    setFilterText('')
    setSortBy('attendance_desc')
    setSearchParams({}, { replace: true })
  }

  const hasAdvancedFilters =
    Boolean(dateStart) ||
    Boolean(dateEnd) ||
    statusFilter !== 'all' ||
    customerFilter !== 'all' ||
    (technicianFilter !== 'all' && user?.role !== 'technician') ||
    sortBy !== 'attendance_desc'

  const activeAdvancedFilterCount = [
    Boolean(dateStart),
    Boolean(dateEnd),
    statusFilter !== 'all',
    customerFilter !== 'all',
    technicianFilter !== 'all' && user?.role !== 'technician',
    sortBy !== 'attendance_desc',
  ].filter(Boolean).length

  const hasActiveFilters = hasAdvancedFilters || Boolean(filterText.trim())

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Ordens de Serviço
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Acompanhe o fluxo de trabalho e status dos chamados técnicos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-2xs flex-1 sm:flex-initial">
            <Button
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="flex-1 sm:flex-initial min-h-[44px] sm:min-h-0 h-11 sm:h-8 px-3 text-xs touch-manipulation font-semibold"
            >
              <LayoutGrid className="h-4 w-4 sm:h-3.5 sm:w-3.5 mr-1" /> Kanban
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="flex-1 sm:flex-initial min-h-[44px] sm:min-h-0 h-11 sm:h-8 px-3 text-xs touch-manipulation font-semibold"
            >
              <List className="h-4 w-4 sm:h-3.5 sm:w-3.5 mr-1" /> Lista
            </Button>
          </div>

          {user?.role !== 'technician' && (
            <Button
              onClick={() => setNewModalOpen(true)}
              className="w-full sm:w-auto min-h-[44px] h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs sm:text-sm touch-manipulation active:scale-[0.98] font-semibold"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Ordem</span>
            </Button>
          )}
        </div>
      </div>

      {/* Abas Rápidas por Período de Criação da O.S (Hoje, Esta Semana, Este Mês, Todas) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
          <span className="text-xs font-bold text-slate-800">Filtrar por Período:</span>
        </div>

        <Tabs
          value={periodTab}
          onValueChange={(v) => setPeriodTab(v as 'all' | 'today' | 'week' | 'month')}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-4 w-full sm:w-auto min-h-[40px] sm:min-h-0 h-10 sm:h-9 bg-slate-100 p-1">
            <TabsTrigger
              value="today"
              className="text-xs font-bold px-2 sm:px-3 min-h-[34px] sm:min-h-0"
            >
              Hoje
            </TabsTrigger>
            <TabsTrigger
              value="week"
              className="text-xs font-bold px-2 sm:px-3 min-h-[34px] sm:min-h-0"
            >
              Esta Semana
            </TabsTrigger>
            <TabsTrigger
              value="month"
              className="text-xs font-bold px-2 sm:px-3 min-h-[34px] sm:min-h-0"
            >
              Este Mês
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="text-xs font-bold px-2 sm:px-3 min-h-[34px] sm:min-h-0"
            >
              Todas
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Busca Principal + Botão de Filtro Mobile */}
      <div className="flex items-center gap-2 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por número, título ou cliente..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-9 h-11 sm:h-9 text-xs bg-slate-50 border-slate-200 w-full"
          />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText('')}
              aria-label="Limpar texto de busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Botão Filtrar no Mobile (abaixo de 1024px) abre o modal com todos os filtros */}
        <div className="lg:hidden shrink-0">
          <Button
            type="button"
            variant={hasAdvancedFilters ? 'default' : 'outline'}
            onClick={() => setFilterModalOpen(true)}
            className={`min-h-[44px] min-w-[44px] h-11 px-3.5 text-xs font-semibold gap-1.5 touch-manipulation ${
              hasAdvancedFilters
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'border-slate-200 text-slate-700'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filtrar</span>
            {activeAdvancedFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-indigo-700 text-[11px] font-bold">
                {activeAdvancedFilterCount}
              </span>
            )}
          </Button>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="hidden sm:inline-flex h-9 text-xs text-slate-500 gap-1 shrink-0"
          >
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      {/* Resumo de filtros ativos no mobile quando aplicados */}
      {hasAdvancedFilters && (
        <div className="lg:hidden flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-[11px] font-semibold text-slate-500">Filtros ativos:</span>
          {statusFilter !== 'all' && (
            <Badge variant="secondary" className="text-[10px] gap-1 py-1">
              Status: {statusFilter}
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                aria-label="Remover filtro de status"
                className="hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(dateStart || dateEnd) && (
            <Badge variant="secondary" className="text-[10px] gap-1 py-1">
              Data: {dateStart || '...'} a {dateEnd || '...'}
              <button
                type="button"
                onClick={() => {
                  setDateStart('')
                  setDateEnd('')
                }}
                aria-label="Remover filtro de data"
                className="hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {customerFilter !== 'all' && (
            <Badge variant="secondary" className="text-[10px] gap-1 py-1">
              Cliente selecionado
              <button
                type="button"
                onClick={() => setCustomerFilter('all')}
                aria-label="Remover filtro de cliente"
                className="hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {technicianFilter !== 'all' && (
            <Badge variant="secondary" className="text-[10px] gap-1 py-1">
              Técnico selecionado
              <button
                type="button"
                onClick={() => {
                  setTechnicianFilter('all')
                  const newParams = new URLSearchParams(searchParams)
                  newParams.delete('technician')
                  setSearchParams(newParams, { replace: true })
                }}
                aria-label="Remover filtro de técnico"
                className="hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 text-[11px] text-slate-500 hover:text-red-600 px-1.5"
          >
            Limpar todos
          </Button>
        </div>
      )}

      {/* BARRA DE FILTROS AVANÇADOS DESKTOP (visível apenas acima de 1024px) */}
      <div className="hidden lg:flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <Filter className="h-4 w-4 text-slate-400 shrink-0" />
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-slate-600 whitespace-nowrap flex items-center gap-1">
            <ArrowUpDown className="h-3 w-3 text-indigo-600" />
            Ordenar por:
          </label>
          <Select
            value={sortBy}
            onValueChange={(val: 'attendance_desc' | 'created_desc' | 'status_priority') =>
              setSortBy(val)
            }
          >
            <SelectTrigger className="h-8 text-xs w-52 bg-indigo-50/50 border-indigo-200 text-indigo-900 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="attendance_desc" className="text-xs font-medium">
                Data/Hora Atend. Mais Recente
              </SelectItem>
              <SelectItem value="created_desc" className="text-xs">
                Data de Criação (Mais recente)
              </SelectItem>
              <SelectItem value="status_priority" className="text-xs">
                Status + Atendimento
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
            Período:
          </label>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="h-8 px-2 text-xs border border-slate-200 rounded-md bg-slate-50 font-mono"
          />
          <span className="text-slate-400 text-xs">—</span>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="h-8 px-2 text-xs border border-slate-200 rounded-md bg-slate-50 font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
            Status:
          </label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Todos
              </SelectItem>
              <SelectItem value="open" className="text-xs">
                Aberta
              </SelectItem>
              <SelectItem value="aguardando_orcamento" className="text-xs">
                Aguardando Orçamento
              </SelectItem>
              <SelectItem value="orcamento_enviado" className="text-xs">
                Orçamento Enviado
              </SelectItem>
              <SelectItem value="in_progress" className="text-xs">
                Em Andamento
              </SelectItem>
              <SelectItem value="paused" className="text-xs">
                Pausada
              </SelectItem>
              <SelectItem value="waiting_parts" className="text-xs">
                Aguardando Peças
              </SelectItem>
              <SelectItem value="completed" className="text-xs">
                Concluída
              </SelectItem>
              <SelectItem value="closed" className="text-xs">
                Fechada
              </SelectItem>
              <SelectItem value="orcamento_rejeitado" className="text-xs">
                Orçamento Rejeitado
              </SelectItem>
              <SelectItem value="cancelled" className="text-xs">
                Cancelada
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
            Cliente:
          </label>
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Todos
              </SelectItem>
              {customers.map((c) => {
                const displayName = c.razao_social || c.nome_fantasia || c.name || 'Cliente'
                return (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {displayName}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {user?.role !== 'technician' && (
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
              Técnico:
            </label>
            <Select
              value={technicianFilter}
              onValueChange={(val) => {
                setTechnicianFilter(val)
                if (val === 'all') {
                  const newParams = new URLSearchParams(searchParams)
                  newParams.delete('technician')
                  setSearchParams(newParams, { replace: true })
                } else {
                  const newParams = new URLSearchParams(searchParams)
                  newParams.set('technician', val)
                  setSearchParams(newParams, { replace: true })
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todos os Técnicos
                </SelectItem>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">
                    {t.name || t.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 text-xs text-slate-500 gap-1 ml-auto"
          >
            <X className="h-3 w-3" /> Limpar filtros
          </Button>
        )}
      </div>

      {/* MODAL DE FILTROS AVANÇADOS PARA CELULAR E TABLET (< 1024px) */}
      <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
        <DialogContent className="w-full max-w-full sm:max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 sm:p-5 border-b border-slate-200">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
              Filtrar Ordens de Serviço
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Ajuste filtros avançados por status, técnico, cliente, período e ordenação.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Ordenação */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-indigo-600" />
                Ordenar por:
              </label>
              <Select
                value={sortBy}
                onValueChange={(val: 'attendance_desc' | 'created_desc' | 'status_priority') =>
                  setSortBy(val)
                }
              >
                <SelectTrigger className="min-h-[44px] h-11 text-xs w-full bg-slate-50 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="attendance_desc" className="text-xs font-medium">
                    Data/Hora Atendimento Mais Recente
                  </SelectItem>
                  <SelectItem value="created_desc" className="text-xs">
                    Data de Criação (Mais recente)
                  </SelectItem>
                  <SelectItem value="status_priority" className="text-xs">
                    Status + Atendimento
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Status da O.S.:</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="min-h-[44px] h-11 text-xs w-full bg-slate-50 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Todos os Status
                  </SelectItem>
                  <SelectItem value="open" className="text-xs">
                    Aberta
                  </SelectItem>
                  <SelectItem value="aguardando_orcamento" className="text-xs">
                    Aguardando Orçamento
                  </SelectItem>
                  <SelectItem value="orcamento_enviado" className="text-xs">
                    Orçamento Enviado
                  </SelectItem>
                  <SelectItem value="in_progress" className="text-xs">
                    Em Andamento
                  </SelectItem>
                  <SelectItem value="paused" className="text-xs">
                    Pausada
                  </SelectItem>
                  <SelectItem value="waiting_parts" className="text-xs">
                    Aguardando Peças
                  </SelectItem>
                  <SelectItem value="completed" className="text-xs">
                    Concluída
                  </SelectItem>
                  <SelectItem value="closed" className="text-xs">
                    Fechada
                  </SelectItem>
                  <SelectItem value="orcamento_rejeitado" className="text-xs">
                    Orçamento Rejeitado
                  </SelectItem>
                  <SelectItem value="cancelled" className="text-xs">
                    Cancelada
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Período de datas */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Período de Criação:</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Data Início:</span>
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="min-h-[44px] h-11 w-full px-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Data Fim:</span>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    className="min-h-[44px] h-11 w-full px-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Cliente */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Cliente:</label>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="min-h-[44px] h-11 text-xs w-full bg-slate-50 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Todos os Clientes
                  </SelectItem>
                  {customers.map((c) => {
                    const displayName = c.razao_social || c.nome_fantasia || c.name || 'Cliente'
                    return (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {displayName}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Técnico */}
            {user?.role !== 'technician' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Técnico:</label>
                <Select
                  value={technicianFilter}
                  onValueChange={(val) => {
                    setTechnicianFilter(val)
                    if (val === 'all') {
                      const newParams = new URLSearchParams(searchParams)
                      newParams.delete('technician')
                      setSearchParams(newParams, { replace: true })
                    } else {
                      const newParams = new URLSearchParams(searchParams)
                      newParams.set('technician', val)
                      setSearchParams(newParams, { replace: true })
                    }
                  }}
                >
                  <SelectTrigger className="min-h-[44px] h-11 text-xs w-full bg-slate-50 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      Todos os Técnicos
                    </SelectItem>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name || t.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={clearFilters}
              className="min-h-[44px] h-11 text-xs font-medium"
            >
              Limpar Filtros
            </Button>
            <Button
              type="button"
              onClick={() => setFilterModalOpen(false)}
              className="min-h-[44px] h-11 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5"
            >
              Aplicar e Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewMode === 'kanban' ? (
        <>
          {/* VISUALIZAÇÃO KANBAN 1 (CELULAR E TABLET < 1024px): LISTA VERTICAL DE CARTÕES EMPILHADOS 100% LARGURA */}
          <div className="block lg:hidden space-y-3 w-full">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 font-medium bg-white rounded-xl border border-slate-200">
                Nenhuma ordem de serviço encontrada com os filtros atuais.
              </div>
            ) : (
              filteredOrders.map((o) => (
                <Card
                  key={o.id}
                  className="w-full border-slate-200 shadow-xs hover:shadow-md transition-shadow bg-white overflow-hidden"
                >
                  <CardContent className="p-3.5 sm:p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/ordens/${o.id}`}
                            className="font-mono text-sm font-bold text-indigo-600 hover:underline"
                          >
                            #{o.number}
                          </Link>
                          <StatusBadge status={o.status} />
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {o.priority}
                          </Badge>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 leading-snug">{o.title}</h4>
                        <p className="text-xs text-slate-600 truncate">
                          {o.expand?.customer?.name || 'Cliente não identificado'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-base text-slate-900 block">
                          R$ {(o.total || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-600 truncate">
                        <Wrench className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                        <span className="font-medium text-slate-800 truncate">
                          {o.expand?.technician?.name || 'Sem técnico atribuído'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600 truncate">
                        <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        {o.attendance_date ? (
                          <span className="font-medium text-slate-800 truncate">
                            {formatAttendanceDateDisplay(o.attendance_date)}
                            {o.attendance_time && (
                              <span className="text-indigo-600 font-mono font-bold ml-1">
                                às {o.attendance_time}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Sem agendamento</span>
                        )}
                      </div>
                    </div>

                    {/* Mudar Status + Ações Mobile (min 44px) */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      <div className="flex-1 min-w-[140px]">
                        <Select
                          value={o.status}
                          onValueChange={(val: OrderStatus) => handleMoveStatus(o.id, val)}
                        >
                          <SelectTrigger className="min-h-[44px] h-11 text-xs w-full bg-slate-50 border-slate-200">
                            <span className="text-slate-500 mr-1">Status:</span>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open" className="text-xs font-medium">
                              Aberta
                            </SelectItem>
                            <SelectItem
                              value="aguardando_orcamento"
                              className="text-xs font-medium"
                            >
                              Aguardando Orçamento
                            </SelectItem>
                            <SelectItem value="orcamento_enviado" className="text-xs font-medium">
                              Orçamento Enviado
                            </SelectItem>
                            <SelectItem value="in_progress" className="text-xs font-medium">
                              Em Andamento
                            </SelectItem>
                            <SelectItem value="paused" className="text-xs font-medium">
                              Pausada
                            </SelectItem>
                            <SelectItem value="waiting_parts" className="text-xs font-medium">
                              Aguardando Peças
                            </SelectItem>
                            <SelectItem value="completed" className="text-xs font-medium">
                              Concluída
                            </SelectItem>
                            <SelectItem value="closed" className="text-xs font-medium">
                              Fechada
                            </SelectItem>
                            <SelectItem value="orcamento_rejeitado" className="text-xs font-medium">
                              Orçamento Rejeitado
                            </SelectItem>
                            <SelectItem value="cancelled" className="text-xs font-medium">
                              Cancelada
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        type="button"
                        variant="default"
                        onClick={() => navigate(`/ordens/${o.id}`)}
                        className="min-h-[44px] h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 rounded-lg touch-manipulation active:scale-[0.98]"
                      >
                        Abrir
                      </Button>

                      <div className="min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <RecordActionsMenu
                          label={`Ações: ${o.number}`}
                          items={buildOrderActions(o)}
                          title={`Mais ações da O.S. ${o.number}`}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* VISUALIZAÇÃO KANBAN 2 (DESKTOP/NOTEBOOK >= 1024px): COLUNAS LADO A LADO COM LARGURA FLEXÍVEL */}
          <div className="hidden lg:flex gap-3 overflow-x-auto pb-6 pt-1 w-full scroll-smooth">
            {columns.map((col) => {
              const colOrders = filteredOrders.filter((o) => o.status === col.status)
              return (
                <div
                  key={col.status}
                  className="flex flex-col flex-1 min-w-[240px] rounded-xl bg-slate-100/80 p-3 border border-slate-200 shadow-2xs"
                >
                  <div
                    className={`flex items-center justify-between mb-3 border-t-2 ${col.bg} pt-2 gap-1.5`}
                  >
                    <h3
                      className="text-xs font-bold text-slate-800 uppercase tracking-wider leading-tight whitespace-normal break-words"
                      title={col.label}
                    >
                      {col.label}
                    </h3>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                      {colOrders.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-340px)] pr-1">
                    {colOrders.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg bg-white/40">
                        Nenhuma OS
                      </div>
                    ) : (
                      colOrders.map((o) => (
                        <Card
                          key={o.id}
                          className="border-slate-200 shadow-2xs hover:shadow-md transition-shadow bg-white"
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <Link
                                to={`/ordens/${o.id}`}
                                className="font-mono text-xs font-bold text-indigo-600 hover:underline"
                              >
                                {o.number}
                              </Link>
                              <Badge variant="outline" className="text-[9px] uppercase">
                                {o.priority}
                              </Badge>
                            </div>

                            <h4 className="text-xs font-bold text-slate-900 line-clamp-2">
                              {o.title}
                            </h4>
                            <p className="text-[11px] text-slate-500 truncate">
                              {o.expand?.customer?.name || 'Cliente não identificado'}
                            </p>
                            <p className="text-[11px] text-indigo-700 font-medium truncate flex items-center gap-1 bg-indigo-50/60 px-1.5 py-0.5 rounded border border-indigo-100/60">
                              <Wrench className="h-3 w-3 text-indigo-600 shrink-0" />
                              <span className="truncate">
                                {o.expand?.technician?.name || 'Sem técnico'}
                              </span>
                            </p>

                            {/* Data e horário de atendimento (critério prioritário de ordenação) */}
                            <div className="flex items-center justify-between text-[11px] pt-1 text-slate-600">
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                                <Calendar className="h-3 w-3 text-indigo-500 shrink-0" />
                                {o.attendance_date ? (
                                  <span className="font-semibold text-slate-800">
                                    {formatAttendanceDateDisplay(o.attendance_date)}
                                    {o.attendance_time && (
                                      <span className="text-indigo-600 font-mono font-bold ml-1">
                                        às {o.attendance_time}
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-[10px]">
                                    Sem agendamento
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
                              <span className="font-mono font-semibold text-slate-900 shrink-0">
                                R$ {(o.total || 0).toFixed(2)}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Select
                                  value={o.status}
                                  onValueChange={(val: OrderStatus) => handleMoveStatus(o.id, val)}
                                >
                                  <SelectTrigger className="h-6 text-[10px] w-24 px-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="open" className="text-[10px]">
                                      Aberta
                                    </SelectItem>
                                    <SelectItem
                                      value="aguardando_orcamento"
                                      className="text-[10px]"
                                    >
                                      Aguard. Orç.
                                    </SelectItem>
                                    <SelectItem value="orcamento_enviado" className="text-[10px]">
                                      Orç. Enviado
                                    </SelectItem>
                                    <SelectItem value="in_progress" className="text-[10px]">
                                      Em Andamento
                                    </SelectItem>
                                    <SelectItem value="paused" className="text-[10px]">
                                      Pausada
                                    </SelectItem>
                                    <SelectItem value="waiting_parts" className="text-[10px]">
                                      Aguard. Peças
                                    </SelectItem>
                                    <SelectItem value="completed" className="text-[10px]">
                                      Concluída
                                    </SelectItem>
                                    <SelectItem value="closed" className="text-[10px]">
                                      Fechada
                                    </SelectItem>
                                    <SelectItem value="orcamento_rejeitado" className="text-[10px]">
                                      Orç. Rejeitado
                                    </SelectItem>
                                    <SelectItem value="cancelled" className="text-[10px]">
                                      Cancelada
                                    </SelectItem>
                                  </SelectContent>
                                </Select>

                                {/* Menu em cascata no card do Kanban */}
                                <RecordActionsMenu
                                  label={`Ações: ${o.number}`}
                                  items={buildOrderActions(o)}
                                  title={`Mais ações da O.S. ${o.number}`}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            {/* VISUALIZAÇÃO 1 (MOBILE/TABLET): CARTÕES EMPILHADOS */}
            <div className="block lg:hidden divide-y divide-slate-100">
              {filteredOrders.map((o) => (
                <div key={o.id} className="p-4 space-y-3 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/ordens/${o.id}`}
                          className="font-mono font-bold text-sm text-indigo-600 hover:underline"
                        >
                          #{o.number}
                        </Link>
                        <StatusBadge status={o.status} />
                      </div>
                      <h4 className="font-semibold text-slate-900 text-sm line-clamp-1">
                        {o.title}
                      </h4>
                      <p className="text-xs text-slate-600 truncate">
                        {o.expand?.customer?.name || 'Cliente não identificado'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-sm text-slate-900 block">
                        R$ {(o.total || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Wrench className="h-3.5 w-3.5 text-indigo-500" />
                      {o.expand?.technician?.name || 'Sem técnico'}
                    </span>
                    {o.attendance_date ? (
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {formatAttendanceDateDisplay(o.attendance_date)}{' '}
                        {o.attendance_time && `(${o.attendance_time})`}
                      </span>
                    ) : (
                      <span className="italic text-slate-400">Não agendado</span>
                    )}
                  </div>

                  {/* Ações Mobile com toque acessível (min 44px) */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => navigate(`/ordens/${o.id}`)}
                      className="flex-1 min-h-[44px] h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg touch-manipulation active:scale-[0.98]"
                    >
                      Abrir Ordem
                    </Button>
                    <div className="min-h-[44px] min-w-[44px] flex items-center justify-center">
                      <RecordActionsMenu
                        label={`Ações: ${o.number}`}
                        items={buildOrderActions(o)}
                        title={`Mais ações da O.S. ${o.number}`}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {filteredOrders.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500 font-medium">
                  Nenhuma ordem de serviço encontrada com os filtros atuais.
                </div>
              )}
            </div>

            {/* VISUALIZAÇÃO 2 (DESKTOP/NOTEBOOK): TABELA COMPLETA */}
            <div className="hidden lg:block overflow-x-auto w-full">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Número</th>
                    <th className="py-3 px-4">Atendimento</th>
                    <th className="py-3 px-4">Título</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Técnico</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600 whitespace-nowrap">
                        <Link to={`/ordens/${o.id}`}>{o.number}</Link>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {o.attendance_date ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800 text-xs">
                              {formatAttendanceDateDisplay(o.attendance_date)}
                            </span>
                            {o.attendance_time && (
                              <span className="text-[11px] font-mono text-indigo-600 font-bold">
                                {o.attendance_time}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Não agendado</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{o.title}</td>
                      <td className="py-3 px-4 text-slate-600">{o.expand?.customer?.name}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {o.expand?.technician?.name ? (
                          <Link
                            to={`/ordens?technician=${o.technician || o.expand.technician.id}`}
                            className="text-slate-600 hover:text-indigo-600 hover:underline font-medium"
                            title={`Filtrar ordens de ${o.expand.technician.name}`}
                          >
                            {o.expand.technician.name}
                          </Link>
                        ) : (
                          'Não atribuído'
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        R$ {(o.total || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* 1 Ação Principal visível fora do menu: Abrir O.S. */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/ordens/${o.id}`)}
                            className="h-8 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold px-2.5 touch-manipulation"
                            title="Ver detalhes da O.S."
                          >
                            Abrir
                          </Button>

                          {/* Menu em cascata com todas as ações adicionais */}
                          <RecordActionsMenu
                            label={`Ações: ${o.number}`}
                            items={buildOrderActions(o)}
                            title={`Mais ações da O.S. ${o.number}`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <NewOrderModal open={newModalOpen} onOpenChange={setNewModalOpen} onCreated={loadData} />

      <TransferTechnicianModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        order={orderToTransfer}
        onTransferred={loadData}
      />

      <RescheduleOrderModal
        open={rescheduleModalOpen}
        onOpenChange={setRescheduleModalOpen}
        order={orderToReschedule}
        onRescheduled={loadData}
      />

      <ConfirmDeleteDialog
        open={!!deleteOrderTarget}
        onOpenChange={(o) => !o && setDeleteOrderTarget(null)}
        onConfirm={handleDeleteOrder}
        title="Excluir Ordem de Serviço"
        description={`Tem certeza que deseja excluir a ordem #${deleteOrderTarget?.number}? Esta ação não pode ser desfeita e removerá os dados vinculados.`}
      />
    </div>
  )
}
