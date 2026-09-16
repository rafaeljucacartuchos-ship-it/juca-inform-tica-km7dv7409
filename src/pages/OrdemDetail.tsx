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
  Send,
  ArrowRightLeft,
  CalendarClock,
  Clock,
  Share2,
  Copy,
  ArrowRight,
  Loader2,
  Monitor,
  ImageIcon,
} from 'lucide-react'
import { formatPhone } from '@/lib/phones'
import { OrcamentoItemModal } from '@/components/OrcamentoItemModal'
import {
  deleteOrcamentoItem,
  recalculateOrcamentoTotals,
  updateOrcamento,
  autoApproveOrcamentosOnOsClosed,
} from '@/services/orcamentos'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CompanyHeader } from '@/components/CompanyHeader'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/StatusBadge'
import { Textarea } from '@/components/ui/textarea'
import {
  ServiceOrder,
  StatusHistory,
  OrderStatus,
  Equipment,
  Orcamento,
  OrcamentoItem,
} from '@/types'
import {
  getServiceOrder,
  getStatusHistory,
  deleteServiceOrder,
  syncServiceOrderTotal,
} from '@/services/service_orders'
import { getCustomerPhone, getCustomerDisplayName } from '@/services/customers'
import { getActiveOrcamento, getOrcamentoItens, createOrcamento } from '@/services/orcamentos'
import { getErrorMessage } from '@/lib/pocketbase/errors'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { OrderPhotos } from '@/components/OrderPhotos'
import { NewEquipmentModal } from '@/components/NewEquipmentModal'
import { EditEquipmentModal } from '@/components/EditEquipmentModal'
import { TransferTechnicianModal } from '@/components/TransferTechnicianModal'
import { RescheduleOrderModal } from '@/components/RescheduleOrderModal'
import { getEquipmentItem } from '@/services/equipment'
import { RecordActionsMenu, RecordActionItem } from '@/components/RecordActionsMenu'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import {
  openWhatsApp,
  buildServiceMessage,
  buildOrderCompletionSummaryMessage,
  buildTechnicianPresentationMessage,
  buildOsDocumentMessage,
  buildWhatsAppUrl,
} from '@/lib/whatsapp'

export default function OrdemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
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
  const [editEquipmentModalOpen, setEditEquipmentModalOpen] = useState(false)
  const [editEquipmentTab, setEditEquipmentTab] = useState<'edit' | 'photos'>('edit')
  const [activeEquipmentDetail, setActiveEquipmentDetail] = useState<Equipment | null>(null)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false)
  const [confirmDeleteOsOpen, setConfirmDeleteOsOpen] = useState(false)
  const [deletingOs, setDeletingOs] = useState(false)

  const handleDeleteOs = async () => {
    if (!order?.id) return
    setDeletingOs(true)
    try {
      await deleteServiceOrder(order.id)
      toast({
        title: 'Ordem de Serviço excluída com sucesso!',
        description: `O.S. ${order.number} removida.`,
      })
      navigate('/ordens')
    } catch {
      toast({
        title: 'Erro ao excluir ordem de serviço',
        description: 'Verifique se você tem permissão de exclusão ou se há pendências vinculadas.',
        variant: 'destructive',
      })
    } finally {
      setDeletingOs(false)
      setConfirmDeleteOsOpen(false)
    }
  }

  // Modal Seletor de Compartilhamento do Link da OS (/share/:id)
  const [shareChooserOpen, setShareChooserOpen] = useState(false)
  const [shareChooserTitle, setShareChooserTitle] = useState('Compartilhar Documento da O.S.')
  const [shareChooserDescription, setShareChooserDescription] = useState('')
  const [pendingSharePhone, setPendingSharePhone] = useState('')
  const [pendingShareMessage, setPendingShareMessage] = useState('')
  const [pendingShareUrl, setPendingShareUrl] = useState('')
  const [pendingAfterShareAction, setPendingAfterShareAction] = useState<(() => void) | null>(null)

  const openShareChooser = (params: {
    title?: string
    description?: string
    phone?: string
    message: string
    url: string
    afterShareAction?: () => void
  }) => {
    setShareChooserTitle(params.title || 'Compartilhar Documento da O.S.')
    setShareChooserDescription(params.description || '')
    setPendingSharePhone(params.phone || '')
    setPendingShareMessage(params.message)
    setPendingShareUrl(params.url)
    setPendingAfterShareAction(params.afterShareAction ? () => params.afterShareAction! : null)
    setShareChooserOpen(true)
  }

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

  const isTechnician = user?.role === 'technician'
  const isOrderOwner = Boolean(
    order && user && (order.technician === user.id || order.expand?.technician?.id === user.id),
  )
  const canEdit = user?.role === 'admin' || (isTechnician && (!order?.technician || isOrderOwner))
  const canDeleteOs = user?.role === 'admin' || hasPermission('os_delete')
  // Antes de iniciar o atendimento (started_at vazio), os campos editáveis
  // ficam bloqueados para o técnico. Após iniciar, ficam liberados.
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

  // Técnicos podem visualizar qualquer O.S. (inclusive para consultar orçamentos ou histórico de outros colegas técnicos),
  // mas canEdit só permite edições se o usuário for admin ou for o técnico atribuído a esta O.S.

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

      // Sincroniza o total da OS com a hierarquia de orçamento e itens
      try {
        await syncServiceOrderTotal(order.id)
      } catch {
        /* best effort */
      }

      try {
        const approvedCount = await autoApproveOrcamentosOnOsClosed(
          order.id,
          order.number,
          user?.id,
          user?.name,
        )
        if (approvedCount > 0) {
          toast({
            title: 'O.S. fechada',
            description: 'Orçamento aprovado automaticamente',
          })
        }
      } catch {
        /* best effort */
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

      setConfirmFinalizarOpen(false)

      const phone = getCustomerPhone(order.expand?.customer) || ''
      const shareUrl = `${window.location.origin}/share/${order.id}`
      const completionMsg = buildServiceMessage(
        getCustomerDisplayName(order.expand?.customer),
        order.number,
        'completed',
        shareUrl,
      )

      // Abre o seletor de compartilhamento (WhatsApp, Copiar link, Compartilhamento nativo)
      openShareChooser({
        title: 'Compartilhar Documento da O.S. Finalizada',
        description:
          'Escolha o canal para enviar o link do documento público ao cliente ou à equipe.',
        phone,
        message: completionMsg,
        url: shareUrl,
        afterShareAction: () => {
          loadAll()
        },
      })

      loadAll()
    } catch (err) {
      const errDetail = getErrorMessage(err)
      toast({
        title: 'Erro ao finalizar ordem de serviço',
        description: errDetail || 'Verifique se os dados estão completos e tente novamente.',
        variant: 'destructive',
      })
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
      // Ao transicionar para completed ou closed, sincroniza o total da OS
      if (newStatus === 'completed' || newStatus === 'closed') {
        try {
          await syncServiceOrderTotal(order.id)
        } catch {
          /* best effort */
        }

        try {
          const approvedCount = await autoApproveOrcamentosOnOsClosed(
            order.id,
            order.number,
            user?.id,
            user?.name,
          )
          if (approvedCount > 0) {
            toast({
              title: 'O.S. fechada',
              description: 'Orçamento aprovado automaticamente',
            })
          }
        } catch {
          /* best effort */
        }
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

      // Sincroniza o total da OS com a hierarquia de orçamento e itens
      try {
        await syncServiceOrderTotal(order.id)
      } catch {
        /* best effort */
      }

      try {
        const approvedCount = await autoApproveOrcamentosOnOsClosed(
          order.id,
          order.number,
          user?.id,
          user?.name,
        )
        if (approvedCount > 0) {
          toast({
            title: 'O.S. fechada',
            description: 'Orçamento aprovado automaticamente',
          })
        }
      } catch {
        /* best effort */
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

      // (b) Exibir seletor de compartilhamento (WhatsApp, Copiar link, Nativo)
      openShareChooser({
        title: 'Compartilhar Conclusão do Serviço',
        description:
          'Escolha o canal para enviar o resumo da conclusão e o link do documento da O.S.:',
        phone,
        message: summaryMsg,
        url: shareUrl,
        afterShareAction: () => {
          setTimeout(() => {
            navigate('/ordens')
          }, 500)
        },
      })
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
    let textArea: HTMLTextAreaElement | null = null
    try {
      textArea = document.createElement('textarea')
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
      if (successful) return true
    } catch {
      /* ignore */
    } finally {
      if (textArea && textArea.parentNode) {
        try {
          textArea.parentNode.removeChild(textArea)
        } catch {
          // nó já removido
        }
      }
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

  // Ações de compartilhamento (WhatsApp, Copiar link, Compartilhamento nativo do aparelho)
  const handleShareToWhatsApp = () => {
    if (!pendingSharePhone) {
      toast({
        title: 'Cliente sem WhatsApp informado',
        description: 'Cadastre o celular do cliente antes de enviar via WhatsApp.',
        variant: 'destructive',
      })
      return
    }
    copyToClipboardSync(pendingShareUrl)
    copyToClipboardSync(pendingShareMessage)
    openWhatsApp(pendingSharePhone, pendingShareMessage)
    setShareChooserOpen(false)
    toast({
      title: 'WhatsApp aberto!',
      description: 'Link e mensagem preparados na conversa.',
    })
    if (pendingAfterShareAction) {
      const cb = pendingAfterShareAction
      setPendingAfterShareAction(null)
      cb()
    }
  }

  const handleCopyShareLink = () => {
    const success = copyToClipboardSync(pendingShareUrl)
    if (success) {
      toast({
        title: 'Link copiado com sucesso!',
        description: pendingShareUrl,
      })
    } else {
      toast({
        title: 'Não foi possível copiar automaticamente',
        description: pendingShareUrl,
      })
    }
    setShareChooserOpen(false)
    if (pendingAfterShareAction) {
      const cb = pendingAfterShareAction
      setPendingAfterShareAction(null)
      cb()
    }
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `O.S. ${order?.number || ''} - JUCA Informática`,
          text: pendingShareMessage || `Documento da Ordem de Serviço ${order?.number || ''}`,
          url: pendingShareUrl,
        })
        toast({ title: 'Compartilhado com sucesso!' })
        setShareChooserOpen(false)
        if (pendingAfterShareAction) {
          const cb = pendingAfterShareAction
          setPendingAfterShareAction(null)
          cb()
        }
        return
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          // Usuário apenas cancelou o menu de compartilhamento
          return
        }
      }
    }
    // Fallback: copiar para a área de transferência
    handleCopyShareLink()
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

  // Enviar Documento Oficial da O.S. (modelo técnico com link público /share/:id)
  const handleEnviarDocumentoOs = async () => {
    const phone = getCustomerPhone(order.expand?.customer) || ''
    const name = getCustomerDisplayName(order.expand?.customer)
    const equip = order.equipment || order.expand?.equipment_ref?.name || ''
    const osNum = order.number
    const techName =
      order.expand?.technician?.name || (order.technician === user?.id ? user?.name : undefined)
    const serviceRep = serviceReport || order.service_report

    // Link enviado aponta para a rota pública /share/:id (OrdemShare), que não exige login
    // e inclui documento completo, fotos, assinatura digital, pesquisa de satisfação e botão imprimir.
    const osDocumentUrl = `${window.location.origin}/share/${order.id}`
    const msg = buildOsDocumentMessage({
      customerName: name,
      osNumber: osNum,
      numeroOrcamento: activeOrcamento?.numero_orcamento,
      documentUrl: osDocumentUrl,
      equipment: equip,
      technicianName: techName,
      serviceReport: serviceRep,
    })

    // Registra tentativa no pós-venda/comunicação se houver cliente
    try {
      const custId = order.customer || order.expand?.customer?.id
      if (custId) {
        await offlinePb.create('pos_venda_messages', {
          customer: custId,
          service_order: order.id,
          tipo: 'resumo_finalizacao',
          status: phone ? 'sent' : 'ready',
          scheduled_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          texto_gerado: msg,
          wa_me_link: phone ? buildWhatsAppUrl(phone, msg) : '',
          channel: 'whatsapp',
        })
      }
    } catch {
      /* ignore */
    }

    // Abre o Seletor de Compartilhamento (WhatsApp, Copiar link, Compartilhamento nativo)
    openShareChooser({
      title: 'Enviar Documento da O.S. ao Cliente',
      description:
        'Escolha como deseja enviar o link do documento público da ordem de serviço (/share):',
      phone,
      message: msg,
      url: osDocumentUrl,
    })
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
    } catch (err) {
      const errDetail = getErrorMessage(err)
      toast({
        title: 'Erro ao salvar alterações da O.S.',
        description: errDetail || 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
      // Os dados digitados em editOsTitle e editOsDescription permanecem no formulário
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
      if (order?.id) {
        await syncServiceOrderTotal(order.id)
      }
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
    } catch (err) {
      const errDetail = getErrorMessage(err)
      toast({
        title: 'Erro ao salvar condições do orçamento',
        description: errDetail || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingOrcConditions(false)
    }
  }

  const handleOpenEquipmentModal = async (tab: 'edit' | 'photos' = 'edit') => {
    if (!order) return

    // 1) Se já temos o id do equipamento vinculado (order.equipment_ref)
    if (order.equipment_ref) {
      try {
        const eq = await getEquipmentItem(order.equipment_ref)
        setActiveEquipmentDetail(eq)
        setEditEquipmentTab(tab)
        setEditEquipmentModalOpen(true)
        return
      } catch {
        // Se já temos no expand
        if (order.expand?.equipment_ref) {
          setActiveEquipmentDetail(order.expand.equipment_ref)
          setEditEquipmentTab(tab)
          setEditEquipmentModalOpen(true)
          return
        }
      }
    }

    // 2) Se o expand já possui o equipamento
    if (order.expand?.equipment_ref?.id) {
      setActiveEquipmentDetail(order.expand.equipment_ref)
      setEditEquipmentTab(tab)
      setEditEquipmentModalOpen(true)
      return
    }

    // 3) Se o equipamento não está cadastrado/vinculado como registro próprio
    // abre o modal de criação/vincular equipamento
    setEquipmentModalOpen(true)
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
      setActiveEquipmentDetail(created)
      loadAll()
    } catch {
      toast({
        title: 'Erro ao vincular equipamento à O.S.',
        variant: 'destructive',
      })
    }
  }

  const handleEquipmentSaved = (updated?: Equipment) => {
    if (!updated || !order) return
    setActiveEquipmentDetail(updated)
    const equipmentLabel = `${updated.name || 'Equipamento'}${
      updated.brand ? ' - ' + updated.brand : ''
    }${updated.model ? ' ' + updated.model : ''}`

    setOrder((prev) =>
      prev
        ? {
            ...prev,
            equipment_ref: updated.id,
            equipment: equipmentLabel,
            expand: {
              ...prev.expand,
              equipment_ref: updated,
            },
          }
        : prev,
    )
    loadAll()
  }

  return (
    <div className="space-y-6">
      <CompanyHeader />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/ordens')}
              className="h-9 gap-1.5 shrink-0 text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100 shadow-xs"
              title="Voltar para a listagem de Ordens de Serviço"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar</span>
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

          {canDeleteOs && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeleteOsOpen(true)}
              className="h-9 text-xs font-semibold border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 gap-1.5 shadow-xs"
              title="Excluir Ordem de Serviço (Ação administrativa / com permissão)"
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
              <span>Excluir O.S.</span>
            </Button>
          )}
        </div>

        {canStartService && (
          <Button
            onClick={handleStartService}
            disabled={starting}
            className="w-full sm:w-auto sm:self-start h-11 text-sm font-bold gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20"
          >
            <Play className="h-5 w-5" />
            <span>{starting ? 'Iniciando...' : 'Iniciar Atendimento'}</span>
          </Button>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Ação Principal 1: Orçamento Integrado à OS */}
          {activeOrcamento ? (
            <Button
              size="sm"
              onClick={() => navigate(`/orcamentos/${activeOrcamento.id}`)}
              className="text-xs gap-1.5 h-9 justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
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
                } catch (err) {
                  const errDetail = getErrorMessage(err)
                  toast({
                    title: 'Erro ao gerar orçamento',
                    description: errDetail || 'Verifique se já existe um orçamento ativo.',
                    variant: 'destructive',
                  })
                } finally {
                  setCreatingOrcamento(false)
                }
              }}
              className="text-xs gap-1.5 h-9 justify-center border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-bold"
            >
              {creatingOrcamento ? (
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              <span>{creatingOrcamento ? 'Salvando...' : 'Gerar Orçamento'}</span>
            </Button>
          )}

          {/* Ação Principal 2 (se aberta e liberada): Finalizar Ordem de Serviço */}
          {!isFinalizada && canEdit && !fieldsLocked && (
            <Button
              size="sm"
              onClick={() => setConfirmFinalizarOpen(true)}
              disabled={finalizingOrder}
              className="text-xs gap-1.5 h-9 justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
              title="Finalizar esta Ordem de Serviço"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Finalizar O.S.</span>
            </Button>
          )}

          {/* Menu em cascata com todas as demais ações */}
          <RecordActionsMenu
            label={`O.S. #${order.number}`}
            title="Mais ações desta O.S."
            triggerClassName="h-9 w-9 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs rounded-md"
            items={[
              {
                key: 'print',
                label: 'Imprimir PDF (A4)',
                icon: Printer,
                onClick: handlePrintOrder,
              },
              {
                key: 'share',
                label: 'Enviar ao Cliente (Seletor)',
                icon: Share2,
                variant: 'success',
                onClick: handleEnviarDocumentoOs,
              },
              {
                key: 'chat',
                label: 'Chat Técnico (WhatsApp)',
                icon: MessageCircle,
                onClick: handleWhatsApp,
              },
              {
                key: 'public_link',
                label: 'Abrir link público (/share)',
                icon: ExternalLink,
                onClick: () => window.open(`/share/${order.id}`, '_blank'),
              },
              {
                key: 'equipment_record',
                label: order.equipment_ref
                  ? 'Cadastro do Equipamento (Editar/Fotos)'
                  : 'Vincular/Cadastrar Equipamento',
                icon: Monitor,
                separatorBefore: true,
                onClick: () => handleOpenEquipmentModal('edit'),
              },
              {
                key: 'equipment_photos',
                label: 'Abrir Imagens do Equipamento',
                icon: ImageIcon,
                hidden: !order.equipment_ref && !order.equipment,
                onClick: () => handleOpenEquipmentModal('photos'),
              },
              {
                key: 'reschedule',
                label: 'Reagendar Atendimento',
                icon: CalendarClock,
                hidden: !canEdit || isFinalizada,
                separatorBefore: true,
                onClick: () => setRescheduleModalOpen(true),
              },
              {
                key: 'transfer',
                label: 'Transferir Técnico',
                icon: ArrowRightLeft,
                hidden: !canEdit,
                onClick: () => setTransferModalOpen(true),
              },
              {
                key: 'edit_info',
                label: isEditingOs ? 'Fechar edição de O.S.' : 'Editar título/descrição',
                icon: Edit2,
                hidden: !canEdit || fieldsLocked,
                onClick: () => setIsEditingOs(!isEditingOs),
              },
              {
                key: 'delete',
                label: 'Excluir O.S.',
                icon: Trash2,
                variant: 'destructive',
                hidden: !canDeleteOs,
                separatorBefore: true,
                onClick: () => setConfirmDeleteOsOpen(true),
              },
            ]}
          />
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
                  <span>{isEditingOs ? 'Cancelar Edição' : 'Editar O.S.'}</span>
                </Button>
              )}{' '}
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
                      <span>{savingOs ? 'Salvando...' : 'Salvar Alterações'}</span>
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
                        <span>{order.expand.customer.endereco}</span>
                      ) : order.expand?.customer?.street ? (
                        <span>
                          {[
                            order.expand.customer.street,
                            order.expand.customer.number
                              ? `nº ${order.expand.customer.number}`
                              : '',
                            order.expand.customer.bairro
                              ? `Bairro ${order.expand.customer.bairro}`
                              : '',
                            order.expand.customer.city
                              ? `${order.expand.customer.city}${order.expand.customer.state ? `/${order.expand.customer.state}` : ''}`
                              : '',
                            order.expand.customer.zip ? `(CEP: ${order.expand.customer.zip})` : '',
                          ]
                            .filter(Boolean)
                            .join(' - ')}
                        </span>
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
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">Técnico Responsável:</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setTransferModalOpen(true)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                        title="Transferir para outro técnico"
                      >
                        <ArrowRightLeft className="h-3 w-3" />
                        Transferir
                      </button>
                    )}
                  </div>
                  <p className="font-medium text-slate-900 mt-0.5">
                    {order.expand?.technician?.name || 'Não atribuído'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">Agendamento:</span>
                    {canEdit && !isFinalizada && (
                      <button
                        type="button"
                        onClick={() => setRescheduleModalOpen(true)}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                        title="Reagendar data e horário do atendimento"
                      >
                        <CalendarClock className="h-3 w-3" />
                        Reagendar
                      </button>
                    )}
                  </div>
                  <p className="font-medium text-slate-900 mt-0.5 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span>
                      {order.attendance_date
                        ? `${order.attendance_date.split('-').reverse().join('/')}${order.attendance_time ? ` às ${order.attendance_time}` : ''}`
                        : 'Não agendado'}
                    </span>
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
                      <div className="flex flex-wrap items-center gap-2">
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
                            <span>Vincular / Cadastrar</span>
                          </Button>
                        )}
                      </div>
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
                      <span>{`Cliente: ${activeOrcamento.assinatura_cliente ? '✓ Assinado' : 'Pendente'}`}</span>
                    </Badge>
                    <Badge
                      className={
                        activeOrcamento.assinatura_tecnico
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }
                    >
                      <span>{`Técnico: ${activeOrcamento.assinatura_tecnico ? '✓ Assinado' : 'Pendente'}`}</span>
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
                        <span>{savingOrcConditions ? 'Salvando...' : 'Salvar Condições'}</span>
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
                      {`${orcamentoItens.length} ${orcamentoItens.length === 1 ? 'item' : 'itens'}`}
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
                          className="h-7 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Adicionar Primeiro Item</span>
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
                                <span>
                                  {`R$ ${(it.valor_unitario || 0).toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                <span>
                                  {`R$ ${(it.valor_total_item || 0).toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`}
                                </span>
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
                      {`R$ ${(activeOrcamento.subtotal || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </span>
                  </div>
                  {(activeOrcamento.desconto_total_valor || 0) > 0 && (
                    <div className="flex justify-between items-center text-rose-600">
                      <span>Desconto Total:</span>
                      <span className="font-mono font-semibold">
                        {`-R$ ${(activeOrcamento.desconto_total_valor || 0).toLocaleString(
                          'pt-BR',
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 text-sm font-bold">
                    <span className="text-slate-900">Total do Orçamento:</span>
                    <span className="font-mono text-indigo-700 text-base font-black">
                      {`R$ ${(activeOrcamento.total_geral || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
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
                  } catch (err) {
                    const errDetail = getErrorMessage(err)
                    toast({
                      title: 'Erro ao gerar orçamento',
                      description: errDetail || 'Verifique se já existe um orçamento ativo.',
                      variant: 'destructive',
                    })
                  } finally {
                    setCreatingOrcamento(false)
                  }
                }}
                className="h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm"
              >
                {creatingOrcamento ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>{creatingOrcamento ? 'Salvando...' : 'Gerar Orçamento'}</span>
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
                  className="w-full justify-start text-xs h-9 bg-purple-600 hover:bg-purple-700 gap-1.5"
                >
                  <Play className="h-4 w-4" />
                  <span>Iniciar Atendimento</span>
                </Button>
              )}
              {canEdit && (
                <Button
                  onClick={() => setTransferModalOpen(true)}
                  variant="outline"
                  className="w-full justify-start text-xs h-9 border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1.5"
                >
                  <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
                  <span>Transferir Técnico</span>
                </Button>
              )}
              {order.status === 'in_progress' && (
                <Button
                  onClick={handleFinishService}
                  disabled={!serviceReport.trim()}
                  className="w-full justify-start text-xs h-9 bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Concluir Serviço</span>
                </Button>
              )}
              {order.status === 'in_progress' && (
                <Button
                  onClick={() => handleStatusChange('paused')}
                  variant="outline"
                  className="w-full justify-start text-xs h-9 border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <span>Pausar Atendimento</span>
                </Button>
              )}
              {order.status === 'paused' && (
                <Button
                  onClick={() => handleStatusChange('in_progress')}
                  className="w-full justify-start text-xs h-9 bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
                >
                  <Play className="h-4 w-4" />
                  <span>Retomar Atendimento</span>
                </Button>
              )}
              <Button
                onClick={() => handleStatusChange('waiting_parts')}
                variant="outline"
                className="w-full justify-start text-xs h-9"
              >
                <span>Aguardando Peças</span>
              </Button>
              {!isFinalizada && canEdit && !fieldsLocked && (
                <Button
                  onClick={() => setConfirmFinalizarOpen(true)}
                  disabled={finalizingOrder}
                  className="w-full justify-start text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Finalizar Ordem de Serviço</span>
                </Button>
              )}
              {canDeleteOs && (
                <Button
                  onClick={() => setConfirmDeleteOsOpen(true)}
                  variant="outline"
                  className="w-full justify-start text-xs h-9 border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 font-semibold gap-1.5"
                >
                  <Trash2 className="h-4 w-4 text-rose-600" />
                  <span>Excluir Ordem de Serviço</span>
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
              <span className="block">
                {`Tem certeza de que deseja finalizar a Ordem de Serviço `}
                <strong className="font-mono text-slate-800">{order.number}</strong>
                {`?`}
              </span>
              <span className="block text-xs text-slate-500">
                {`O status será alterado para `}
                <strong>Concluída</strong>
                {` e as baixas de estoque e notificações cabíveis serão disparadas.`}
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
              <span>{finalizingOrder ? 'Finalizando...' : 'Confirmar e Finalizar'}</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de Exclusão da Ordem de Serviço com exclusão em cascata */}
      <AlertDialog open={confirmDeleteOsOpen} onOpenChange={setConfirmDeleteOsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Excluir Ordem de Serviço?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-slate-600">
              <span className="block">
                {`Tem certeza de que deseja excluir permanentemente a Ordem de Serviço `}
                <strong className="font-mono text-slate-900">{order.number}</strong>
                {`?`}
              </span>
              <span className="block text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded border border-rose-200">
                Atenção: Esta ação é irreversível. Todos os itens lançados, histórico de alterações,
                fotos e registros vinculados serão excluídos em cascata.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingOs}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOs}
              disabled={deletingOs}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              <span>{deletingOs ? 'Excluindo...' : 'Sim, Excluir O.S.'}</span>
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

      <EditEquipmentModal
        equipment={activeEquipmentDetail || order.expand?.equipment_ref || null}
        open={editEquipmentModalOpen}
        onOpenChange={setEditEquipmentModalOpen}
        defaultTab={editEquipmentTab}
        canEdit={canEdit && !fieldsLocked}
        onSaved={handleEquipmentSaved}
      />

      <TransferTechnicianModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        order={order}
        onTransferred={loadAll}
      />

      <RescheduleOrderModal
        open={rescheduleModalOpen}
        onOpenChange={setRescheduleModalOpen}
        order={order}
        onRescheduled={loadAll}
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

      {/* Modal Seletor de Compartilhamento do Link do Documento (/share/:id) */}
      <Dialog
        open={shareChooserOpen}
        onOpenChange={(open) => {
          setShareChooserOpen(open)
          if (!open && pendingAfterShareAction) {
            const action = pendingAfterShareAction
            setPendingAfterShareAction(null)
            action()
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-bold">
              <Share2 className="h-5 w-5 text-indigo-600" />
              {shareChooserTitle}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {shareChooserDescription ||
                'Escolha por onde deseja compartilhar o link do documento público da O.S.:'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* WhatsApp */}
            <Button
              type="button"
              variant="outline"
              onClick={handleShareToWhatsApp}
              className="w-full justify-between h-auto py-3 px-4 border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-900 font-semibold"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Send className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold">WhatsApp</div>
                  <div className="text-[11px] font-normal text-emerald-700">
                    {pendingSharePhone
                      ? `Enviar direto para ${pendingSharePhone}`
                      : 'Abrir no WhatsApp e escolher contato'}
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-emerald-700 shrink-0" />
            </Button>

            {/* Copiar Link para a Área de Transferência */}
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyShareLink}
              className="w-full justify-between h-auto py-3 px-4 border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="h-9 w-9 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Copy className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold">Copiar Link</div>
                  <div className="text-[11px] font-normal text-slate-500">
                    Copiar URL pública ({pendingShareUrl || `/share/${order.id}`})
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
            </Button>

            {/* Compartilhamento nativo do aparelho (quando suportado) */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <Button
                type="button"
                variant="outline"
                onClick={handleNativeShare}
                className="w-full justify-between h-auto py-3 px-4 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/50 text-indigo-900 font-semibold"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="h-9 w-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Share2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Compartilhar no Aparelho</div>
                    <div className="text-[11px] font-normal text-indigo-700">
                      Menu nativo (outros apps, e-mail, Telegram, Bluetooth)
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-indigo-600 shrink-0" />
              </Button>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShareChooserOpen(false)
                if (pendingAfterShareAction) {
                  const act = pendingAfterShareAction
                  setPendingAfterShareAction(null)
                  act()
                }
              }}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
