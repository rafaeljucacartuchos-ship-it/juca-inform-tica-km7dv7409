import { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  DollarSign,
  Play,
  CheckCircle,
  MessageCircle,
  Share2,
  Printer,
  FileText,
  ExternalLink,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CompanyHeader } from '@/components/CompanyHeader'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/StatusBadge'
import { Textarea } from '@/components/ui/textarea'
import { ServiceOrder, StatusHistory, Payment, OrderStatus } from '@/types'
import { getServiceOrder, getStatusHistory } from '@/services/service_orders'
import { getCustomerPhone, getCustomerDisplayName } from '@/services/customers'
import { getOrderPayments } from '@/services/payments'
import { getActiveOrcamento, getOrcamentoItens, createOrcamento } from '@/services/orcamentos'
import { Orcamento, OrcamentoItem } from '@/types'
import { offlinePb } from '@/lib/offline-pb'
import { PaymentModal } from '@/components/PaymentModal'
import { OrderPhotos } from '@/components/OrderPhotos'
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
  const [activeOrcamento, setActiveOrcamento] = useState<Orcamento | null>(null)
  const [orcamentoItens, setOrcamentoItens] = useState<OrcamentoItem[]>([])
  const [creatingOrcamento, setCreatingOrcamento] = useState(false)
  const [history, setHistory] = useState<StatusHistory[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [serviceReport, setServiceReport] = useState('')
  const [starting, setStarting] = useState(false)
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
      const [o, h, p, orc] = await Promise.all([
        getServiceOrder(id),
        getStatusHistory(id),
        getOrderPayments(id),
        getActiveOrcamento(id),
      ])
      setActiveOrcamento(orc)
      if (orc?.id) {
        const oItens = await getOrcamentoItens(orc.id)
        setOrcamentoItens(oItens)
      } else {
        setOrcamentoItens([])
      }

      setOrder(o)
      setHistory(h)
      setPayments(p)
      setServiceReport(o.service_report || '')
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadAll()
  }, [id])

  useRealtime('service_orders', (e) => {
    if (e.record?.id === id && e.action === 'update') {
      setOrder((prev) => (prev ? { ...prev, ...e.record } : prev))
    } else {
      loadAll()
    }
  })
  useRealtime('orcamentos', () => loadAll())
  useRealtime('orcamento_itens', () => loadAll())
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
        const productItems = orcamentoItens.filter((it) => it.tipo === 'produto')
        toast({
          title: 'Status alterado com sucesso!',
          description:
            productItems.length > 0
              ? `Estoque atualizado: ${productItems.length} ${
                  productItems.length === 1 ? 'produto teve' : 'produtos tiveram'
                } a quantidade descontada.`
              : 'O.S. concluída.',
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
        items: orcamentoItens.map((it) => ({
          description: it.descricao,
          quantity: it.quantidade || 1,
          unitPrice: it.valor_unitario || 0,
          total: it.valor_total_item || 0,
        })),
        total: activeOrcamento?.total_geral ?? order.total ?? 0,
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

    const techName =
      order.expand?.technician?.name || (order.technician === user?.id ? user?.name : undefined)

    // Requisito 1: enquanto a ordem de serviço estiver aberta, abre a conversa com texto de boas-vindas/aviso em 1 clique
    if (order.status === 'open') {
      openWhatsApp(phone, buildOpenOrderWelcomeMessage(name, order.number, equip, techName))
    } else if (order.status === 'completed') {
      const itemsText = orcamentoItens
        .map((i) => i.descricao)
        .filter(Boolean)
        .slice(0, 3)
        .join(', ')
      triggerWhatsAppEvaluation(phone, name, order.number, shareUrl, {
        equipment: equip,
        serviceReport: order.service_report || order.description,
        technicianName: techName,
        itemsSummary: itemsText,
      })
    } else {
      openWhatsApp(phone, buildServiceMessage(name, order.number, order.status, shareUrl))
    }
  }

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/share/${order.id}`
    navigator.clipboard.writeText(shareUrl)
    toast({ title: 'Link de compartilhamento copiado!' })
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

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          {/* Botão de Orçamento Integrado à OS */}
          {activeOrcamento ? (
            <Button
              size="sm"
              onClick={() => navigate(`/orcamentos/${activeOrcamento.id}`)}
              className="text-xs gap-1.5 h-10 sm:h-9 justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              <FileText className="h-4 w-4" />
              <span>Ver Orçamento ({activeOrcamento.numero_orcamento})</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={creatingOrcamento}
              onClick={async () => {
                setCreatingOrcamento(true)
                try {
                  const novo = await createOrcamento({
                    id_os: order.id,
                    id_usuario_criador: user?.id,
                  })
                  toast({
                    title: 'Orçamento gerado com sucesso!',
                    description: `Número: ${novo.numero_orcamento}`,
                  })
                  navigate(`/orcamentos/${novo.id}`)
                } catch {
                  toast({ title: 'Erro ao gerar orçamento', variant: 'destructive' })
                } finally {
                  setCreatingOrcamento(false)
                }
              }}
              className="text-xs gap-1.5 h-10 sm:h-9 justify-center border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-bold"
            >
              <FileText className="h-4 w-4" />
              <span>{creatingOrcamento ? 'Gerando...' : 'Gerar Orçamento'}</span>
            </Button>
          )}

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

          {/* MUDANÇA 1: Card somente-leitura "Resumo do Orçamento Vinculado" */}
          {activeOrcamento ? (
            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 bg-slate-50/70 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Resumo do Orçamento Vinculado
                  </CardTitle>
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {activeOrcamento.numero_orcamento}
                  </span>
                  <Badge variant="outline" className="text-xs uppercase font-semibold">
                    {activeOrcamento.status}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate(`/orcamentos/${activeOrcamento.id}`)}
                  className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir Orçamento Completo
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                {/* Badges de assinaturas */}
                <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <span className="font-semibold text-slate-600 text-xs">Assinaturas:</span>
                  <Badge
                    className={
                      activeOrcamento.assinatura_cliente
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }
                  >
                    Cliente: {activeOrcamento.assinatura_cliente ? '✓ Assinado' : 'Pendente'}
                  </Badge>
                  <Badge
                    className={
                      activeOrcamento.assinatura_tecnico
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }
                  >
                    Técnico: {activeOrcamento.assinatura_tecnico ? '✓ Assinado' : 'Pendente'}
                  </Badge>
                </div>

                {/* Tabela de Itens (somente leitura) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-700 text-xs">Itens e Serviços:</span>
                    <span className="text-slate-400 text-[11px]">
                      {orcamentoItens.length} {orcamentoItens.length === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                  {orcamentoItens.length === 0 ? (
                    <p className="text-slate-400 italic py-3 text-center bg-slate-50 rounded">
                      Nenhum item lançado no orçamento ainda.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded border border-slate-100">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                          <tr>
                            <th className="py-2 px-3">Tipo</th>
                            <th className="py-2 px-3">Descrição</th>
                            <th className="py-2 px-3 text-center w-14">Qtd</th>
                            <th className="py-2 px-3 text-right">Unitário</th>
                            <th className="py-2 px-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {orcamentoItens.map((it) => (
                            <tr key={it.id} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3">
                                <span
                                  className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${
                                    it.tipo === 'servico'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-indigo-100 text-indigo-800'
                                  }`}
                                >
                                  {it.tipo}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-900">
                                {it.descricao}
                              </td>
                              <td className="py-2 px-3 text-center font-mono">
                                {it.quantidade || 1}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600">
                                R${' '}
                                {(it.valor_unitario || 0).toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                R${' '}
                                {(it.valor_total_item || 0).toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Resumo financeiro do orçamento (R$ 0.000,00) */}
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/80 space-y-1.5">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      R${' '}
                      {(activeOrcamento.subtotal || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {(activeOrcamento.desconto_total_valor || 0) > 0 && (
                    <div className="flex justify-between items-center text-rose-600">
                      <span>Desconto Total:</span>
                      <span className="font-mono font-semibold">
                        -R${' '}
                        {(activeOrcamento.desconto_total_valor || 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 text-sm font-bold">
                    <span className="text-slate-900">Total do Orçamento:</span>
                    <span className="font-mono text-indigo-700 text-base">
                      R${' '}
                      {(activeOrcamento.total_geral || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-indigo-200 bg-indigo-50/40 shadow-sm p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Nenhum Orçamento Vinculado a Esta O.S.
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Gere um orçamento para adicionar peças, produtos e serviços com controle de
                  aprovação, assinatura e faturamento.
                </p>
              </div>
              <Button
                size="sm"
                disabled={creatingOrcamento}
                onClick={async () => {
                  setCreatingOrcamento(true)
                  try {
                    const novo = await createOrcamento({
                      id_os: order.id,
                      id_usuario_criador: user?.id,
                    })
                    toast({
                      title: 'Orçamento gerado com sucesso!',
                      description: `Número: ${novo.numero_orcamento}`,
                    })
                    navigate(`/orcamentos/${novo.id}`)
                  } catch {
                    toast({ title: 'Erro ao gerar orçamento', variant: 'destructive' })
                  } finally {
                    setCreatingOrcamento(false)
                  }
                }}
                className="h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                {creatingOrcamento ? 'Gerando...' : 'Gerar Orçamento'}
              </Button>
            </Card>
          )}

          <OrderPhotos orderId={order.id} canEdit={canEdit && !fieldsLocked} />
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

      <NewEquipmentModal
        open={equipmentModalOpen}
        onOpenChange={setEquipmentModalOpen}
        onCreated={handleEquipmentCreated}
        defaultCustomerId={order.customer}
      />
    </div>
  )
}
