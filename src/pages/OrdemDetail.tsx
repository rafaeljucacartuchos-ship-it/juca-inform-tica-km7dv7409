import { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  Play,
  CheckCircle,
  CheckCircle2,
  MessageCircle,
  FileText,
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Printer,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  FileBadge,
} from 'lucide-react'
import { formatPhone } from '@/lib/phones'
import { OrcamentoItemModal } from '@/components/OrcamentoItemModal'
import {
  deleteOrcamentoItem,
  recalculateOrcamentoTotals,
  updateOrcamento,
} from '@/services/orcamentos'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CompanyHeader } from '@/components/CompanyHeader'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/StatusBadge'
import { Textarea } from '@/components/ui/textarea'
import { ServiceOrder, StatusHistory, OrderStatus } from '@/types'
import { getServiceOrder, getStatusHistory } from '@/services/service_orders'
import { getCustomerPhone, getCustomerDisplayName } from '@/services/customers'
import { getActiveOrcamento, getOrcamentoItens, createOrcamento } from '@/services/orcamentos'
import { Orcamento, OrcamentoItem } from '@/types'
import { offlinePb } from '@/lib/offline-pb'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { OrderPhotos } from '@/components/OrderPhotos'
import { NewEquipmentModal } from '@/components/NewEquipmentModal'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import {
  openWhatsApp,
  triggerWhatsAppEvaluation,
  buildServiceMessage,
  buildOrderCompletionSummaryMessage,
  buildTechnicianPresentationMessage,
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
  const [confirmFinalizarOpen, setConfirmFinalizarOpen] = useState(false)
  const [finalizingOrder, setFinalizingOrder] = useState(false)
  const [serviceReport, setServiceReport] = useState('')
  const [starting, setStarting] = useState(false)
  const [equipmentModalOpen, setEquipmentModalOpen] = useState(false)

  // Estados para edição inline da OS
  const [isEditingOs, setIsEditingOs] = useState(false)
  const [editOsTitle, setEditOsTitle] = useState('')
  const [editOsDescription, setEditOsDescription] = useState('')
  const [savingOs, setSavingOs] = useState(false)

  // Estados para itens e edição do orçamento vinculado dentro da OS
  const [orcItemModalOpen, setOrcItemModalOpen] = useState(false)
  const [editingOrcItem, setEditingOrcItem] = useState<OrcamentoItem | null>(null)
  const [editingOrcamentoConditions, setEditingOrcamentoConditions] = useState(false)
  const [orcValidade, setOrcValidade] = useState<number>(15)
  const [orcObs, setOrcObs] = useState('')
  const [orcDesconto, setOrcDesconto] = useState<number>(0)
  const [savingOrcConditions, setSavingOrcConditions] = useState(false)

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
      const [o, h, orc] = await Promise.all([
        getServiceOrder(id),
        getStatusHistory(id),
        getActiveOrcamento(id),
      ])
      setActiveOrcamento(orc)
      if (orc?.id) {
        const oItens = await getOrcamentoItens(orc.id)
        setOrcamentoItens(oItens)
        setOrcValidade(orc.validade || 15)
        setOrcObs(orc.observacoes || '')
        setOrcDesconto(orc.desconto_total_valor || 0)
      } else {
        setOrcamentoItens([])
      }

      setOrder(o)
      setEditOsTitle(o.title || '')
      setEditOsDescription(o.description || '')
      setHistory(h)
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

  const isFinalizada = order.status === 'completed' || order.status === 'closed'

  const handleFinalizarOrdemConfirmada = async () => {
    // Validação da regra de negócio: Equipamento obrigatório ao fechar/concluir a O.S.
    const hasEquipment = Boolean(
      order.equipment_ref || (order.equipment && order.equipment.trim().length > 0),
    )
    if (!hasEquipment) {
      toast({
        title: 'Equipamento obrigatório ao fechar a O.S.',
        description: 'Vincule ou cadastre um equipamento na ordem de serviço antes de finalizá-la.',
        variant: 'destructive',
      })
      setConfirmFinalizarOpen(false)
      return
    }

    setFinalizingOrder(true)
    try {
      const upd = await offlinePb.update('service_orders', order.id, {
        status: 'completed',
        ...(serviceReport.trim() ? { service_report: serviceReport.trim() } : {}),
      })
      if (upd.queued) {
        toast({ title: 'Status salvo localmente. Será sincronizado quando houver conexão.' })
      }
      const hist = await offlinePb.create('status_history', {
        service_order: order.id,
        status: 'completed',
        note: 'Ordem de Serviço finalizada',
        changed_by: user?.id,
      })
      if (hist.queued) {
        toast({ title: 'Histórico salvo localmente. Será sincronizado quando houver conexão.' })
      }

      const productItems = orcamentoItens.filter((it) => it.tipo === 'produto')
      toast({
        title: 'Ordem de Serviço finalizada com sucesso!',
        description:
          productItems.length > 0
            ? `Estoque atualizado: ${productItems.length} ${
                productItems.length === 1 ? 'produto teve' : 'produtos tiveram'
              } a quantidade descontada.`
            : 'O.S. concluída.',
      })

      const phone = getCustomerPhone(order.expand?.customer)
      if (phone && canEdit) {
        const shareUrl = `${window.location.origin}/share/${order.id}`
        openWhatsApp(
          phone,
          buildServiceMessage(
            getCustomerDisplayName(order.expand?.customer),
            order.number,
            'completed',
            shareUrl,
          ),
        )
      }
      setConfirmFinalizarOpen(false)
      loadAll()
    } catch {
      toast({ title: 'Erro ao finalizar ordem de serviço', variant: 'destructive' })
    } finally {
      setFinalizingOrder(false)
    }
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

  // Helper síncrono para cópia imediata no gesto do clique (essencial para iOS/Safari)
  const copyToClipboardSync = (text: string): boolean => {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      textArea.style.top = '0'
      textArea.style.opacity = '0'
      textArea.setAttribute('readonly', '')
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      if (successful) return true
    } catch {
      /* ignore */
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {})
        return true
      }
    } catch {
      /* ignore */
    }

    return false
  }

  // Tarefa 1: Botão WhatsApp da O.S. vira só conversa (apresentação com nome do técnico responsável, SEM link)
  const handleWhatsApp = () => {
    const phone = getCustomerPhone(order.expand?.customer)
    if (!phone) {
      toast({ title: 'Cliente sem telefone cadastrado', variant: 'destructive' })
      return
    }
    const name = getCustomerDisplayName(order.expand?.customer)
    const equip = order.equipment || order.expand?.equipment_ref?.name || ''
    const techName =
      order.expand?.technician?.name || (order.technician === user?.id ? user?.name : undefined)

    const msg = buildTechnicianPresentationMessage({
      customerName: name,
      technicianName: techName,
      orderNumber: order.number,
      equipment: equip,
    })

    // Cópia síncrona no gesto do toque antes de qualquer await (compatibilidade Safari/iOS)
    copyToClipboardSync(msg)
    openWhatsApp(phone, msg)
    toast({
      title: 'WhatsApp aberto!',
      description: 'Mensagem de apresentação copiada e conversa aberta.',
    })
  }

  const handlePrintOrder = () => {
    if (!order?.id) return
    navigate(`/ordens/${order.id}/imprimir`)
  }

  const handleSaveOsInfo = async () => {
    if (!order) return
    if (!editOsTitle.trim()) {
      toast({ title: 'O título da ordem não pode ser vazio', variant: 'destructive' })
      return
    }
    setSavingOs(true)
    try {
      const upd = await offlinePb.update('service_orders', order.id, {
        title: editOsTitle.trim(),
        description: editOsDescription.trim(),
      })
      if (upd.queued) {
        toast({ title: 'Alterações da O.S. salvas localmente.' })
      } else {
        toast({ title: 'Dados da O.S. atualizados com sucesso!' })
      }
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              title: editOsTitle.trim(),
              description: editOsDescription.trim(),
            }
          : prev,
      )
      setIsEditingOs(false)
    } catch {
      toast({ title: 'Erro ao salvar alterações da O.S.', variant: 'destructive' })
    } finally {
      setSavingOs(false)
    }
  }

  const handleDeleteOrcItem = async (itemId: string) => {
    if (!activeOrcamento?.id) return
    if (!confirm('Deseja remover este item do orçamento?')) return
    try {
      await deleteOrcamentoItem(itemId)
      await recalculateOrcamentoTotals(activeOrcamento.id)
      toast({ title: 'Item removido do orçamento!' })
      loadAll()
    } catch {
      toast({ title: 'Erro ao remover item', variant: 'destructive' })
    }
  }

  const handleSaveOrcConditions = async () => {
    if (!activeOrcamento?.id) return
    setSavingOrcConditions(true)
    try {
      await updateOrcamento(activeOrcamento.id, {
        validade: Number(orcValidade) || 15,
        observacoes: orcObs.trim(),
        desconto_total_valor: Number(orcDesconto) || 0,
      })
      await recalculateOrcamentoTotals(activeOrcamento.id)
      toast({ title: 'Condições do orçamento atualizadas com sucesso!' })
      setEditingOrcamentoConditions(false)
      loadAll()
    } catch {
      toast({ title: 'Erro ao salvar condições do orçamento', variant: 'destructive' })
    } finally {
      setSavingOrcConditions(false)
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
            onClick={handlePrintOrder}
            className="text-xs gap-1.5 h-10 sm:h-9 justify-center"
            title="Imprimir documento unificado A4 da Ordem de Serviço"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir PDF</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleWhatsApp}
            className="text-xs gap-1.5 h-10 sm:h-9 justify-center border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold"
            title="Conversar com o cliente no WhatsApp (apresentação do técnico sem links)"
          >
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            <span>WhatsApp</span>
          </Button>

          {/* Botão Finalizar Ordem de Serviço no cabeçalho */}
          {!isFinalizada && canEdit && !fieldsLocked && (
            <Button
              size="sm"
              onClick={() => setConfirmFinalizarOpen(true)}
              disabled={finalizingOrder}
              className="text-xs gap-1.5 h-10 sm:h-9 justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold col-span-2 sm:col-span-1 shadow-sm"
              title="Finalizar esta Ordem de Serviço"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Finalizar Ordem de Serviço</span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Informações da Ordem (O.S.)
              </CardTitle>
              {canEdit && !fieldsLocked && (
                <Button
                  size="sm"
                  variant={isEditingOs ? 'ghost' : 'outline'}
                  onClick={() => {
                    if (isEditingOs) {
                      setEditOsTitle(order.title || '')
                      setEditOsDescription(order.description || '')
                      setIsEditingOs(false)
                    } else {
                      setIsEditingOs(true)
                    }
                  }}
                  className="h-7 text-xs font-semibold gap-1"
                >
                  <Edit2 className="h-3 w-3" />
                  {isEditingOs ? 'Cancelar Edição' : 'Editar O.S.'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {isEditingOs ? (
                <div className="space-y-3 p-3 bg-slate-50 border border-indigo-100 rounded-lg">
                  <div>
                    <Label className="font-bold text-slate-700 text-xs">Título da Ordem *</Label>
                    <Input
                      value={editOsTitle}
                      onChange={(e) => setEditOsTitle(e.target.value)}
                      className="h-8 text-xs bg-white mt-1"
                      placeholder="Título ou resumo da ordem de serviço"
                    />
                  </div>
                  <div>
                    <Label className="font-bold text-slate-700 text-xs">
                      Descrição do Problema
                    </Label>
                    <Textarea
                      value={editOsDescription}
                      onChange={(e) => setEditOsDescription(e.target.value)}
                      rows={3}
                      className="text-xs bg-white mt-1"
                      placeholder="Relato detalhado do cliente sobre o problema"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditingOs(false)}
                      className="h-7 text-xs"
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      disabled={savingOs}
                      onClick={handleSaveOsInfo}
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                    >
                      {savingOs ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <span className="font-semibold text-slate-500">Título da Ordem:</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{order.title}</p>
                </div>
              )}

              {/* Seção Completa de Dados do Cliente */}
              <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5 text-indigo-600" />
                    Dados do Cliente
                  </span>
                  {order.customer && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/clientes/${order.customer}`)}
                      className="h-6 text-[11px] text-indigo-600 hover:text-indigo-800 p-0 font-semibold gap-1"
                    >
                      Ver cadastro completo
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  {/* Nome Completo */}
                  <div className="sm:col-span-2 lg:col-span-1">
                    <span className="text-[11px] font-semibold text-slate-500 block">
                      Nome / Razão Social
                    </span>
                    <p className="font-bold text-slate-900 text-xs mt-0.5">
                      {order.expand?.customer?.name || 'Cliente não informado'}
                    </p>
                  </div>

                  {/* Documento (CPF / CNPJ) */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <FileBadge className="h-3 w-3 text-slate-400" />
                      Documento (CPF / CNPJ)
                    </span>
                    <p className="font-medium font-mono text-slate-900 text-xs mt-0.5">
                      {order.expand?.customer?.cpf_cnpj ||
                        (order.expand?.customer as unknown as { document?: string })?.document ||
                        'Não informado'}
                    </p>
                  </div>

                  {/* Telefones (Celular e Fixo) */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <Phone className="h-3 w-3 text-slate-400" />
                      Telefones de Contato
                    </span>
                    <div className="mt-0.5 space-y-0.5 font-medium text-slate-900 text-xs">
                      {order.expand?.customer?.celular || order.expand?.customer?.phone ? (
                        <>
                          {order.expand?.customer?.celular && (
                            <p className="font-mono">
                              <span className="text-[10px] text-slate-500 font-sans mr-1">
                                Cel:
                              </span>
                              {formatPhone(order.expand.customer.celular)}
                            </p>
                          )}
                          {order.expand?.customer?.phone &&
                            order.expand?.customer?.phone !== order.expand?.customer?.celular && (
                              <p className="font-mono">
                                <span className="text-[10px] text-slate-500 font-sans mr-1">
                                  Tel:
                                </span>
                                {formatPhone(order.expand.customer.phone)}
                              </p>
                            )}
                        </>
                      ) : (
                        <p className="text-slate-400 italic">Nenhum telefone informado</p>
                      )}
                    </div>
                  </div>

                  {/* E-mail */}
                  <div className="sm:col-span-2 lg:col-span-1">
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <Mail className="h-3 w-3 text-slate-400" />
                      E-mail
                    </span>
                    <p className="font-medium text-slate-900 text-xs mt-0.5 break-all">
                      {order.expand?.customer?.email || 'Não informado'}
                    </p>
                  </div>

                  {/* Endereço Completo */}
                  <div className="sm:col-span-2 lg:col-span-2">
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      Endereço Completo
                    </span>
                    <p className="font-medium text-slate-900 text-xs mt-0.5">
                      {order.expand?.customer?.endereco ? (
                        order.expand.customer.endereco
                      ) : order.expand?.customer?.street ? (
                        <>
                          {order.expand.customer.street}
                          {order.expand.customer.number
                            ? `, nº ${order.expand.customer.number}`
                            : ''}
                          {order.expand.customer.bairro
                            ? ` - Bairro ${order.expand.customer.bairro}`
                            : ''}
                          {order.expand.customer.city ? ` - ${order.expand.customer.city}` : ''}
                          {order.expand.customer.state ? `/${order.expand.customer.state}` : ''}
                          {order.expand.customer.zip ? ` (CEP: ${order.expand.customer.zip})` : ''}
                        </>
                      ) : (
                        <span className="text-slate-400 italic">Endereço não informado</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informações Operacionais da O.S. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="font-semibold text-slate-500">Técnico Responsável:</span>
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
              {!isEditingOs && (
                <div>
                  <span className="font-semibold text-slate-500">Descrição do Problema:</span>
                  <p className="text-slate-700 mt-1 whitespace-pre-wrap">
                    {order.description || 'Sem descrição.'}
                  </p>
                </div>
              )}
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

          {/* PAINEL UNIFICADO: Orçamento Vinculado com Edição Permitida de Itens e Condições */}
          {activeOrcamento ? (
            <Card className="border-indigo-200 shadow-sm bg-white overflow-hidden">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 bg-indigo-50/60 border-b border-indigo-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Orçamento Vinculado
                  </CardTitle>
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                    {activeOrcamento.numero_orcamento}
                  </span>
                  <Badge variant="outline" className="text-xs uppercase font-semibold bg-white">
                    {activeOrcamento.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  {canEdit && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingOrcItem(null)
                        setOrcItemModalOpen(true)
                      }}
                      className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar Item
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/orcamentos/${activeOrcamento.id}`)}
                    className="h-8 text-xs font-medium gap-1 text-slate-700 bg-white"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir Módulo
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                {/* Badges de assinaturas */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="flex flex-wrap items-center gap-2">
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

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditingOrcamentoConditions(!editingOrcamentoConditions)}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                    >
                      {editingOrcamentoConditions
                        ? 'Fechar Condições'
                        : 'Editar Condições/Desconto'}
                      {editingOrcamentoConditions ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* Bloco de edição rápida de condições do orçamento */}
                {editingOrcamentoConditions && (
                  <div className="p-3 bg-slate-50 border border-indigo-200 rounded-lg space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">
                          Validade (em dias)
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          value={orcValidade}
                          onChange={(e) => setOrcValidade(parseInt(e.target.value, 10) || 15)}
                          className="h-8 text-xs bg-white mt-1 font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">
                          Desconto Geral (R$)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={orcDesconto}
                          onChange={(e) => setOrcDesconto(parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs bg-white mt-1 font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">
                        Observações do Orçamento / Garantia
                      </Label>
                      <Textarea
                        value={orcObs}
                        onChange={(e) => setOrcObs(e.target.value)}
                        rows={2}
                        className="text-xs bg-white mt-1"
                        placeholder="Ex: Garantia de 90 dias nas peças aplicadas..."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingOrcamentoConditions(false)}
                        className="h-7 text-xs"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        disabled={savingOrcConditions}
                        onClick={handleSaveOrcConditions}
                        className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                      >
                        {savingOrcConditions ? 'Salvando...' : 'Salvar Condições'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Tabela de Itens (com Ações de Edição e Exclusão) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-700 text-xs">
                      Itens, Peças e Serviços do Orçamento:
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {orcamentoItens.length} {orcamentoItens.length === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                  {orcamentoItens.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                      <p className="text-slate-400 italic text-xs mb-2">
                        Nenhum item lançado no orçamento ainda.
                      </p>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingOrcItem(null)
                            setOrcItemModalOpen(true)
                          }}
                          className="h-7 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Adicionar Primeiro Item
                        </Button>
                      )}
                    </div>
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
                            {canEdit && <th className="py-2 px-3 text-center w-16">Ações</th>}
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
                              {canEdit && (
                                <td className="py-2 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingOrcItem(it)
                                        setOrcItemModalOpen(true)
                                      }}
                                      className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                      title="Editar item"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteOrcItem(it.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                      title="Excluir item"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Resumo financeiro do orçamento */}
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
                    <span className="font-mono text-indigo-700 text-base font-black">
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
              {!isFinalizada && canEdit && !fieldsLocked && (
                <Button
                  onClick={() => setConfirmFinalizarOpen(true)}
                  disabled={finalizingOrder}
                  className="w-full justify-start text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Finalizar Ordem de Serviço
                </Button>
              )}
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

      <AlertDialog open={confirmFinalizarOpen} onOpenChange={setConfirmFinalizarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Ordem de Serviço?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>
                Tem certeza de que deseja finalizar a Ordem de Serviço{' '}
                <strong className="font-mono text-slate-800">{order.number}</strong>?
              </span>
              <span className="block text-xs text-slate-500">
                O status será alterado para <strong>Concluída</strong> e as baixas de estoque e
                notificações cabíveis serão disparadas.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizingOrder}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinalizarOrdemConfirmada}
              disabled={finalizingOrder}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {finalizingOrder ? 'Finalizando...' : 'Confirmar e Finalizar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NewEquipmentModal
        open={equipmentModalOpen}
        onOpenChange={setEquipmentModalOpen}
        onCreated={handleEquipmentCreated}
        defaultCustomerId={order.customer}
      />

      {activeOrcamento && (
        <OrcamentoItemModal
          open={orcItemModalOpen}
          onOpenChange={setOrcItemModalOpen}
          orcamentoId={activeOrcamento.id}
          itemToEdit={editingOrcItem}
          onSaved={loadAll}
        />
      )}
    </div>
  )
}
