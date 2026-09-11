import { useState, useEffect, useMemo } from 'react'
import {
  Sparkles,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  RefreshCw,
  Search,
  Check,
  User,
  Wrench,
  Plus,
  MessageCircle,
  Star,
  Globe,
  HelpCircle,
  Calendar,
  Gift,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getPosVendaMessages,
  markPosVendaMessageSent,
  dismissPosVendaMessage,
  markPosVendaMessageResponded,
  getGoogleReviewUrl,
  updateGoogleReviewUrl,
  releaseJuquinhaEvaluations,
  createPosVendaMessage,
  buildJuquinhaMessageText,
  buildJuquinhaWaLink,
} from '@/services/pos_venda'
import { PosVendaMessage, PosVendaTipo, Customer, ServiceOrder } from '@/types'
import { getCustomerDisplayName, getCustomerPhone, getCustomers } from '@/services/customers'
import { getServiceOrders } from '@/services/service_orders'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'

// Caixas reorganizadas da v0.0.183
export type PosVendaBoxId =
  | 'ready_7d' // Prontas para Disparo (7 dias)
  | 'ofertas_30d' // Ofertas (30 dias)
  | 'agendadas' // Agendadas (data futura)
  | 'checkin' // Check-in Atendimento (respondidas vs pendentes)
  | 'avaliacoes' // Avaliações (Técnico + Google)
  | 'todas' // Visão geral de todas

export default function PosVendaJuquinha() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [messages, setMessages] = useState<PosVendaMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [activeBox, setActiveBox] = useState<PosVendaBoxId>('ready_7d')
  const [filterText, setFilterText] = useState('')

  // Sub-filtro para a caixa de Check-in Atendimento
  const [checkinSubFilter, setCheckinSubFilter] = useState<
    'all' | 'responded' | 'pending_response'
  >('all')

  // Sub-filtro de status para a caixa 'todas'
  const [statusSubFilter, setStatusSubFilter] = useState<'all' | 'ready' | 'pending' | 'sent'>(
    'all',
  )

  // Modal de configurações do Juquinha (Google Review URL, etc.)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [googleUrl, setGoogleUrl] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  // Modal para personalização com IA (Skip Cloud Agent Juquinha)
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [selectedMsg, setSelectedMsg] = useState<PosVendaMessage | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [generatingAi, setGeneratingAi] = useState(false)
  const [aiGeneratedText, setAiGeneratedText] = useState('')

  // Estado para ações de resposta e liberação
  const [markingRespondedId, setMarkingRespondedId] = useState<string | null>(null)
  const [releasingEvaluationsId, setReleasingEvaluationsId] = useState<string | null>(null)

  // Modal Nova Mensagem Manual
  const [newMsgModalOpen, setNewMsgModalOpen] = useState(false)
  const [customersList, setCustomersList] = useState<Customer[]>([])
  const [ordersList, setOrdersList] = useState<ServiceOrder[]>([])
  const [manualCustomerId, setManualCustomerId] = useState('')
  const [manualOrderId, setManualOrderId] = useState<string>('none')
  const [manualTipo, setManualTipo] = useState<PosVendaTipo>('checkin_pos_venda')
  const [manualText, setManualText] = useState('')
  const [creatingManualMsg, setCreatingManualMsg] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const list = await getPosVendaMessages('', '-created')
      setMessages(list)
    } catch {
      toast({ title: 'Erro ao carregar mensagens de pós-venda', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    getGoogleReviewUrl()
      .then(setGoogleUrl)
      .catch(() => {})
  }, [])

  useRealtime('pos_venda_messages', loadData)

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      await updateGoogleReviewUrl(googleUrl)
      toast({ title: 'Configurações do Juquinha salvas com sucesso!' })
      setSettingsOpen(false)
    } catch {
      toast({ title: 'Erro ao salvar configurações', variant: 'destructive' })
    } finally {
      setSavingSettings(false)
    }
  }

  // 1-Toque WhatsApp com cadeia automática
  const handleSendOneTouch = async (msg: PosVendaMessage) => {
    const link = msg.wa_me_link
    if (link) {
      window.open(link, '_blank')
    }
    try {
      await markPosVendaMessageSent(msg.id, msg)
      toast({
        title: 'WhatsApp aberto!',
        description:
          msg.tipo === 'pos_venda_7d'
            ? 'Mensagem marcada como enviada e avaliações geradas automaticamente!'
            : 'Mensagem marcada como enviada no histórico.',
      })
      loadData()
    } catch {
      /* ignore */
    }
  }

  const handleDismiss = async (id: string) => {
    try {
      await dismissPosVendaMessage(id)
      toast({ title: 'Mensagem descartada' })
      loadData()
    } catch {
      toast({ title: 'Erro ao descartar mensagem', variant: 'destructive' })
    }
  }

  // Marcar como respondido pelo cliente + Cadeia automática de liberação e notificação
  const handleMarkAsResponded = async (msg: PosVendaMessage) => {
    setMarkingRespondedId(msg.id)
    try {
      await markPosVendaMessageResponded(msg.id, true, msg)

      toast({
        title: 'Cliente marcado como respondido!',
        description:
          'Avaliações (Técnico e Google) liberadas como prontas e notificação enviada para a equipe!',
      })

      await loadData()
    } catch (err) {
      toast({
        title: 'Erro ao marcar como respondido',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setMarkingRespondedId(null)
    }
  }

  // Ação explícita de liberação de avaliações
  const handleReleaseEvaluations = async (msg: PosVendaMessage) => {
    setReleasingEvaluationsId(msg.id)
    try {
      await releaseJuquinhaEvaluations(msg)
      toast({
        title: 'Avaliações liberadas com sucesso!',
        description:
          '2 mensagens: Avaliação do Técnico (⭐) e Avaliação no Google (🌐) prontas para disparo.',
      })
      setActiveBox('avaliacoes')
      await loadData()
    } catch (err) {
      toast({
        title: 'Erro ao liberar mensagens de avaliação',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setReleasingEvaluationsId(null)
    }
  }

  const handleOpenAiModal = (msg: PosVendaMessage) => {
    setSelectedMsg(msg)
    setAiGeneratedText(msg.texto_gerado || '')
    setCustomPrompt('')
    setCustomModalOpen(true)
  }

  const handleGenerateWithAi = async () => {
    if (!selectedMsg) return
    setGeneratingAi(true)
    try {
      const custName = getCustomerDisplayName(selectedMsg.expand?.customer)
      const res = await fetch(
        `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/juquinha/generate-custom`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: pb.authStore.token,
          },
          body: JSON.stringify({
            customer_name: custName,
            tipo: selectedMsg.tipo,
            prompt: customPrompt,
          }),
        },
      )

      if (!res.ok) throw new Error('Falha na resposta do Juquinha')
      const data = await res.json()
      setAiGeneratedText(data.content || '')
      toast({ title: 'Texto refinado pelo Juquinha!' })
    } catch {
      toast({ title: 'Não foi possível gerar variação com IA no momento', variant: 'destructive' })
    } finally {
      setGeneratingAi(false)
    }
  }

  const handleApplyAiText = async () => {
    if (!selectedMsg) return
    const cust = selectedMsg.expand?.customer
    const phone = getCustomerPhone(cust)
    const newWaLink = buildJuquinhaWaLink(phone, aiGeneratedText)

    try {
      await pb.collection('pos_venda_messages').update(selectedMsg.id, {
        texto_gerado: aiGeneratedText,
        wa_me_link: newWaLink,
      })
      toast({ title: 'Mensagem atualizada com sucesso!' })
      setCustomModalOpen(false)
      loadData()
    } catch {
      toast({ title: 'Erro ao salvar alteração', variant: 'destructive' })
    }
  }

  // Abertura do Modal de Nova Mensagem Manual
  const handleOpenNewMessageModal = async () => {
    try {
      const [custs, ords] = await Promise.all([getCustomers(''), getServiceOrders('', '-created')])
      setCustomersList(custs)
      setOrdersList(ords)
      setManualCustomerId(custs[0]?.id || '')
      setManualOrderId('none')
      setManualTipo('checkin_pos_venda')
      setNewMsgModalOpen(true)
    } catch {
      toast({ title: 'Erro ao carregar clientes/ordens', variant: 'destructive' })
    }
  }

  // Atualiza texto manual quando seletores mudam
  useEffect(() => {
    if (!newMsgModalOpen || !manualCustomerId) return
    const selectedCustomer = customersList.find((c) => c.id === manualCustomerId)
    const selectedOrder =
      manualOrderId && manualOrderId !== 'none'
        ? ordersList.find((o) => o.id === manualOrderId)
        : undefined

    const custName = getCustomerDisplayName(selectedCustomer)
    const equip = selectedOrder?.equipment || ''
    const osNumber = selectedOrder?.number || ''
    const techName = selectedOrder?.expand?.technician?.name || ''
    const serviceReport = selectedOrder?.service_report || selectedOrder?.description || ''

    const generated = buildJuquinhaMessageText({
      tipo: manualTipo,
      customerName: custName,
      equipment: equip,
      orderNumber: osNumber,
      technicianName: techName,
      googleReviewUrl: googleUrl,
      serviceReport,
    })
    setManualText(generated)
  }, [
    manualCustomerId,
    manualOrderId,
    manualTipo,
    newMsgModalOpen,
    customersList,
    ordersList,
    googleUrl,
  ])

  const handleCreateAndSendManualMsg = async (openDirectly: boolean) => {
    if (!manualCustomerId) {
      toast({ title: 'Selecione um cliente', variant: 'destructive' })
      return
    }
    const customer = customersList.find((c) => c.id === manualCustomerId)
    const phone = getCustomerPhone(customer)
    if (!phone && openDirectly) {
      toast({ title: 'Cliente não possui telefone cadastrado', variant: 'destructive' })
      return
    }

    setCreatingManualMsg(true)
    try {
      const waLink = buildJuquinhaWaLink(phone, manualText)
      const nowIso = new Date().toISOString()
      const newRec = await createPosVendaMessage({
        customer: manualCustomerId,
        service_order: manualOrderId && manualOrderId !== 'none' ? manualOrderId : undefined,
        tipo: manualTipo,
        status: openDirectly ? 'sent' : 'ready',
        scheduled_at: nowIso,
        sent_at: openDirectly ? nowIso : undefined,
        texto_gerado: manualText,
        wa_me_link: waLink,
        channel: 'whatsapp',
      })

      if (openDirectly && waLink) {
        window.open(waLink, '_blank')
      }

      toast({
        title: openDirectly ? 'WhatsApp aberto com sucesso!' : 'Mensagem salva como pronta!',
        description: `Mensagem criada para ${getCustomerDisplayName(customer)}.`,
      })

      setNewMsgModalOpen(false)
      loadData()
    } catch {
      toast({ title: 'Erro ao criar mensagem manual', variant: 'destructive' })
    } finally {
      setCreatingManualMsg(false)
    }
  }

  // =========================================================================
  // HELPER DE DATAS E CÁLCULO DE DIAS RESTANTES / DECORRIDOS
  // =========================================================================
  // Data de conclusão da O.S. (service_order.updated quando completed/closed, ou scheduled_at/created)
  const getOrderCompletionDate = (msg: PosVendaMessage): Date => {
    const so = msg.expand?.service_order
    if (so && (so.status === 'completed' || so.status === 'closed') && so.updated) {
      return new Date(so.updated)
    }
    if (msg.scheduled_at) {
      // Se a mensagem foi agendada para +7d ou +30d, a conclusão foi 7d ou 30d antes
      const sched = new Date(msg.scheduled_at).getTime()
      if (msg.tipo === 'pos_venda_7d') {
        return new Date(sched - 7 * 86400000)
      }
      if (msg.tipo === 'oferta_30d') {
        return new Date(sched - 30 * 86400000)
      }
    }
    return new Date(msg.created)
  }

  // Dias decorridos desde a conclusão
  const getDaysSinceCompletion = (msg: PosVendaMessage): number => {
    const compDate = getOrderCompletionDate(msg)
    const diffMs = Date.now() - compDate.getTime()
    return Math.floor(diffMs / 86400000)
  }

  // Dias que faltam para o agendamento
  const getDaysRemainingUntilScheduled = (msg: PosVendaMessage): number => {
    if (!msg.scheduled_at) return 0
    const schedMs = new Date(msg.scheduled_at).getTime()
    const diffMs = schedMs - Date.now()
    return Math.ceil(diffMs / 86400000)
  }

  // Verifica se os N dias da conclusão já passaram
  const hasDaysPassedSinceCompletion = (msg: PosVendaMessage, targetDays: number): boolean => {
    const days = getDaysSinceCompletion(msg)
    return days >= targetDays
  }

  // Mapa de mensagens por O.S. para calcular a Timeline e verificar etapas
  const orderMessageMap = useMemo(() => {
    const map = new Map<string, PosVendaMessage[]>()
    messages.forEach((m) => {
      const soId = m.service_order || 'no_os'
      const arr = map.get(soId) || []
      arr.push(m)
      map.set(soId, arr)
    })
    return map
  }, [messages])

  // =========================================================================
  // SEPARAÇÃO DAS 5 CAIXAS REORGANIZADAS DA v0.0.183
  // =========================================================================

  // a) 'Prontas para Disparo (7 dias)':
  // Mensagens tipo pos_venda_7d cujos 7 dias da conclusão JÁ PASSARAM (status ready,
  // ou pending com scheduled_at <= agora), ordenadas da mais antiga para a mais recente.
  const ready7dMessages = useMemo(() => {
    const now = Date.now()
    return messages
      .filter((m) => {
        if (m.tipo !== 'pos_venda_7d') return false
        if (m.status === 'dismissed' || m.status === 'sent') return false
        const schedMs = m.scheduled_at ? new Date(m.scheduled_at).getTime() : 0
        const isReadyByStatus = m.status === 'ready'
        const isReadyByTime = schedMs > 0 && schedMs <= now
        const is7dPassed = hasDaysPassedSinceCompletion(m, 7)
        return isReadyByStatus || isReadyByTime || is7dPassed
      })
      .sort((a, b) => getOrderCompletionDate(a).getTime() - getOrderCompletionDate(b).getTime())
  }, [messages])

  // b) NOVA CAIXA 'Ofertas (30 dias)':
  // Mensagens tipo oferta_30d cujos 30 dias JÁ PASSARAM, prontas para envio,
  // ordenadas da mais antiga para a mais recente (mais urgente primeiro).
  const ofertas30dMessages = useMemo(() => {
    const now = Date.now()
    return messages
      .filter((m) => {
        if (m.tipo !== 'oferta_30d') return false
        if (m.status === 'dismissed' || m.status === 'sent') return false
        const schedMs = m.scheduled_at ? new Date(m.scheduled_at).getTime() : 0
        const isReadyByStatus = m.status === 'ready'
        const isReadyByTime = schedMs > 0 && schedMs <= now
        const is30dPassed = hasDaysPassedSinceCompletion(m, 30)
        return isReadyByStatus || isReadyByTime || is30dPassed
      })
      .sort((a, b) => getOrderCompletionDate(a).getTime() - getOrderCompletionDate(b).getTime())
  }, [messages])

  // c) 'Agendadas':
  // TODAS as mensagens de O.S. concluídas/fechadas ainda com data futura (7d/30d agendados),
  // com status 'pending' e scheduled_at no futuro (ou que ainda não atingiram o prazo).
  // Ordenadas pela próxima a vencer primeiro.
  const agendadasMessages = useMemo(() => {
    const now = Date.now()
    return messages
      .filter((m) => {
        if (m.status !== 'pending') return false
        if (m.tipo === 'avaliacao_tecnico' || m.tipo === 'avaliacao_google') return false // avaliações pendentes aguardam resposta
        const schedMs = m.scheduled_at ? new Date(m.scheduled_at).getTime() : 0
        // Deve ser data futura
        return schedMs > now
      })
      .sort((a, b) => {
        const schedA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
        const schedB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
        return schedA - schedB
      })
  }, [messages])

  // d) 'Check-in Atendimento':
  // Mensagens de check-in (tipo checkin_pos_venda), com distinção entre RESPONDIDAS pelo cliente
  // (cliente_respondeu=true) e pendentes de resposta, ordenadas por data de conclusão da OS.
  const checkinMessages = useMemo(() => {
    return messages
      .filter((m) => m.tipo === 'checkin_pos_venda' || m.tipo === 'avaliacao_30min')
      .sort((a, b) => getOrderCompletionDate(a).getTime() - getOrderCompletionDate(b).getTime())
  }, [messages])

  // e) 'Avaliações (Técnico + Google)':
  // Todas as mensagens das O.S. que já tiveram QUALQUER mensagem enviada (histórico de contato),
  // com as avaliações prontas em destaque no topo, e avaliações pendentes ou enviadas em seguida.
  const avaliacoesMessages = useMemo(() => {
    return messages
      .filter((m) => m.tipo === 'avaliacao_tecnico' || m.tipo === 'avaliacao_google')
      .sort((a, b) => {
        // Prontas (ready) vêm primeiro no topo
        if (a.status === 'ready' && b.status !== 'ready') return -1
        if (b.status === 'ready' && a.status !== 'ready') return 1
        // Entre prontas ou mesmo status: mais antiga da conclusão primeiro
        return getOrderCompletionDate(a).getTime() - getOrderCompletionDate(b).getTime()
      })
  }, [messages])

  // Mensagens filtradas conforme a caixa ativa
  const currentBoxMessages = useMemo(() => {
    let list: PosVendaMessage[] = []

    switch (activeBox) {
      case 'ready_7d':
        list = ready7dMessages
        break
      case 'ofertas_30d':
        list = ofertas30dMessages
        break
      case 'agendadas':
        list = agendadasMessages
        break
      case 'checkin':
        if (checkinSubFilter === 'responded') {
          list = checkinMessages.filter((m) => m.cliente_respondeu)
        } else if (checkinSubFilter === 'pending_response') {
          list = checkinMessages.filter((m) => !m.cliente_respondeu && m.status !== 'dismissed')
        } else {
          list = checkinMessages
        }
        break
      case 'avaliacoes':
        list = avaliacoesMessages
        break
      case 'todas':
      default:
        list = messages
          .slice()
          .filter((m) => {
            if (statusSubFilter === 'all') return true
            return m.status === statusSubFilter
          })
          .sort((a, b) => getOrderCompletionDate(a).getTime() - getOrderCompletionDate(b).getTime())
        break
    }

    if (!filterText.trim()) return list
    const q = filterText.toLowerCase()
    return list.filter((m) => {
      const cust = m.expand?.customer
      const name = (cust?.razao_social || cust?.nome_fantasia || cust?.name || '').toLowerCase()
      const soNumber = (m.expand?.service_order?.number || '').toLowerCase()
      const equip = (m.expand?.service_order?.equipment || '').toLowerCase()
      const body = (m.texto_gerado || '').toLowerCase()
      return name.includes(q) || soNumber.includes(q) || equip.includes(q) || body.includes(q)
    })
  }, [
    activeBox,
    ready7dMessages,
    ofertas30dMessages,
    agendadasMessages,
    checkinMessages,
    avaliacoesMessages,
    messages,
    checkinSubFilter,
    statusSubFilter,
    filterText,
  ])

  // Badges visuais por tipo
  const getTipoBadge = (tipo: PosVendaTipo) => {
    switch (tipo) {
      case 'checkin_pos_venda':
        return (
          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[11px] font-bold gap-1">
            💬 Check-in Atendimento
          </Badge>
        )
      case 'pos_venda_7d':
        return (
          <Badge className="bg-blue-100 text-blue-900 border-blue-300 text-[11px] font-bold gap-1">
            🛠️ Pós-venda (7 dias)
          </Badge>
        )
      case 'oferta_30d':
        return (
          <Badge className="bg-purple-100 text-purple-900 border-purple-300 text-[11px] font-bold gap-1">
            🎁 Oferta (30 dias)
          </Badge>
        )
      case 'avaliacao_tecnico':
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[11px] font-bold gap-1">
            <Star className="h-3 w-3 text-amber-600 fill-amber-500" /> Avaliação do Técnico
          </Badge>
        )
      case 'avaliacao_google':
        return (
          <Badge className="bg-sky-100 text-sky-900 border-sky-300 text-[11px] font-bold gap-1">
            <Globe className="h-3 w-3 text-sky-600" /> Avaliação no Google
          </Badge>
        )
      case 'avaliacao_30min':
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[11px] font-bold">
            ⭐ Avaliação (30 min)
          </Badge>
        )
      case 'resumo_finalizacao':
        return (
          <Badge className="bg-slate-100 text-slate-800 border-slate-200 text-[11px] font-bold">
            📄 Resumo de Conclusão
          </Badge>
        )
      default:
        return <Badge variant="outline">{tipo}</Badge>
    }
  }

  // Badges visuais por status
  const getStatusBadge = (msg: PosVendaMessage) => {
    const { status, tipo, cliente_respondeu, avaliacoes_liberadas } = msg

    // Caso específico de checkin
    if (tipo === 'checkin_pos_venda') {
      if (avaliacoes_liberadas) {
        return (
          <Badge className="bg-slate-200 text-slate-700 border border-slate-300 font-bold gap-1 text-[11px]">
            <CheckCircle2 className="h-3 w-3 text-slate-500" /> Avaliações Liberadas
          </Badge>
        )
      }
      if (cliente_respondeu) {
        return (
          <Badge className="bg-purple-600 text-white font-black gap-1 text-[11px] shadow-sm animate-pulse">
            💬 Respondeu — Ação Pendente
          </Badge>
        )
      }
      if (status === 'sent') {
        return (
          <Badge className="bg-amber-100 text-amber-900 border border-amber-300 font-bold gap-1 text-[11px]">
            <Clock className="h-3 w-3 text-amber-600" /> Enviado • Aguardando resposta
          </Badge>
        )
      }
      if (status === 'ready') {
        return (
          <Badge className="bg-blue-600 text-white font-bold gap-1 text-[11px]">
            <Send className="h-3 w-3" /> Aguardando envio
          </Badge>
        )
      }
    }

    // Avaliações pendentes aguardando resposta do cliente
    if ((tipo === 'avaliacao_tecnico' || tipo === 'avaliacao_google') && status === 'pending') {
      return (
        <Badge className="bg-slate-200 text-slate-700 border border-slate-300 font-semibold gap-1 text-[11px]">
          <Clock className="h-3 w-3 text-slate-500" /> Aguardando resposta do cliente
        </Badge>
      )
    }

    switch (status) {
      case 'ready':
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-1 text-[11px]">
            <CheckCircle2 className="h-3 w-3" /> Pronta p/ Disparo
          </Badge>
        )
      case 'pending':
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold gap-1 text-[11px]">
            <Clock className="h-3 w-3" /> Agendada
          </Badge>
        )
      case 'sent':
        return (
          <Badge className="bg-slate-700 text-white font-bold gap-1 text-[11px]">
            <Check className="h-3 w-3" /> Disparada
          </Badge>
        )
      case 'dismissed':
        return (
          <Badge variant="outline" className="text-slate-400 border-slate-300 text-[11px]">
            <XCircle className="h-3 w-3 mr-1" /> Descartada
          </Badge>
        )
    }
  }

  // Estilização do card conforme situação
  const getCardVisualClasses = (msg: PosVendaMessage) => {
    // Avaliações prontas: destaque dourado/âmbar
    if (
      (msg.tipo === 'avaliacao_tecnico' || msg.tipo === 'avaliacao_google') &&
      msg.status === 'ready'
    ) {
      return 'border-2 border-amber-400 bg-gradient-to-br from-amber-50/90 via-yellow-50/40 to-white shadow-md ring-2 ring-amber-300/40'
    }

    // Check-in com resposta do cliente pendente de ação
    if (msg.tipo === 'checkin_pos_venda' && msg.cliente_respondeu && !msg.avaliacoes_liberadas) {
      return 'border-2 border-purple-500 bg-gradient-to-br from-purple-50/90 via-fuchsia-50/40 to-white shadow-md ring-2 ring-purple-400/40'
    }

    // 7 dias pronta para disparo
    if (msg.tipo === 'pos_venda_7d' && msg.status === 'ready') {
      return 'border-2 border-emerald-400 bg-gradient-to-br from-emerald-50/60 to-white shadow-sm'
    }

    // Oferta 30 dias pronta
    if (msg.tipo === 'oferta_30d' && msg.status === 'ready') {
      return 'border-2 border-purple-400 bg-gradient-to-br from-purple-50/60 to-white shadow-sm'
    }

    if (msg.status === 'sent') {
      return 'border-slate-200 bg-slate-50/60 opacity-90 hover:opacity-100'
    }

    return 'border-slate-200 bg-white hover:border-slate-300'
  }

  // =========================================================================
  // COMPONENTE: LINHA DO TEMPO DO FLUXO (Check-in → 7 dias → Avaliações → Oferta)
  // Mostra a etapa atual destacada para cada card de mensagem
  // =========================================================================
  const renderFlowTimeline = (currentMsg: PosVendaMessage) => {
    const soId = currentMsg.service_order
    const sisterMessages = soId ? orderMessageMap.get(soId) || [currentMsg] : [currentMsg]

    // Localiza os estados de cada etapa
    const checkin = sisterMessages.find(
      (m) => m.tipo === 'checkin_pos_venda' || m.tipo === 'avaliacao_30min',
    )
    const msg7d = sisterMessages.find((m) => m.tipo === 'pos_venda_7d')
    const evals = sisterMessages.filter(
      (m) => m.tipo === 'avaliacao_tecnico' || m.tipo === 'avaliacao_google',
    )
    const msg30d = sisterMessages.find((m) => m.tipo === 'oferta_30d')

    // Status de cada etapa: 'done' (sent) | 'active' (atual ou ready) | 'pending' (futuro)
    const checkinState = checkin?.status === 'sent' ? 'done' : checkin ? 'active' : 'pending'

    const state7d =
      msg7d?.status === 'sent' ? 'done' : msg7d?.status === 'ready' ? 'active' : 'pending'

    const anyEvalSent = evals.some((e) => e.status === 'sent')
    const allEvalSent = evals.length > 0 && evals.every((e) => e.status === 'sent')
    const anyEvalReady = evals.some((e) => e.status === 'ready')
    const evalState = allEvalSent ? 'done' : anyEvalSent || anyEvalReady ? 'active' : 'pending'

    const state30d =
      msg30d?.status === 'sent' ? 'done' : msg30d?.status === 'ready' ? 'active' : 'pending'

    // Determina qual etapa corresponde a esta mensagem específica
    const isThisCheckin =
      currentMsg.tipo === 'checkin_pos_venda' || currentMsg.tipo === 'avaliacao_30min'
    const isThis7d = currentMsg.tipo === 'pos_venda_7d'
    const isThisEval =
      currentMsg.tipo === 'avaliacao_tecnico' || currentMsg.tipo === 'avaliacao_google'
    const isThis30d = currentMsg.tipo === 'oferta_30d'

    const steps = [
      {
        key: 'checkin',
        label: '1. Check-in',
        state: checkinState,
        isCurrent: isThisCheckin,
      },
      {
        key: '7d',
        label: '2. 7 Dias',
        state: state7d,
        isCurrent: isThis7d,
      },
      {
        key: 'eval',
        label: '3. Avaliações',
        state: evalState,
        isCurrent: isThisEval,
      },
      {
        key: '30d',
        label: '4. Oferta 30d',
        state: state30d,
        isCurrent: isThis30d,
      },
    ]

    return (
      <div className="bg-slate-50/90 rounded-lg p-2 border border-slate-100 flex items-center justify-between text-[11px] gap-1 overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0 text-slate-500 font-medium">
          <span>Linha do Tempo:</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {steps.map((st, idx) => {
            const isDone = st.state === 'done'
            const isCurrent = st.isCurrent
            const isActive = st.state === 'active'

            let badgeClass = 'bg-slate-100 text-slate-500 border-slate-200'
            if (isCurrent) {
              badgeClass =
                'bg-indigo-600 text-white font-black border-indigo-700 shadow-sm ring-1 ring-indigo-400'
            } else if (isDone) {
              badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
            } else if (isActive) {
              badgeClass = 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
            }

            return (
              <div key={st.key} className="flex items-center gap-1">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${badgeClass}`}
                >
                  {isDone ? (
                    <Check className="h-2.5 w-2.5" />
                  ) : isCurrent ? (
                    <ArrowRight className="h-2.5 w-2.5" />
                  ) : null}
                  {st.label}
                </span>
                {idx < steps.length - 1 && <span className="text-slate-300 text-[10px]">→</span>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Contadores das caixas
  const countReady7d = ready7dMessages.length
  const countOfertas30d = ofertas30dMessages.length
  const countAgendadas = agendadasMessages.length
  const countCheckin = checkinMessages.length
  const countCheckinResponded = checkinMessages.filter((m) => m.cliente_respondeu).length
  const countAvaliacoes = avaliacoesMessages.length
  const countAvaliacoesProntas = avaliacoesMessages.filter((m) => m.status === 'ready').length

  return (
    <div className="space-y-6">
      {/* Top Banner de Identidade do Juquinha */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-4 sm:p-6 text-white shadow-lg border border-indigo-700/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-2xl shadow-inner">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                  Pós-venda — Juquinha
                </h1>
                <Badge className="bg-emerald-400 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                  v0.0.183
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-indigo-200 mt-0.5">
                Fluxo por data de conclusão da O.S. com cadeia automática: envio 7d gera avaliações
                e resposta do cliente libera disparo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <Button
              size="sm"
              onClick={handleOpenNewMessageModal}
              className="h-9 text-xs font-bold gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md flex-1 sm:flex-initial"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Mensagem</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="h-9 text-xs gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1 sm:flex-initial"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Atualizar</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="h-9 text-xs gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white shadow-md flex-1 sm:flex-initial"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Configurações</span>
            </Button>
          </div>
        </div>

        {/* =========================================================================
            ITEM 1: 5 CAIXAS / QUADROS REORGANIZADOS POR DATA DE CONCLUSÃO DA O.S.
            a) Prontas para Disparo (7 dias)
            b) Ofertas (30 dias) [NOVA CAIXA]
            c) Agendadas
            d) Check-in Atendimento
            e) Avaliações (Técnico + Google)
        ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs">
          {/* Caixa A: Prontas para Disparo (7 dias) */}
          <button
            type="button"
            onClick={() => setActiveBox('ready_7d')}
            className={`text-left rounded-xl p-2.5 transition-all cursor-pointer border ${
              activeBox === 'ready_7d'
                ? 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-400/50 shadow-md scale-[1.02]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-indigo-200 text-[11px] block font-medium">
                Prontas (7 dias)
              </span>
              {activeBox === 'ready_7d' && (
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.2 rounded">
                  Ativo
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-emerald-300">{countReady7d}</span>
              <span className="text-[10px] text-emerald-200/80">urgente 1º</span>
            </div>
          </button>

          {/* Caixa B: NOVA CAIXA - Ofertas (30 dias) */}
          <button
            type="button"
            onClick={() => setActiveBox('ofertas_30d')}
            className={`text-left rounded-xl p-2.5 transition-all cursor-pointer border ${
              activeBox === 'ofertas_30d'
                ? 'bg-purple-500/25 border-purple-400 ring-2 ring-purple-400/50 shadow-md scale-[1.02]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-indigo-200 text-[11px] block font-medium">
                🎁 Ofertas (30 dias)
              </span>
              {activeBox === 'ofertas_30d' && (
                <span className="text-[10px] font-bold text-purple-300 bg-purple-950/60 px-1.5 py-0.2 rounded">
                  Ativo
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-purple-300">{countOfertas30d}</span>
              <span className="text-[10px] text-purple-200/80">30d passados</span>
            </div>
          </button>

          {/* Caixa C: Agendadas (data futura) */}
          <button
            type="button"
            onClick={() => setActiveBox('agendadas')}
            className={`text-left rounded-xl p-2.5 transition-all cursor-pointer border ${
              activeBox === 'agendadas'
                ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400/50 shadow-md scale-[1.02]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-indigo-200 text-[11px] block font-medium">
                Agendadas Futuras
              </span>
              {activeBox === 'agendadas' && (
                <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.2 rounded">
                  Ativo
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-300">{countAgendadas}</span>
              <span className="text-[10px] text-amber-200/80">próx. a vencer</span>
            </div>
          </button>

          {/* Caixa D: Check-in Atendimento */}
          <button
            type="button"
            onClick={() => setActiveBox('checkin')}
            className={`text-left rounded-xl p-2.5 transition-all cursor-pointer border ${
              activeBox === 'checkin'
                ? 'bg-sky-500/25 border-sky-400 ring-2 ring-sky-400/50 shadow-md scale-[1.02]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-indigo-200 text-[11px] block font-medium">
                💬 Check-in Atend.
              </span>
              {activeBox === 'checkin' && (
                <span className="text-[10px] font-bold text-sky-300 bg-sky-950/60 px-1.5 py-0.2 rounded">
                  Ativo
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-sky-300">{countCheckin}</span>
              {countCheckinResponded > 0 && (
                <span className="text-[10px] text-purple-300 font-bold bg-purple-950/50 px-1 rounded">
                  {countCheckinResponded} resp.
                </span>
              )}
            </div>
          </button>

          {/* Caixa E: Avaliações (Técnico + Google) */}
          <button
            type="button"
            onClick={() => setActiveBox('avaliacoes')}
            className={`text-left rounded-xl p-2.5 transition-all cursor-pointer border col-span-2 sm:col-span-1 ${
              activeBox === 'avaliacoes'
                ? 'bg-amber-400/25 border-amber-300 ring-2 ring-amber-300/50 shadow-md scale-[1.02]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-indigo-200 text-[11px] block font-medium">
                ⭐ Avaliações (Téc+Google)
              </span>
              {activeBox === 'avaliacoes' && (
                <span className="text-[10px] font-bold text-amber-200 bg-amber-950/60 px-1.5 py-0.2 rounded">
                  Ativo
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-200">{countAvaliacoes}</span>
              {countAvaliacoesProntas > 0 && (
                <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950/50 px-1 rounded">
                  {countAvaliacoesProntas} prontas
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Explicação Didática da Cadeia Automática e Limitação do WhatsApp */}
      <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3.5 sm:p-4 text-xs text-indigo-950 space-y-1.5">
        <div className="flex items-start gap-2.5">
          <HelpCircle className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
          <div className="space-y-1 flex-1">
            <p className="font-bold text-slate-900">
              Cadeia Automática do Pós-venda por Data de Conclusão da O.S. (v0.0.183):
            </p>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              <strong>1) Disparar 7 dias:</strong> Ao enviar a mensagem de 7 dias, o sistema gera
              automaticamente as 2 avaliações (Técnico ⭐ e Google 🌐) como pendentes.
              <br />
              <strong>2) Cliente respondeu:</strong> Ao marcar "Cliente respondeu", as avaliações
              são promovidas instantaneamente para prontas (ready) e uma notificação é gerada para a
              equipe.
              <br />
              <strong>3) Ordenação inteligente:</strong> As mensagens de ação mostram as mais
              antigas primeiro (urgentes no topo); as agendadas mostram a próxima a vencer.
            </p>
            <p className="text-[10px] text-slate-500 italic pt-0.5 border-t border-indigo-200/40">
              * Nota: A leitura automática das respostas do WhatsApp requer a API Oficial da Meta. O
              fluxo utiliza o botão <strong>"Cliente respondeu"</strong> como gatilho oficial.
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
            Caixa Atual:
          </span>

          <Badge className="text-xs font-bold bg-indigo-100 text-indigo-900 border-indigo-200">
            {activeBox === 'ready_7d' && `Prontas (7 dias) • ${countReady7d}`}
            {activeBox === 'ofertas_30d' && `Ofertas (30 dias) • ${countOfertas30d}`}
            {activeBox === 'agendadas' && `Agendadas Futuras • ${countAgendadas}`}
            {activeBox === 'checkin' && `Check-in Atendimento • ${countCheckin}`}
            {activeBox === 'avaliacoes' && `Avaliações • ${countAvaliacoes}`}
            {activeBox === 'todas' && `Todas as Mensagens • ${messages.length}`}
          </Badge>

          {activeBox !== 'todas' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveBox('todas')}
              className="h-7 text-xs text-slate-500 hover:text-slate-800"
            >
              Ver todas ({messages.length})
            </Button>
          )}

          {/* Sub-filtro para Check-in */}
          {activeBox === 'checkin' && (
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg ml-auto">
              <Button
                variant={checkinSubFilter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCheckinSubFilter('all')}
                className="h-7 text-[11px] px-2"
              >
                Todos ({checkinMessages.length})
              </Button>
              <Button
                variant={checkinSubFilter === 'responded' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCheckinSubFilter('responded')}
                className="h-7 text-[11px] px-2 font-bold text-purple-700"
              >
                Respondidas ({countCheckinResponded})
              </Button>
              <Button
                variant={checkinSubFilter === 'pending_response' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCheckinSubFilter('pending_response')}
                className="h-7 text-[11px] px-2 text-slate-600"
              >
                Aguardando ({checkinMessages.length - countCheckinResponded})
              </Button>
            </div>
          )}

          {/* Sub-filtro para Todas */}
          {activeBox === 'todas' && (
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg ml-auto">
              <Button
                variant={statusSubFilter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusSubFilter('all')}
                className="h-7 text-[11px] px-2"
              >
                Todas
              </Button>
              <Button
                variant={statusSubFilter === 'ready' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusSubFilter('ready')}
                className="h-7 text-[11px] px-2 font-bold text-emerald-700"
              >
                Prontas
              </Button>
              <Button
                variant={statusSubFilter === 'pending' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusSubFilter('pending')}
                className="h-7 text-[11px] px-2 text-amber-700"
              >
                Agendadas
              </Button>
              <Button
                variant={statusSubFilter === 'sent' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusSubFilter('sent')}
                className="h-7 text-[11px] px-2 text-slate-700"
              >
                Enviadas
              </Button>
            </div>
          )}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por cliente, OS ou equipamento..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      {/* Lista de Mensagens de Pós-Venda Reorganizadas */}
      <div className="space-y-3">
        {loading && messages.length === 0 ? (
          <Card className="border-slate-200 p-8 text-center text-slate-500">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
            <p className="text-xs font-semibold">Carregando mensagens do Juquinha...</p>
          </Card>
        ) : currentBoxMessages.length === 0 ? (
          <Card className="border-slate-200 p-8 text-center text-slate-500">
            <p className="text-sm font-semibold">Nenhuma mensagem nesta caixa no momento.</p>
            <p className="text-xs text-slate-400 mt-1">
              {activeBox === 'ready_7d' &&
                'As mensagens de 7 dias aparecem aqui assim que os 7 dias da conclusão da O.S. forem atingidos.'}
              {activeBox === 'ofertas_30d' &&
                'As ofertas de 30 dias aparecem aqui assim que completarem 30 dias da conclusão da O.S.'}
              {activeBox === 'agendadas' &&
                'Todas as mensagens futuras agendadas pelo Juquinha já foram processadas ou atingiram a data.'}
              {activeBox === 'checkin' &&
                'Não há check-ins de atendimento com o filtro selecionado.'}
              {activeBox === 'avaliacoes' &&
                'As avaliações são criadas automaticamente ao disparar o acompanhamento de 7 dias ou quando o cliente responde ao check-in.'}
            </p>
          </Card>
        ) : (
          currentBoxMessages.map((msg) => {
            const cust = msg.expand?.customer
            const so = msg.expand?.service_order
            const custName = getCustomerDisplayName(cust)
            const phone = getCustomerPhone(cust)
            const isCheckin = msg.tipo === 'checkin_pos_venda' || msg.tipo === 'avaliacao_30min'
            const is7d = msg.tipo === 'pos_venda_7d'
            const is30d = msg.tipo === 'oferta_30d'
            const isEval = msg.tipo === 'avaliacao_tecnico' || msg.tipo === 'avaliacao_google'

            const isReleasingThis = releasingEvaluationsId === msg.id
            const isMarkingResponded = markingRespondedId === msg.id
            const cardClasses = getCardVisualClasses(msg)

            const completionDate = getOrderCompletionDate(msg)
            const daysSinceComp = getDaysSinceCompletion(msg)
            const daysRemaining = getDaysRemainingUntilScheduled(msg)

            return (
              <Card key={msg.id} className={`transition-all overflow-hidden ${cardClasses}`}>
                {/* Faixa decorativa no topo para destacar situação */}
                <div
                  className={`h-1.5 w-full ${
                    isEval && msg.status === 'ready'
                      ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 animate-pulse'
                      : isCheckin && msg.cliente_respondeu && !msg.avaliacoes_liberadas
                        ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 animate-pulse'
                        : is7d && msg.status === 'ready'
                          ? 'bg-emerald-500'
                          : is30d && msg.status === 'ready'
                            ? 'bg-purple-500'
                            : msg.status === 'sent'
                              ? 'bg-slate-400'
                              : 'bg-indigo-400'
                  }`}
                />

                <CardContent className="p-4 sm:p-5 space-y-3">
                  {/* Cabeçalho do Card com Badges e Informações de Data */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getTipoBadge(msg.tipo)}
                      {getStatusBadge(msg)}
                      {so && (
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          OS #{so.number}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono flex-wrap">
                      {/* Data de conclusão da OS */}
                      <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        <Calendar className="h-3 w-3 text-slate-500" />
                        Conclusão OS: <strong>{completionDate.toLocaleDateString('pt-BR')}</strong>
                        {daysSinceComp >= 0 && (
                          <span className="text-[10px] text-slate-500 ml-0.5">
                            ({daysSinceComp} {daysSinceComp === 1 ? 'dia' : 'dias'} atrás)
                          </span>
                        )}
                      </span>

                      {/* Agendamento / Dias restantes */}
                      {msg.status === 'pending' && daysRemaining > 0 && (
                        <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold">
                          <Clock className="h-3 w-3 text-amber-600" />
                          Faltam {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}
                        </span>
                      )}

                      {msg.status === 'sent' && msg.sent_at && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Check className="h-3 w-3 text-emerald-600" />
                          Enviado em: {new Date(msg.sent_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Informações do Cliente e Equipamento */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                        <User className="h-3.5 w-3.5 text-indigo-600" />
                        {custName}
                        {msg.cliente_respondeu && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
                            ✓ Cliente Respondeu
                            {msg.cliente_respondeu_em &&
                              ` (${new Date(msg.cliente_respondeu_em).toLocaleDateString('pt-BR')})`}
                          </span>
                        )}
                      </p>
                      <p className="text-slate-500 font-mono text-[11px] mt-0.5">
                        {phone || 'Telefone não cadastrado'}
                      </p>
                    </div>

                    {so?.equipment && (
                      <div className="text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-100 text-[11px] flex items-center gap-1.5">
                        <Wrench className="h-3 w-3 text-slate-400" />
                        <span>
                          Equipamento: <strong>{so.equipment}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Item 3: Linha do Tempo do Fluxo (Check-in → 7 dias → Avaliações → Oferta) */}
                  {renderFlowTimeline(msg)}

                  {/* Texto da Mensagem */}
                  <div className="bg-white/80 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                    {msg.texto_gerado || (
                      <span className="text-slate-400 italic">
                        O texto será gerado no momento do disparo comercial pelo Juquinha.
                      </span>
                    )}
                  </div>

                  {/* Ações Rápidas em Cadeia (Item 2 e 3) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAiModal(msg)}
                        className="h-9 text-xs font-semibold gap-1.5 border-indigo-200 text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 rounded-lg"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Refinar c/ IA</span>
                      </Button>

                      {/* GATILHO DA CADEIA: Botão 'Cliente respondeu' (disponível no Check-in OU na mensagem de 7 dias) */}
                      {(isCheckin || is7d) && (
                        <>
                          {!msg.cliente_respondeu ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isMarkingResponded}
                              onClick={() => handleMarkAsResponded(msg)}
                              className="h-9 text-xs font-bold gap-1.5 border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg shadow-xs"
                            >
                              <MessageCircle className="h-3.5 w-3.5 text-purple-600" />
                              <span>
                                {isMarkingResponded ? 'Gravando...' : 'Cliente respondeu'}
                              </span>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                markPosVendaMessageResponded(msg.id, false, msg).then(() =>
                                  loadData(),
                                )
                              }
                              className="h-9 text-[11px] text-slate-400 hover:text-slate-600 rounded-lg"
                              title="Clique para desfazer a marcação de resposta"
                            >
                              Desmarcar resposta
                            </Button>
                          )}
                        </>
                      )}

                      {/* Botão de Liberação de Avaliações (quando respondido mas avaliações ainda não constam) */}
                      {isCheckin && msg.cliente_respondeu && !msg.avaliacoes_liberadas && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={isReleasingThis}
                          onClick={() => handleReleaseEvaluations(msg)}
                          className="h-9 text-xs font-black gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md ring-2 ring-amber-400/50 rounded-lg animate-bounce"
                        >
                          <Star className="h-3.5 w-3.5 fill-slate-950" />
                          <span>
                            {isReleasingThis
                              ? 'Liberando avaliações...'
                              : 'Liberar avaliações agora'}
                          </span>
                        </Button>
                      )}

                      {msg.status !== 'dismissed' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDismiss(msg.id)}
                          className="h-9 text-xs text-slate-400 hover:text-red-500 rounded-lg"
                        >
                          Descartar
                        </Button>
                      )}
                    </div>

                    {/* Botão WhatsApp 1-Toque (dispara e atualiza para sent + cadeia de 7d cria as avaliações) */}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSendOneTouch(msg)}
                      disabled={!msg.wa_me_link}
                      className="h-9 px-4 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 rounded-xl"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Disparar WhatsApp (1-Toque)</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Modal de Nova Mensagem Manual */}
      <Dialog open={newMsgModalOpen} onOpenChange={setNewMsgModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              Criar Nova Mensagem do Juquinha
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Dispare manualmente um check-in, pós-venda, avaliação ou oferta para qualquer cliente
              via WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Selecione o Cliente</Label>
              <Select value={manualCustomerId} onValueChange={setManualCustomerId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {customersList.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {getCustomerDisplayName(c)} {c.celular ? `(${c.celular})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Tipo da Mensagem</Label>
                <Select value={manualTipo} onValueChange={(v) => setManualTipo(v as any)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checkin_pos_venda" className="text-xs">
                      💬 Check-in Atendimento
                    </SelectItem>
                    <SelectItem value="pos_venda_7d" className="text-xs">
                      🛠️ Acompanhamento (7 dias)
                    </SelectItem>
                    <SelectItem value="oferta_30d" className="text-xs">
                      🎁 Oferta Especial (30 dias)
                    </SelectItem>
                    <SelectItem value="avaliacao_tecnico" className="text-xs">
                      ⭐ Avaliação do Técnico
                    </SelectItem>
                    <SelectItem value="avaliacao_google" className="text-xs">
                      🌐 Avaliação no Google
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Vincular a uma O.S. (Opcional)
                </Label>
                <Select value={manualOrderId} onValueChange={setManualOrderId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Sem O.S. vinculada" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none" className="text-xs text-slate-500">
                      Nenhuma O.S. (Mensagem Avulsa)
                    </SelectItem>
                    {ordersList
                      .filter((o) => !manualCustomerId || o.customer === manualCustomerId)
                      .map((o) => (
                        <SelectItem key={o.id} value={o.id} className="text-xs">
                          OS #{o.number} {o.equipment ? `— ${o.equipment}` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Texto Humanizado Personalizado (Juquinha)
              </Label>
              <Textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                rows={7}
                className="text-xs leading-relaxed"
              />
              <p className="text-[11px] text-slate-500">
                O texto é pré-preenchido automaticamente com base nas regras do Juquinha e pode ser
                ajustado livremente antes do envio.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewMsgModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleCreateAndSendManualMsg(false)}
              disabled={creatingManualMsg}
              className="text-xs"
            >
              Salvar como Pronta
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleCreateAndSendManualMsg(true)}
              disabled={creatingManualMsg}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{creatingManualMsg ? 'Salvando...' : 'Salvar e Abrir WhatsApp'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Configurações do Juquinha */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Settings className="h-4 w-4 text-indigo-600" />
              Configurações do Agente Juquinha
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Link de Avaliação do Google (Google Review URL)
              </Label>
              <Input
                value={googleUrl}
                onChange={(e) => setGoogleUrl(e.target.value)}
                placeholder="https://g.page/r/.../review"
                className="h-9 text-xs font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Este link é inserido automaticamente nas mensagens de avaliação no Google geradas na
                cadeia do pós-venda.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1 text-slate-600">
              <p className="font-semibold text-slate-800">Horário Comercial Protegido:</p>
              <p>
                O disparo e preparação de mensagens ocorre exclusivamente em horário comercial
                (08:00 às 18:00) para respeitar o cliente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Personalização com IA do Juquinha */}
      <Dialog open={customModalOpen} onOpenChange={setCustomModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Personalizar com Juquinha (Skip Cloud AI)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Instrução adicional para o Juquinha (opcional)
              </Label>
              <Input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Ex: 'Mencione que trocamos o SSD e ficou 10x mais rápido'..."
                className="h-9 text-xs"
              />
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleGenerateWithAi}
              disabled={generatingAi}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {generatingAi ? 'Gerando com o Juquinha...' : 'Gerar Variação Humanizada'}
            </Button>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Texto Final para WhatsApp
              </Label>
              <Textarea
                value={aiGeneratedText}
                onChange={(e) => setAiGeneratedText(e.target.value)}
                rows={6}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCustomModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApplyAiText}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Salvar Mensagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
