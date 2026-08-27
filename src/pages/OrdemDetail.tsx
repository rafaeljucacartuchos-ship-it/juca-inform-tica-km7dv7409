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
  ScanLine,
  Search,
} from 'lucide-react'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { AddOrderItemModal } from '@/components/AddOrderItemModal'
import { getProduct } from '@/services/products'
import { Product } from '@/types'
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
import { getServiceOrder, getOrderItems, getStatusHistory } from '@/services/service_orders'
import { getCatalogServices } from '@/services/services_catalog'
import { getOrderPayments } from '@/services/payments'
import pb from '@/lib/pocketbase/client'
import { offlinePb } from '@/lib/offline-pb'
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
  const [starting, setStarting] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [addingByCode, setAddingByCode] = useState(false)
  const [searchItemOpen, setSearchItemOpen] = useState(false)
  const canEdit = user?.role === 'technician' || user?.role === 'admin'
  // Antes de iniciar o atendimento (started_at vazio), os campos editáveis
  // ficam bloqueados para o técnico. Após iniciar, ficam liberados.
  const isTechnician = user?.role === 'technician'
  const notStarted = !order?.started_at
  const fieldsLocked = isTechnician && notStarted && canEdit
  const canStartService =
    isTechnician && canEdit && !!order && order.technician === user?.id && notStarted
  const serviceInProgress = !!order?.started_at && order?.status === 'in_progress'

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
      // Recalcula o subtotal a partir da soma real dos itens carregados do banco de dados
      const subtotal = it.reduce((sum, item) => sum + (item.total || 0), 0)
      const desc = Number(o.desconto) || 0
      const acresc = Number(o.acrescimo) || 0
      const calculatedTotal = Math.max(0, subtotal + acresc - desc)
      o.total = calculatedTotal

      setOrder(o)
      setItems(it)
      setHistory(h)
      setCatalog(cat)
      setPayments(p)
      setServiceReport(o.service_report || '')

      // Se houver divergência no banco de dados, persiste o total recalculado
      offlinePb.update('service_orders', id, { total: calculatedTotal }).catch(() => {})
    } catch {
      /* intentionally ignored */
    }
  }

  const handleUpdateAdjustments = async (newDesconto: number, newAcrescimo: number) => {
    if (!order) return
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0)
    const newTotal = Math.max(0, subtotal + newAcrescimo - newDesconto)
    try {
      const upd = await offlinePb.update('service_orders', order.id, {
        desconto: newDesconto,
        acrescimo: newAcrescimo,
        total: newTotal,
      })
      if (upd.queued) {
        toast({ title: 'Ajustes salvos localmente.' })
      } else {
        toast({ title: 'Valores atualizados com sucesso!' })
      }
      setOrder((prev) =>
        prev ? { ...prev, desconto: newDesconto, acrescimo: newAcrescimo, total: newTotal } : prev,
      )
    } catch {
      toast({ title: 'Erro ao atualizar valores', variant: 'destructive' })
    }
  }

  useEffect(() => {
    loadAll()
  }, [id])

  useRealtime('service_orders', (e) => {
    // Evita sobrescrever o estado local quando a notificação em tempo real for a atualização da própria ordem que estamos editando
    if (e.record?.id === id && e.action === 'update') {
      const remoteTotal = Number(e.record?.total) || 0
      setOrder((prev) => {
        if (!prev) return prev
        // Preserva o total calculado localmente dos itens se o evento remoto contiver total zerado ou divergente enquanto houver itens
        return {
          ...prev,
          ...e.record,
          total: remoteTotal > 0 || prev.total === 0 ? remoteTotal : prev.total,
        }
      })
    } else {
      loadAll()
    }
  })
  useRealtime('service_order_items', () => loadAll())
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
      const upd = await offlinePb.update('service_orders', order.id, { status: newStatus })
      if (upd.queued) {
        toast({ title: 'Status salvo localmente. Será sincronizado quando houver conexão.' })
      }
      const hist = await offlinePb.create('status_history', {
        service_order: order.id,
        status: newStatus,
        note: `Status alterado para ${newStatus}`,
        changed_by: user?.id,
      })
      if (hist.queued) {
        toast({ title: 'Histórico salvo localmente. Será sincronizado quando houver conexão.' })
      }
      if (newStatus === 'completed') {
        const productItems = items.filter((it) => !!it.product)
        toast({
          title: 'Status alterado com sucesso!',
          description:
            productItems.length > 0
              ? `Estoque atualizado: ${productItems.length} ${
                  productItems.length === 1 ? 'produto teve' : 'produtos tiveram'
                } a quantidade descontada.`
              : 'O.S. concluída — nenhum produto para baixar do estoque.',
        })
      } else {
        toast({ title: 'Status alterado com sucesso!' })
      }
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
    setStarting(true)
    try {
      const upd = await offlinePb.update('service_orders', order.id, {
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      if (upd.queued) {
        toast({ title: 'Salvo localmente. Será sincronizado quando houver conexão.' })
      }
      const hist = await offlinePb.create('status_history', {
        service_order: order.id,
        status: 'in_progress',
        note: 'Atendimento iniciado pelo técnico',
        changed_by: user?.id,
      })
      if (hist.queued && !upd.queued) {
        toast({ title: 'Histórico salvo localmente. Será sincronizado quando houver conexão.' })
      }
      if (!upd.queued && !hist.queued) toast({ title: 'Atendimento iniciado!' })
      loadAll()
    } catch {
      toast({ title: 'Erro ao iniciar atendimento', variant: 'destructive' })
    } finally {
      setStarting(false)
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
      const upd = await offlinePb.update('service_orders', order.id, {
        status: 'completed',
        service_report: serviceReport,
      })
      if (upd.queued) {
        toast({ title: 'Salvo localmente. Será sincronizado quando houver conexão.' })
      }
      const hist = await offlinePb.create('status_history', {
        service_order: order.id,
        status: 'completed',
        note: 'Serviço concluído',
        changed_by: user?.id,
      })
      if (hist.queued && !upd.queued) {
        toast({ title: 'Histórico salvo localmente. Será sincronizado quando houver conexão.' })
      }
      if (!upd.queued && !hist.queued) toast({ title: 'Serviço concluído com sucesso!' })
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
      const upd = await offlinePb.update('service_orders', order.id, {
        service_report: serviceReport,
      })
      if (upd.queued) {
        toast({ title: 'Relatório salvo localmente. Será sincronizado quando houver conexão.' })
      }
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
    const name = order.expand?.customer?.name || 'Cliente'
    // O.S. concluída: envia a mensagem de avaliação. Caso contrário, mensagem padrão.
    if (order.status === 'completed') {
      triggerWhatsAppEvaluation(phone, name, order.number, shareUrl)
    } else {
      openWhatsApp(phone, buildServiceMessage(name, order.number, order.status, shareUrl))
    }
  }

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/share/${order.id}`
    navigator.clipboard.writeText(shareUrl)
    toast({ title: 'Link de compartilhamento copiado!' })
  }

  const handleAddItem = async () => {
    if (!selectedCatalogId || addingByCode) return
    const catItem = catalog.find((c) => c.id === selectedCatalogId)
    if (!catItem) return
    setAddingByCode(true)
    try {
      const itemPrice = catItem.price || 0
      const itemTitle = catItem.title || catItem.name || 'Serviço'
      const res = await offlinePb.create('service_order_items', {
        service_order: order.id,
        service: catItem.id,
        description: itemTitle,
        quantity: 1,
        unit_price: itemPrice,
        total: itemPrice,
      })
      if (res.queued) {
        toast({ title: 'Item salvo localmente. Será sincronizado quando houver conexão.' })
      } else {
        toast({ title: 'Item adicionado à OS' })
      }
      // Otimiza a UI inserindo o item local imediatamente (online ou offline).
      setItems((prev) => [
        ...prev,
        {
          id: res.id,
          service_order: order.id,
          service: catItem.id,
          description: itemTitle,
          quantity: 1,
          unit_price: itemPrice,
          total: itemPrice,
          created: new Date().toISOString(),
        },
      ])
      setSelectedCatalogId('')
      await loadAll()
    } catch {
      toast({ title: 'Erro ao adicionar item', variant: 'destructive' })
    } finally {
      setAddingByCode(false)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await offlinePb.delete('service_order_items', itemId)
      if (res.queued) {
        toast({ title: 'Item removido localmente. Será sincronizado quando houver conexão.' })
      } else {
        toast({ title: 'Item removido' })
      }
      // Remove localmente imediatamente para feedback de UI.
      setItems((prev) => prev.filter((it) => it.id !== itemId))
      await loadAll()
    } catch {
      toast({ title: 'Erro ao remover item', variant: 'destructive' })
    }
  }

  const handleScanProduct = async (code: string) => {
    if (!order || addingByCode) return
    setAddingByCode(true)
    try {
      // Busca produto pelo ID ou SKU (busca exata ou por filtro de SKU)
      let found: Product | null = null
      try {
        found = await getProduct(code)
      } catch {
        /* não encontrou por id — tenta por sku abaixo */
      }
      if (!found) {
        const trimmed = code.trim().replace(/"/g, '')
        const results = await pb.collection('products').getFullList<Product>({
          filter: `barcode = "${trimmed}" || codigo_barras = "${trimmed}" || sku = "${trimmed}"`,
        })
        found = results[0] || null
      }
      if (!found) {
        toast({ title: 'Produto não cadastrado', variant: 'destructive' })
        return
      }
      const unitPrice = found.price || 0
      const res = await offlinePb.create('service_order_items', {
        service_order: order.id,
        product: found.id,
        description: found.name,
        quantity: 1,
        unit_price: unitPrice,
        total: unitPrice,
      })
      if (res.queued) {
        toast({ title: 'Produto salvo localmente. Será sincronizado quando houver conexão.' })
      } else {
        toast({ title: 'Produto adicionado à OS', description: found.name })
      }
      await loadAll()
    } catch {
      toast({ title: 'Erro ao adicionar produto escaneado', variant: 'destructive' })
    } finally {
      setAddingByCode(false)
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
              {serviceInProgress && (
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] gap-1">
                  <Play className="h-3 w-3" /> Atendimento em andamento
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate">{order.title}</p>
          </div>
        </div>

        {canStartService && (
          <Button
            onClick={handleStartService}
            disabled={starting}
            className="w-full sm:w-auto sm:self-start h-11 text-sm font-bold gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20"
          >
            <Play className="h-5 w-5" />
            {starting ? 'Iniciando...' : 'Iniciar Atendimento'}
          </Button>
        )}

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
                disabled={!canEdit || fieldsLocked}
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
                <Select
                  value={selectedCatalogId}
                  onValueChange={setSelectedCatalogId}
                  disabled={fieldsLocked}
                >
                  <SelectTrigger className="h-8 text-xs flex-1 sm:w-48">
                    <SelectValue placeholder="Adicionar serviço..." />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.title || c.name || 'Serviço'} (R$ {(c.price || 0).toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleAddItem}
                  disabled={fieldsLocked}
                  className="h-8 text-xs bg-indigo-600"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSearchItemOpen(true)}
                  disabled={fieldsLocked}
                  className="h-8 text-xs gap-1.5"
                  title="Buscar produto ou serviço por nome"
                >
                  <Search className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Buscar Item</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setScannerOpen(true)}
                  disabled={fieldsLocked || addingByCode}
                  className="h-8 text-xs gap-1.5"
                  title="Escanear produto por código de barras"
                >
                  <ScanLine className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Escanear Produto</span>
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
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={fieldsLocked}
                        className="h-7 w-7 shrink-0 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>
                        Qtd: {item.quantity || 1} × R$ {(item.unit_price || 0).toFixed(2)}
                      </span>
                      <span className="font-bold text-slate-900 text-xs">
                        R$ {(item.total || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="py-6 text-center text-slate-400 text-xs">Nenhum item adicionado.</p>
                )}
              </div>
              <div className="overflow-x-auto w-full">
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
                        <td className="py-2.5 px-4 font-medium">
                          {item.description || 'Item sem descrição'}
                        </td>
                        <td className="py-2.5 px-4 text-center">{item.quantity || 1}</td>
                        <td className="py-2.5 px-4 text-right font-mono">
                          R$ {(item.unit_price || 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold">
                          R$ {(item.total || 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={fieldsLocked}
                            className="h-7 w-7 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Resumo Financeiro com Subtotal, Desconto, Acréscimo e Total */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600 font-medium">
                  <span>Subtotal dos Itens:</span>
                  <span className="font-mono font-bold text-slate-800">
                    R$ {items.reduce((s, it) => s + (it.total || 0), 0).toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 border-y border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <label className="text-slate-600 font-semibold shrink-0">Desconto (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!canEdit || fieldsLocked}
                      value={order.desconto ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0)
                        handleUpdateAdjustments(val, order.acrescimo || 0)
                      }}
                      className="h-7 w-28 px-2 font-mono text-xs border border-slate-200 rounded bg-white text-rose-700 font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-slate-600 font-semibold shrink-0">Acréscimo (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!canEdit || fieldsLocked}
                      value={order.acrescimo ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0)
                        handleUpdateAdjustments(order.desconto || 0, val)
                      }}
                      className="h-7 w-28 px-2 font-mono text-xs border border-slate-200 rounded bg-white text-emerald-700 font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center font-bold text-sm pt-1">
                  <span>Total da Ordem (Subtotal + Acréscimo - Desconto):</span>
                  <span className="font-mono text-indigo-600 text-base">
                    R$ {(order.total || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <OrderPhotos orderId={order.id} canEdit={canEdit && !fieldsLocked} />
          <OrderSignatures order={order} canEdit={canEdit && !fieldsLocked} onSaved={loadAll} />
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
                  disabled={starting || fieldsLocked}
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

      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleScanProduct}
      />

      <AddOrderItemModal
        open={searchItemOpen}
        onOpenChange={setSearchItemOpen}
        orderId={order.id}
        currentTotal={order.total || 0}
        onAdded={loadAll}
      />
    </div>
  )
}
