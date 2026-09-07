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
  Package,
  Wrench,
} from 'lucide-react'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { AddOrderItemModal } from '@/components/AddOrderItemModal'
import { EditOrderItemModal } from '@/components/EditOrderItemModal'
import { getProduct } from '@/services/products'
import { Product } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CompanyHeader } from '@/components/CompanyHeader'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/StatusBadge'
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
import { getCustomerPhone, getCustomerDisplayName } from '@/services/customers'
import { getOrderPayments } from '@/services/payments'
import pb from '@/lib/pocketbase/client'
import { offlinePb } from '@/lib/offline-pb'
import { PaymentModal } from '@/components/PaymentModal'
import { OrderPhotos } from '@/components/OrderPhotos'
import { OrderSignatures } from '@/components/OrderSignatures'
import { NewEquipmentModal } from '@/components/NewEquipmentModal'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import {
  openWhatsApp,
  triggerWhatsAppEvaluation,
  buildServiceMessage,
  buildOpenOrderWelcomeMessage,
  buildOrderCompletionSummaryMessage,
  buildWhatsAppUrl,
} from '@/lib/whatsapp'

export default function OrdemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [order, setOrder] = useState<ServiceOrder | null>(null)
  const [items, setItems] = useState<ServiceOrderItem[]>([])
  const [orderItemsTab, setOrderItemsTab] = useState<'all' | 'products' | 'services'>('all')
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
  const [editingItem, setEditingItem] = useState<ServiceOrderItem | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [equipmentModalOpen, setEquipmentModalOpen] = useState(false)
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
    // Validação da regra de negócio: Equipamento obrigatório ao fechar/concluir a O.S.
    if (newStatus === 'completed' || newStatus === 'closed') {
      const hasEquipment = Boolean(
        order.equipment_ref || (order.equipment && order.equipment.trim().length > 0),
      )
      if (!hasEquipment) {
        toast({
          title: 'Equipamento obrigatório ao fechar a O.S.',
          description:
            'Vincule ou cadastre um equipamento na ordem de serviço antes de finalizá-la.',
          variant: 'destructive',
        })
        return
      }
    }

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
      const phone = getCustomerPhone(order.expand?.customer)
      if (phone && canEdit) {
        const shareUrl = `${window.location.origin}/share/${order.id}`
        openWhatsApp(
          phone,
          buildServiceMessage(
            getCustomerDisplayName(order.expand?.customer),
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

    const hasEquipment = Boolean(
      order.equipment_ref || (order.equipment && order.equipment.trim().length > 0),
    )
    if (!hasEquipment) {
      toast({
        title: 'Equipamento obrigatório ao fechar a O.S.',
        description: 'Vincule ou cadastre um equipamento na ordem de serviço antes de finalizá-la.',
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

      const phone = getCustomerPhone(order.expand?.customer)
      const name = getCustomerDisplayName(order.expand?.customer)
      const shareUrl = `${window.location.origin}/share/${order.id}`
      const equip = order.equipment || order.expand?.equipment_ref?.name || ''

      // Requisito 2: Gerar resumo completo (itens executados, descrição e valor)
      const summaryMsg = buildOrderCompletionSummaryMessage({
        customerName: name,
        orderNumber: order.number,
        equipment: equip,
        serviceReport: serviceReport,
        items: items.map((it) => ({
          description: it.description,
          quantity: it.quantity || 1,
          unitPrice: it.unit_price || 0,
          total: it.total || 0,
        })),
        total: order.total || 0,
        shareUrl,
      })

      const waLink = phone ? buildWhatsAppUrl(phone, summaryMsg) : ''

      // (a) Registrar na coleção de mensagens/comunicação do cliente
      try {
        if (order.customer) {
          await offlinePb.create('pos_venda_messages', {
            customer: order.customer,
            service_order: order.id,
            tipo: 'resumo_finalizacao',
            status: phone ? 'ready' : 'dismissed',
            scheduled_at: new Date().toISOString(),
            sent_at: phone ? new Date().toISOString() : null,
            texto_gerado: summaryMsg,
            wa_me_link: waLink,
            channel: 'whatsapp',
          })
        }
      } catch {
        /* não interrompe conclusão */
      }

      // (b) Abrir/preparar o link wa.me para o técnico disparar em 1 toque
      if (phone && waLink) {
        window.open(waLink, '_blank')
        toast({
          title: 'Resumo da O.S. preparado no WhatsApp!',
          description: 'A conversa com o cliente foi aberta com o resumo preenchido.',
        })
      }

      // Requisito 4: Retorno automático à lista de OS ao finalizar
      setTimeout(() => {
        navigate('/ordens')
      }, 700)
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
    const phone = getCustomerPhone(order.expand?.customer)
    if (!phone) {
      toast({ title: 'Cliente sem telefone cadastrado', variant: 'destructive' })
      return
    }
    const shareUrl = `${window.location.origin}/share/${order.id}`
    const name = getCustomerDisplayName(order.expand?.customer)
    const equip = order.equipment || order.expand?.equipment_ref?.name || ''

    // Requisito 1: enquanto a ordem de serviço estiver aberta, abre a conversa com texto de boas-vindas/aviso em 1 clique
    if (order.status === 'open') {
      openWhatsApp(phone, buildOpenOrderWelcomeMessage(name, order.number, equip))
    } else if (order.status === 'completed') {
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

  const handleOpenEditItem = (item: ServiceOrderItem) => {
    if (fieldsLocked) return
    setEditingItem(item)
    setEditModalOpen(true)
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

  const handleEquipmentCreated = async (created?: any) => {
    if (!order || !created?.id) return
    const equipmentLabel = `${created.name || 'Equipamento'}${
      created.brand ? ' - ' + created.brand : ''
    }${created.model ? ' ' + created.model : ''}`

    try {
      const upd = await offlinePb.update('service_orders', order.id, {
        equipment_ref: created.id,
        equipment: equipmentLabel,
      })
      if (upd.queued) {
        toast({
          title: 'Equipamento vinculado localmente',
          description: 'Será sincronizado quando houver conexão.',
        })
      } else {
        toast({
          title: 'Equipamento vinculado com sucesso!',
          description: equipmentLabel,
        })
      }
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              equipment_ref: created.id,
              equipment: equipmentLabel,
              expand: {
                ...prev.expand,
                equipment_ref: created,
              },
            }
          : prev,
      )
      loadAll()
    } catch {
      toast({
        title: 'Erro ao vincular equipamento à O.S.',
        variant: 'destructive',
      })
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
              <StatusBadge status={order.status} />
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
            className={`text-xs gap-1.5 h-10 sm:h-9 justify-center ${
              order.status === 'open'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold'
                : ''
            }`}
            title={
              order.status === 'open'
                ? 'Conversar com o cliente da OS aberta no WhatsApp'
                : 'Enviar via WhatsApp'
            }
          >
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            <span>WhatsApp {order.status === 'open' ? 'Aberto' : ''}</span>
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
                  <span className="font-semibold text-slate-500">Tipo de Atendimento:</span>
                  <p className="font-medium text-slate-900">
                    {order.expand?.attendance_type?.name || 'Não informado'}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Equipamento:</span>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    {order.equipment_ref ||
                    (order.equipment && order.equipment.trim().length > 0) ? (
                      <p className="font-medium text-slate-900">
                        {order.equipment ||
                          order.expand?.equipment_ref?.name ||
                          'Equipamento vinculado'}
                      </p>
                    ) : (
                      <>
                        <span className="text-amber-600 font-semibold italic text-xs">
                          Não vinculado (Obrigatório ao fechar)
                        </span>
                        {canEdit && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEquipmentModalOpen(true)}
                            className="h-6 text-[11px] font-medium border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 px-2 gap-1 rounded"
                          >
                            <Plus className="h-3 w-3" />
                            Vincular / Cadastrar
                          </Button>
                        )}
                      </>
                    )}
                  </div>
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
              {/* Abas de visualização de Itens: Todos | Produtos | Serviços */}
              {(() => {
                const productItems = items.filter(
                  (it) => !!it.product && it.expand?.product?.type !== 'servico',
                )
                const serviceItems = items.filter(
                  (it) => !!it.service || it.expand?.product?.type === 'servico',
                )
                const totalProd = productItems.reduce((acc, it) => acc + (it.total || 0), 0)
                const totalServ = serviceItems.reduce((acc, it) => acc + (it.total || 0), 0)

                const displayedItems =
                  orderItemsTab === 'products'
                    ? productItems
                    : orderItemsTab === 'services'
                      ? serviceItems
                      : items

                return (
                  <div>
                    <div className="flex items-center justify-between px-4 py-2 border-y border-slate-100 bg-slate-50/70 text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setOrderItemsTab('all')}
                          className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                            orderItemsTab === 'all'
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Todos ({items.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrderItemsTab('products')}
                          className={`px-2.5 py-1 rounded font-semibold flex items-center gap-1 transition-colors ${
                            orderItemsTab === 'products'
                              ? 'bg-indigo-600 text-white'
                              : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                          }`}
                        >
                          <Package className="h-3 w-3" />
                          Produtos ({productItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrderItemsTab('services')}
                          className={`px-2.5 py-1 rounded font-semibold flex items-center gap-1 transition-colors ${
                            orderItemsTab === 'services'
                              ? 'bg-emerald-600 text-white'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          <Wrench className="h-3 w-3" />
                          Serviços ({serviceItems.length})
                        </button>
                      </div>

                      <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                        <span>
                          Produtos:{' '}
                          <strong className="font-mono text-slate-800">
                            R$ {totalProd.toFixed(2)}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Serviços:{' '}
                          <strong className="font-mono text-slate-800">
                            R$ {totalServ.toFixed(2)}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="sm:hidden divide-y divide-slate-100">
                      {displayedItems.map((item) => {
                        const isService = !!item.service || item.expand?.product?.type === 'servico'
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleOpenEditItem(item)}
                            className={`p-3 space-y-1.5 transition-colors ${
                              fieldsLocked
                                ? 'opacity-90'
                                : 'cursor-pointer hover:bg-slate-50/80 active:bg-slate-100/70'
                            }`}
                            title={fieldsLocked ? undefined : 'Clique para editar o item'}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1">
                                <span className="font-medium text-xs text-slate-900 block group-hover:text-indigo-600">
                                  {item.description}
                                </span>
                                <span
                                  className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                                    isService
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-indigo-100 text-indigo-800'
                                  }`}
                                >
                                  {isService ? 'Serviço' : 'Produto'}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteItem(item.id)
                                }}
                                disabled={fieldsLocked}
                                className="h-7 w-7 shrink-0 text-red-500 hover:bg-red-50"
                                title="Excluir item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-500">
                              <span className="flex items-center gap-1">
                                Qtd: {item.quantity || 1} × R$ {(item.unit_price || 0).toFixed(2)}
                                {!fieldsLocked && (
                                  <span className="text-[10px] text-indigo-600 font-medium ml-1">
                                    (editar)
                                  </span>
                                )}
                              </span>
                              <span className="font-bold text-slate-900 text-xs">
                                R$ {(item.total || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                      {displayedItems.length === 0 && (
                        <p className="py-6 text-center text-slate-400 text-xs">
                          Nenhum item nesta aba.
                        </p>
                      )}
                    </div>

                    <div className="overflow-x-auto w-full">
                      <table className="hidden sm:table w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="py-2.5 px-4">Tipo</th>
                            <th className="py-2.5 px-4">Descrição</th>
                            <th className="py-2.5 px-4 text-center">Qtd</th>
                            <th className="py-2.5 px-4 text-right">Un.</th>
                            <th className="py-2.5 px-4 text-right">Total</th>
                            <th className="py-2.5 px-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {displayedItems.map((item) => {
                            const isService =
                              !!item.service || item.expand?.product?.type === 'servico'
                            return (
                              <tr
                                key={item.id}
                                onClick={() => handleOpenEditItem(item)}
                                className={`transition-colors group ${
                                  fieldsLocked
                                    ? 'opacity-90'
                                    : 'cursor-pointer hover:bg-indigo-50/40'
                                }`}
                                title={
                                  fieldsLocked
                                    ? undefined
                                    : 'Clique na linha para editar valor ou quantidade'
                                }
                              >
                                <td className="py-2.5 px-4">
                                  <span
                                    className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      isService
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-indigo-100 text-indigo-800'
                                    }`}
                                  >
                                    {isService ? 'Serviço' : 'Produto'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                                  <div className="flex items-center gap-1.5">
                                    <span>{item.description || 'Item sem descrição'}</span>
                                    {!fieldsLocked && (
                                      <span className="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-500 transition-opacity">
                                        (clique para editar)
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-4 text-center font-semibold text-slate-800">
                                  {item.quantity || 1}
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono">
                                  R$ {(item.unit_price || 0).toFixed(2)}
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                                  R$ {(item.total || 0).toFixed(2)}
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <div
                                    className="flex items-center justify-end gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteItem(item.id)}
                                      disabled={fieldsLocked}
                                      className="h-7 w-7 text-red-500 hover:bg-red-50"
                                      title="Excluir item"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
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
              {order.status === 'in_progress' && (
                <Button
                  onClick={() => handleStatusChange('paused')}
                  variant="outline"
                  className="w-full justify-start text-xs h-9 border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  Pausar Atendimento
                </Button>
              )}
              {order.status === 'paused' && (
                <Button
                  onClick={() => handleStatusChange('in_progress')}
                  className="w-full justify-start text-xs h-9 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Play className="h-4 w-4 mr-1" /> Retomar Atendimento
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
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-800">Status:</span>
                    <StatusBadge status={h.status as OrderStatus} />
                  </div>
                  <p className="text-slate-500 text-[11px] mt-1">{h.note}</p>
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

      <EditOrderItemModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        item={editingItem}
        orderId={order.id}
        onSaved={loadAll}
      />

      <NewEquipmentModal
        open={equipmentModalOpen}
        onOpenChange={setEquipmentModalOpen}
        onCreated={handleEquipmentCreated}
        defaultCustomerId={order.customer}
      />
    </div>
  )
}
