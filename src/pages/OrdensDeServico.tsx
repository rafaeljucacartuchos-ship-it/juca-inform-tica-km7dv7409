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
  ArrowRightLeft,
  ExternalLink,
  Printer,
  Trash2,
  Share2,
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
import { ServiceOrder, OrderStatus, Customer, User } from '@/types'
import {
  getServiceOrders,
  updateServiceOrder,
  addStatusHistory,
  deleteServiceOrder,
} from '@/services/service_orders'
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

export default function OrdensDeServico() {
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [periodTab, setPeriodTab] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const [filterText, setFilterText] = useState(searchParams.get('search') || '')
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
    searchParams.get('technician') || 'all',
  )
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const { user } = useAuth()
  const { toast } = useToast()

  // Sincroniza technician, status e search da query string se mudar na URL
  useEffect(() => {
    const techParam = searchParams.get('technician')
    if (techParam) {
      setTechnicianFilter(techParam)
    }
    const statusParam = searchParams.get('status')
    if (statusParam) {
      setStatusFilter(statusParam)
    }
    const searchParam = searchParams.get('search')
    if (searchParam !== null) {
      setFilterText(searchParam)
    }
  }, [searchParams])

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
      const pA = STATUS_PRIORITY_MAP[a.status] ?? 99
      const pB = STATUS_PRIORITY_MAP[b.status] ?? 99
      if (pA !== pB) {
        return pA - pB
      }
      const timeA = a.created ? new Date(a.created).getTime() : 0
      const timeB = b.created ? new Date(b.created).getTime() : 0
      return timeB - timeA
    })
  }, [periodFilteredOrders, filterText])

  const handleMoveStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateServiceOrder(orderId, { status: newStatus })
      await addStatusHistory({
        service_order: orderId,
        status: newStatus,
        note: `Status alterado no Kanban`,
        changed_by: user?.id,
      })
      toast({ title: 'Status da OS atualizado com sucesso!' })
      const changedOrder = orders.find((o) => o.id === orderId)
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
    setSearchParams({}, { replace: true })
  }

  const hasActiveFilters =
    dateStart ||
    dateEnd ||
    statusFilter !== 'all' ||
    customerFilter !== 'all' ||
    (technicianFilter !== 'all' && user?.role !== 'technician') ||
    Boolean(filterText.trim())

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Ordens de Serviço
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Acompanhe o fluxo de trabalho e status dos chamados técnicos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-2xs">
            <Button
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="h-7 px-2 text-xs"
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Kanban
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-7 px-2 text-xs"
            >
              <List className="h-3.5 w-3.5 mr-1" /> Lista
            </Button>
          </div>

          {user?.role !== 'technician' && (
            <Button
              onClick={() => setNewModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-9 text-xs sm:text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Ordem</span>
            </Button>
          )}
        </div>
      </div>

      {/* Abas Rápidas por Período de Criação da O.S (Hoje, Esta Semana, Este Mês, Todas) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
          <span className="text-xs font-bold text-slate-800">Filtrar por Período:</span>
        </div>

        <Tabs
          value={periodTab}
          onValueChange={(v) => setPeriodTab(v as 'all' | 'today' | 'week' | 'month')}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-4 w-full sm:w-auto h-9 bg-slate-100 p-1">
            <TabsTrigger value="today" className="text-xs font-bold px-3">
              Hoje
            </TabsTrigger>
            <TabsTrigger value="week" className="text-xs font-bold px-3">
              Esta Semana
            </TabsTrigger>
            <TabsTrigger value="month" className="text-xs font-bold px-3">
              Este Mês
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs font-bold px-3">
              Todas
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por número, título ou cliente..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <Filter className="h-4 w-4 text-slate-400" />
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
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Todos
              </SelectItem>
              <SelectItem value="open" className="text-xs">
                Aberto
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
                Concluído
              </SelectItem>
              <SelectItem value="closed" className="text-xs">
                Fechado
              </SelectItem>
              <SelectItem value="orcamento_rejeitado" className="text-xs">
                Orçamento Rejeitado
              </SelectItem>
              <SelectItem value="cancelled" className="text-xs">
                Cancelado
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

      {viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-6 pt-1 w-full snap-x snap-mandatory scroll-smooth">
          {columns.map((col) => {
            const colOrders = filteredOrders.filter((o) => o.status === col.status)
            return (
              <div
                key={col.status}
                className="flex flex-col w-[280px] min-w-[280px] max-w-[280px] shrink-0 snap-start rounded-xl bg-slate-100/80 p-3 border border-slate-200 shadow-2xs"
              >
                <div className={`flex items-center justify-between mb-3 border-t-2 ${col.bg} pt-2`}>
                  <h3
                    className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate mr-2"
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

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
                            <span className="font-mono font-semibold text-slate-900 shrink-0">
                              R$ {(o.total || 0).toFixed(2)}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Select
                                value={o.status}
                                onValueChange={(val: OrderStatus) => handleMoveStatus(o.id, val)}
                              >
                                <SelectTrigger className="h-6 text-[10px] w-22 px-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open" className="text-[10px]">
                                    Aberto
                                  </SelectItem>
                                  <SelectItem value="in_progress" className="text-[10px]">
                                    Em Andam.
                                  </SelectItem>
                                  <SelectItem value="paused" className="text-[10px]">
                                    Pausada
                                  </SelectItem>
                                  <SelectItem value="waiting_parts" className="text-[10px]">
                                    Peças
                                  </SelectItem>
                                  <SelectItem value="completed" className="text-[10px]">
                                    Concluído
                                  </SelectItem>
                                  <SelectItem value="closed" className="text-[10px]">
                                    Fechado
                                  </SelectItem>
                                  <SelectItem value="cancelled" className="text-[10px]">
                                    Cancelado
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
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Número</th>
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
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                        <Link to={`/ordens/${o.id}`}>{o.number}</Link>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{o.title}</td>
                      <td className="py-3 px-4 text-slate-600">{o.expand?.customer?.name}</td>
                      <td className="py-3 px-4 text-slate-600">
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
                      <td className="py-3 px-4">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        R$ {(o.total || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* 1 Ação Principal visível fora do menu: Abrir O.S. */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/ordens/${o.id}`)}
                            className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold px-2"
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
