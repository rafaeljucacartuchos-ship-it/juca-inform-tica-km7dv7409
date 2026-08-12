import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, LayoutGrid, List, Search, Filter, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ServiceOrder, OrderStatus } from '@/types'
import { getServiceOrders, updateServiceOrder, addStatusHistory } from '@/services/service_orders'
import { NewOrderModal } from '@/components/NewOrderModal'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function OrdensDeServico() {
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [searchParams] = useSearchParams()
  const [filterText, setFilterText] = useState(searchParams.get('search') || '')
  const [newModalOpen, setNewModalOpen] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const data = await getServiceOrders()
      setOrders(data)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('service_orders', loadData)

  const columns: { status: OrderStatus; label: string; bg: string }[] = [
    { status: 'open', label: 'Abertas', bg: 'border-t-blue-500' },
    { status: 'in_progress', label: 'Em Andamento', bg: 'border-t-purple-500' },
    { status: 'waiting_parts', label: 'Aguardando Peças', bg: 'border-t-amber-500' },
    { status: 'completed', label: 'Concluídas', bg: 'border-t-emerald-500' },
    { status: 'closed', label: 'Fechadas', bg: 'border-t-slate-500' },
  ]

  const filteredOrders = orders.filter((o) => {
    if (!filterText.trim()) return true
    const q = filterText.toLowerCase()
    return (
      o.number.toLowerCase().includes(q) ||
      o.title.toLowerCase().includes(q) ||
      o.expand?.customer?.name.toLowerCase().includes(q) ||
      o.expand?.technician?.name?.toLowerCase().includes(q)
    )
  })

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
      loadData()
    } catch (_) {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ordens de Serviço</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Acompanhe o fluxo de trabalho e status dos chamados técnicos.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

          <Button
            onClick={() => setNewModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-9 text-xs sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Ordem</span>
          </Button>
        </div>
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

      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colOrders = filteredOrders.filter((o) => o.status === col.status)
            return (
              <div
                key={col.status}
                className="flex flex-col min-w-[240px] rounded-xl bg-slate-100/70 p-3 border border-slate-200/80"
              >
                <div className={`flex items-center justify-between mb-3 border-t-2 ${col.bg} pt-2`}>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {col.label}
                  </h3>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                    {colOrders.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
                  {colOrders.map((o) => (
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

                        <h4 className="text-xs font-bold text-slate-900 line-clamp-2">{o.title}</h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          {o.expand?.customer?.name}
                        </p>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="font-mono font-semibold text-slate-900">
                            R$ {(o.total || 0).toFixed(2)}
                          </span>
                          <Select
                            value={o.status}
                            onValueChange={(val: OrderStatus) => handleMoveStatus(o.id, val)}
                          >
                            <SelectTrigger className="h-6 text-[10px] w-24 px-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open" className="text-[10px]">
                                Aberto
                              </SelectItem>
                              <SelectItem value="in_progress" className="text-[10px]">
                                Em Andam.
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
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Número</th>
                    <th className="py-3 px-4">Título</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Técnico</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Total</th>
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
                        {o.expand?.technician?.name || 'Não atribuído'}
                      </td>
                      <td className="py-3 px-4 capitalize">{o.status}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        R$ {(o.total || 0).toFixed(2)}
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
    </div>
  )
}
