import { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import {
  Plus,
  Trash2,
  ArrowLeft,
  DollarSign,
  Play,
  CheckCircle,
  MessageCircle,
  Share2,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CompanyHeader } from '@/components/CompanyHeader'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ServiceOrder,
  ServiceOrderItem,
  StatusHistory,
  CatalogService,
  Payment,
  OrderStatus,
} from '@/types'
import {
  getServiceOrder,
  updateServiceOrder,
  getOrderItems,
  createOrderItem,
  deleteOrderItem,
  getStatusHistory,
  addStatusHistory,
} from '@/services/service_orders'
import { getCatalogServices } from '@/services/services_catalog'
import { getOrderPayments } from '@/services/payments'
import { PaymentModal } from '@/components/PaymentModal'
import { OrderPhotos } from '@/components/OrderPhotos'
import { OrderSignatures } from '@/components/OrderSignatures'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { openWhatsApp, triggerWhatsAppEvaluation, buildServiceMessage } from '@/lib/whatsapp'

export default function OrdemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [order, setOrder] = useState<ServiceOrder | null>(null)
  const [items, setItems] = useState<ServiceOrderItem[]>([])
  const [history, setHistory] = useState<StatusHistory[]>([])
  const [catalog, setCatalog] = useState<CatalogService[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [selectedCatalogId, setSelectedCatalogId] = useState('')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [serviceReport, setServiceReport] = useState('')
  const canEdit = user?.role === 'technician' || user?.role === 'admin'

  const loadAll = async () => {
    if (!id) return
    try {
      const [o, it, h, cat, p] = await Promise.all([
        getServiceOrder(id),
        getOrderItems(id),
        getStatusHistory(id),
        getCatalogServices(),
        getOrderPayments(id),
      ])
      setOrder(o)
      setItems(it)
      setHistory(h)
      setCatalog(cat)
      setPayments(p)
      setServiceReport(o.service_report || '')
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadAll()
  }, [id])

  useRealtime('service_orders', () => loadAll())
  useRealtime('status_history', () => {
    if (id)
      getStatusHistory(id)
        .then(setHistory)
        .catch(() => {})
  })

  if (!order) {
    return <div className="p-8 text-center text-slate-500">Carregando detalhes da ordem...</div>
  }

  if (user?.role === 'technician' && order.technician !== user.id) {
    return <Navigate to="/ordens" replace />
  }

  const handleStatusChange = async (newStatus: OrderStatus) => {
    try {
      await updateServiceOrder(order.id, { status: newStatus })
      await addStatusHistory({
        service_order: order.id,
        status: newStatus,
        note: `Status alterado para ${newStatus}`,
        changed_by: user?.id,
      })
      toast({ title: 'Status alterado com sucesso!' })
      const phone = order.expand?.customer?.phone || ''
      if (phone && canEdit) {
        const shareUrl = `${window.location.origin}/share/${order.id}`
        openWhatsApp(
          phone,
          buildServiceMessage(
            order.expand?.customer?.name || 'Cliente',
            order.number,
            newStatus,
            shareUrl,
          ),
        )
      }
      loadAll()
    } catch {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  const handleStartService = async () => {
    try {
      await updateServiceOrder(order.id, { status: 'in_progress' })
      await addStatusHistory({
        service_order: order.id,
        status: 'in_progress',
        note: 'Atendimento iniciado pelo técnico',
        changed_by: user?.id,
      })
      toast({ title: 'Atendimento iniciado!' })
      loadAll()
    } catch {
      toast({ title: 'Erro ao iniciar atendimento', variant: 'destructive' })
    }
  }

  const handleFinishService = async () => {
    if (!serviceReport.trim()) {
      toast({
        title: 'Descreva o serviço executado antes de concluir',
        variant: 'destructive',
      })
      return
    }
    try {
      await updateServiceOrder(order.id, {
        status: 'completed',
        service_report: serviceReport,
      })
      await addStatusHistory({
        service_order: order.id,
        status: 'completed',
        note: 'Serviço concluído',
        changed_by: user?.id,
      })
      toast({ title: 'Serviço concluído com sucesso!' })
      const phone = order.expand?.customer?.phone || ''
      const name = order.expand?.customer?.name || 'Cliente'
      const shareUrl = `${window.location.origin}/share/${order.id}`
      if (phone) triggerWhatsAppEvaluation(phone, name, order.number, shareUrl)
      loadAll()
    } catch {
      toast({ title: 'Erro ao concluir serviço', variant: 'destructive' })
    }
  }

  const handleSaveReport = async () => {
    if (!order || serviceReport === (order.service_report || '')) return
    try {
      await updateServiceOrder(order.id, { service_report: serviceReport })
    } catch {
      /* ignored */
    }
  }

  const handleWhatsApp = () => {
    const phone = order.expand?.customer?.phone || ''
    if (!phone) {
      toast({ title: 'Cliente sem telefone cadastrado', variant: 'destructive' })
      return
    }
    const shareUrl = `${window.location.origin}/share/${order.id}`
    openWhatsApp(
      phone,
      buildServiceMessage(
        order.expand?.customer?.name || 'Cliente',
        order.number,
        order.status,
        shareUrl,
      ),
    )
  }

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/share/${order.id}`
    navigator.clipboard.writeText(shareUrl)
    toast({ title: 'Link de compartilhamento copiado!' })
  }

  const handleAddItem = async () => {
    if (!selectedCatalogId) return
    const catItem = catalog.find((c) => c.id === selectedCatalogId)
    if (!catItem) return
    try {
      await createOrderItem({
        service_order: order.id,
        service: catItem.id,
        description: catItem.name,
        quantity: 1,
        unit_price: catItem.price,
        total: catItem.price,
      })
      const newTotal = items.reduce((s, i) => s + i.total, 0) + catItem.price
      await updateServiceOrder(order.id, { total: newTotal })
      toast({ title: 'Item adicionado à OS' })
      setSelectedCatalogId('')
      loadAll()
    } catch {
      toast({ title: 'Erro ao adicionar item', variant: 'destructive' })
    }
  }

  const handleDeleteItem = async (itemId: string, itemPrice: number) => {
    try {
      await deleteOrderItem(itemId)
      const newTotal = Math.max(0, (order.total || 0) - itemPrice)
      await updateServiceOrder(order.id, { total: newTotal })
      toast({ title: 'Item removido' })
      loadAll()
    } catch {
      toast({ title: 'Erro ao remover item', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <CompanyHeader />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/ordens')}
            className="h-9 w-9 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {order.number}
              </h1>
              <Badge className="capitalize">{order.status}</Badge>
            </div>
            <p className="text-xs text-slate-500 truncate">{order.title}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/ordens/${order.id}/imprimir`)}
            className="text-xs gap-1.5 h-10 sm:h-9 justify-center"
          >
            <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Imprimir / PDF</span>
            <span className="sm:hidden">Imprimir</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="text-xs gap-1.5 h-10 sm:h-9 justify-center"
          >
            <Share2 className="h-4 w-4" /> Compartilhar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleWhatsApp}
            className="text-xs gap-1.5 h-10 sm:h-9 justify-center"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Informações da Ordem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <span className="font-semibold text-slate-500">Título da Ordem:</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{order.title}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-slate-500">Cliente:</span>
                  <p className="font-medium text-slate-900">
                    {order.expand?.customer?.name || 'Não informado'}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Técnico:</span>
                  <p className="font-medium text-slate-900">
                    {order.expand?.technician?.name || 'Não atribuído'}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Equipamento:</span>
                  <p className="font-medium text-slate-900">{order.equipment || 'Não informado'}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Prioridade:</span>
                  <p className="font-medium text-slate-900 capitalize">{order.priority}</p>
                </div>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Descrição do Problema:</span>
                <p className="text-slate-700 mt-1">{order.description || 'Sem descrição.'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Relatório de Serviço
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={serviceReport}
                onChange={(e) => setServiceReport(e.target.value)}
                onBlur={handleSaveReport}
                disabled={!canEdit}
                placeholder="Descreva o serviço executado..."
                rows={4}
                className="text-xs"
              />
              {order.status === 'in_progress' && !serviceReport.trim() && (
                <p className="text-[11px] text-amber-600 mt-1">
                  Preencha o relatório para concluir o serviço.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">Itens e Serviços</CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={selectedCatalogId} onValueChange={setSelectedCatalogId}>
                  <SelectTrigger className="h-8 text-xs flex-1 sm:w-48">
                    <SelectValue placeholder="Adicionar serviço..." />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.name} (R$ {c.price})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAddItem} className="h-8 text-xs bg-indigo-600">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="sm:hidden divide-y divide-slate-100">
                {items.map((item) => (
                  <div key={item.id} className="p-3 space-y-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-medium text-xs text-slate-900 flex-1">
                        {item.description}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteItem(item.id, item.total)}
                        className="h-7 w-7 shrink-0 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>
                        Qtd: {item.quantity} × R$ {item.unit_price.toFixed(2)}
                      </span>
                      <span className="font-bold text-slate-900 text-xs">
                        R$ {item.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="py-6 text-center text-slate-400 text-xs">Nenhum item adicionado.</p>
                )}
              </div>
              <table className="hidden sm:table w-full text-left text-xs">
                <thead className="bg-slate-50 border-y border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4">Descrição</th>
                    <th className="py-2.5 px-4 text-center">Qtd</th>
                    <th className="py-2.5 px-4 text-right">Un.</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                    <th className="py-2.5 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-4 font-medium">{item.description}</td>
                      <td className="py-2.5 px-4 text-center">{item.quantity}</td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        R$ {item.unit_price.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">
                        R$ {item.total.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteItem(item.id, item.total)}
                          className="h-7 w-7 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center font-bold text-sm">
                <span>Total da Ordem:</span>
                <span className="font-mono text-indigo-600">
                  R$ {(order.total || 0).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          <OrderPhotos orderId={order.id} canEdit={canEdit} />
          <OrderSignatures order={order} canEdit={canEdit} onSaved={loadAll} />
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.status === 'open' && (
                <Button
                  onClick={handleStartService}
                  className="w-full justify-start text-xs h-9 bg-purple-600 hover:bg-purple-700"
                >
                  <Play className="h-4 w-4 mr-1" /> Iniciar Atendimento
                </Button>
              )}
              {order.status === 'in_progress' && (
                <Button
                  onClick={handleFinishService}
                  disabled={!serviceReport.trim()}
                  className="w-full justify-start text-xs h-9 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Concluir Serviço
                </Button>
              )}
              <Button
                onClick={() => handleStatusChange('waiting_parts')}
                variant="outline"
                className="w-full justify-start text-xs h-9"
              >
                Aguardando Peças
              </Button>
              <Button
                onClick={() => setPaymentModalOpen(true)}
                className="w-full justify-start text-xs h-9 bg-emerald-600 hover:bg-emerald-700"
              >
                <DollarSign className="h-4 w-4 mr-1" /> Registrar Pagamento
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Histórico de Alterações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.map((h) => (
                <div key={h.id} className="text-xs border-l-2 border-indigo-500 pl-3 py-1">
                  <p className="font-semibold text-slate-800 capitalize">Status: {h.status}</p>
                  <p className="text-slate-500 text-[11px]">{h.note}</p>
                  <p className="text-slate-400 text-[10px] font-mono mt-0.5">
                    {h.created?.substring(0, 10).split('-').reverse().join('/')}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        orderId={order.id}
        defaultAmount={order.total}
        onSaved={loadAll}
      />
    </div>
  )
}
