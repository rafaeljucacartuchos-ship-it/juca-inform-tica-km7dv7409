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
  ArrowRight,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { PosVendaMessage, PosVendaStatus, PosVendaTipo, Customer, ServiceOrder } from '@/types'
import { getCustomerDisplayName, getCustomerPhone, getCustomers } from '@/services/customers'
import { getServiceOrders } from '@/services/service_orders'
import { notifyStaffMembers } from '@/services/notifications'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'

export default function PosVendaJuquinha() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [messages, setMessages] = useState<PosVendaMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState<'ready' | 'pending' | 'sent' | 'all'>('ready')
  const [tipoFilter, setTipoFilter] = useState<'all' | PosVendaTipo | 'evaluations'>('all')
  const [activeKpi, setActiveKpi] = useState<'ready' | 'pending' | 'checkin' | 'eval' | null>(null)
  const [filterText, setFilterText] = useState('')

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

  const handleSendOneTouch = async (msg: PosVendaMessage) => {
    const link = msg.wa_me_link
    if (link) {
      window.open(link, '_blank')
    }
    try {
      await markPosVendaMessageSent(msg.id)
      toast({
        title: 'WhatsApp aberto!',
        description: 'Mensagem marcada como enviada no histórico.',
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

  // AÇÃO 3: Marcar Check-in como respondido pelo cliente + Criar Notificação
  const handleMarkAsResponded = async (msg: PosVendaMessage) => {
    setMarkingRespondedId(msg.id)
    try {
      await markPosVendaMessageResponded(msg.id, true)

      const cust = msg.expand?.customer
      const custName = getCustomerDisplayName(cust)
      const soNumber = msg.expand?.service_order?.number || ''
      const osLabel = soNumber ? ` da OS #${soNumber}` : ''

      // Notificação para atendentes e admins
      await notifyStaffMembers({
        title: `💬 ${custName} respondeu ao pós-venda`,
        message: `${custName} respondeu ao check-in de atendimento${osLabel}. Acesse o Pós-venda para liberar as avaliações do técnico e Google!`,
        type: 'service_order',
        link: '/pos-venda',
      })

      toast({
        title: 'Cliente marcado como respondido!',
        description:
          'Notificação criada para a equipe. O botão de liberar avaliações já está liberado!',
      })

      await loadData()
    } catch (err) {
      toast({
        title: 'Erro ao marcar check-in como respondido',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setMarkingRespondedId(null)
    }
  }

  // ETAPA 2: Botão "Cliente respondeu → Liberar avaliações"
  const handleReleaseEvaluations = async (msg: PosVendaMessage) => {
    if (!msg.cliente_respondeu) {
      toast({
        title: 'Aguardando resposta do cliente',
        description: 'Marque primeiro o check-in como respondido para liberar as avaliações.',
        variant: 'destructive',
      })
      return
    }

    setReleasingEvaluationsId(msg.id)
    try {
      await releaseJuquinhaEvaluations(msg)
      toast({
        title: 'Avaliações liberadas com sucesso!',
        description:
          '2 mensagens criadas: Avaliação do Técnico (⭐) e Avaliação no Google (🌐) prontas para disparo.',
      })
      setStatusTab('ready')
      setTipoFilter('all')
      setActiveKpi('ready')
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

  // Handler para cliques nos 4 quadros rápidos de informação (Toggle / Filtro)
  const handleKpiClick = (kpi: 'ready' | 'pending' | 'checkin' | 'eval') => {
    if (activeKpi === kpi) {
      // Clicar de novo limpa o filtro
      setActiveKpi(null)
      setStatusTab('all')
      setTipoFilter('all')
      return
    }

    setActiveKpi(kpi)
    if (kpi === 'ready') {
      setStatusTab('ready')
      setTipoFilter('all')
    } else if (kpi === 'pending') {
      setStatusTab('pending')
      setTipoFilter('all')
    } else if (kpi === 'checkin') {
      setStatusTab('all')
      setTipoFilter('checkin_pos_venda')
    } else if (kpi === 'eval') {
      setStatusTab('all')
      setTipoFilter('evaluations')
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

  // Atualiza o texto pré-gerado quando os seletores manuais mudam
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

  // Cria e dispara a nova mensagem manual em 1 toque
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
    } catch (err) {
      toast({ title: 'Erro ao criar mensagem manual', variant: 'destructive' })
    } finally {
      setCreatingManualMsg(false)
    }
  }

  const getTipoBadge = (tipo: PosVendaTipo) => {
    switch (tipo) {
      case 'checkin_pos_venda':
        return (
          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[11px] font-bold gap-1">
            💬 Check-in Atendimento (Etapa 1)
          </Badge>
        )
      case 'avaliacao_tecnico':
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[11px] font-bold gap-1">
            <Star className="h-3 w-3 text-amber-600 fill-amber-500" /> Avaliação do Técnico (Etapa
            2)
          </Badge>
        )
      case 'avaliacao_google':
        return (
          <Badge className="bg-sky-100 text-sky-900 border-sky-300 text-[11px] font-bold gap-1">
            <Globe className="h-3 w-3 text-sky-600" /> Avaliação no Google (Etapa 2)
          </Badge>
        )
      case 'avaliacao_30min':
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[11px] font-bold">
            ⭐ Avaliação (30 min)
          </Badge>
        )
      case 'pos_venda_7d':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[11px] font-bold">
            🛠️ Acompanhamento (7 dias)
          </Badge>
        )
      case 'oferta_30d':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[11px] font-bold">
            🎁 Oferta Especial (30 dias)
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

  const getStatusBadge = (msg: PosVendaMessage) => {
    const { status, tipo, cliente_respondeu, avaliacoes_liberadas } = msg

    // Cores específicas para Check-in por situação do atendimento
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
          <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-black gap-1 text-[11px] shadow-sm animate-pulse">
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
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1 text-[11px]">
            <Send className="h-3 w-3" /> Aguardando envio
          </Badge>
        )
      }
      if (status === 'pending') {
        return (
          <Badge className="bg-slate-500 text-white font-bold gap-1 text-[11px]">
            <Clock className="h-3 w-3" /> Agendado (~30min)
          </Badge>
        )
      }
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

  // Cores por situação do atendimento (Item 5) para o Card do Check-in:
  // - Aguardando envio (azul/cinza suave)
  // - Enviado e aguardando resposta (âmbar suave)
  // - Cliente respondeu — ação pendente (roxo/verde vibrante com pulso/destaque)
  // - Avaliações já liberadas (neutro/esmaecido)
  const getCardVisualClasses = (msg: PosVendaMessage) => {
    if (msg.tipo !== 'checkin_pos_venda') {
      return 'border-slate-200 bg-white hover:border-slate-300'
    }

    if (msg.avaliacoes_liberadas) {
      return 'border-slate-200 bg-slate-50/70 opacity-80 hover:opacity-100 hover:border-slate-300'
    }

    if (msg.cliente_respondeu) {
      return 'border-2 border-purple-500 bg-gradient-to-br from-purple-50/90 via-fuchsia-50/40 to-white shadow-md ring-2 ring-purple-400/40'
    }

    if (msg.status === 'sent') {
      return 'border-amber-300 bg-gradient-to-br from-amber-50/70 to-white hover:border-amber-400'
    }

    // Aguardando envio (ready ou pending)
    return 'border-blue-200 bg-gradient-to-br from-blue-50/50 via-slate-50/40 to-white hover:border-blue-300'
  }

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (statusTab !== 'all' && m.status !== statusTab) return false
      if (tipoFilter === 'evaluations') {
        if (m.tipo !== 'avaliacao_tecnico' && m.tipo !== 'avaliacao_google') return false
      } else if (tipoFilter !== 'all' && m.tipo !== tipoFilter) {
        return false
      }
      if (!filterText.trim()) return true
      const q = filterText.toLowerCase()
      const cust = m.expand?.customer
      const name = (cust?.razao_social || cust?.nome_fantasia || cust?.name || '').toLowerCase()
      const soNumber = (m.expand?.service_order?.number || '').toLowerCase()
      return (
        name.includes(q) || soNumber.includes(q) || (m.texto_gerado || '').toLowerCase().includes(q)
      )
    })
  }, [messages, statusTab, tipoFilter, filterText])

  const readyCount = messages.filter((m) => m.status === 'ready').length
  const pendingCount = messages.filter((m) => m.status === 'pending').length
  const checkinCount = messages.filter((m) => m.tipo === 'checkin_pos_venda').length
  const evalCount = messages.filter(
    (m) => m.tipo === 'avaliacao_tecnico' || m.tipo === 'avaliacao_google',
  ).length

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
                  Fluxo 2 Etapas Ativo
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-indigo-200 mt-0.5">
                Etapa 1: Check-in de atendimento → Etapa 2: Avaliações separadas (Técnico ⭐ +
                Google 🌐) após resposta do cliente.
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

        {/* Indicadores rápidos de mensagens — QUADROS CLICÁVEIS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs">
          <button
            type="button"
            onClick={() => handleKpiClick('ready')}
            className={`text-left rounded-xl p-2.5 transition-all cursor-pointer border ${
              activeKpi === 'ready'
                ? 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-400/50 shadow-md scale-[1.02]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-indigo-200 text-[11px] block font-medium">
                Prontas para Disparo
              </span>
              {activeKpi === 'ready' && (
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.2 rounded">
                  Ativo
                </span>
              )}
            </div>
            <span className="text-xl font-bold font-mono text-emerald-300 block mt-0.5">
              {readyCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleKpiClick('pending')}
            className={`text-left rounded-xl p-2.5 transition-all cursor-pointer border ${
              activeKpi === 'pending'
                ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400/50 shadow-md scale-[1.02]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-indigo-200 text-[11px] block font-medium">
                Agendadas (Aguardando)
              </span>
              {activeKpi === 'pending' && (
                <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.2 rounded">
                  Ativo
                </span>
              )}
            </div>
            <span className="text-xl font-bold font-mono text-amber-300 block mt-0.5">
              {pendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleKpiClick('checkin')}
            className={`text-left rounded-xl p-2.5 transition-all cursor-pointer border ${
              activeKpi === 'checkin'
                ? 'bg-sky-500/25 border-sky-400 ring-2 ring-sky-400/50 shadow-md scale-[1.02]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-indigo-200 text-[11px] block font-medium">
                Check-ins Atendimento
              </span>
              {activeKpi === 'checkin' && (
                <span className="text-[10px] font-bold text-sky-300 bg-sky-950/60 px-1.5 py-0.2 rounded">
                  Ativo
                </span>
              )}
            </div>
            <span className="text-xl font-bold font-mono text-sky-300 block mt-0.5">
              {checkinCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleKpiClick('eval')}
            className={`text-left rounded-xl p-2.5 transition-all cursor-pointer border ${
              activeKpi === 'eval'
                ? 'bg-purple-500/25 border-purple-400 ring-2 ring-purple-400/50 shadow-md scale-[1.02]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-indigo-200 text-[11px] block font-medium">
                Avaliações (Técnico + Google)
              </span>
              {activeKpi === 'eval' && (
                <span className="text-[10px] font-bold text-purple-300 bg-purple-950/60 px-1.5 py-0.2 rounded">
                  Ativo
                </span>
              )}
            </div>
            <span className="text-xl font-bold font-mono text-purple-300 block mt-0.5">
              {evalCount}
            </span>
          </button>
        </div>
      </div>

      {/* Explicação Didática do Novo Fluxo em 2 Etapas */}
      <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3.5 sm:p-4 text-xs text-indigo-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <HelpCircle className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-bold text-slate-900">
              Como funciona o novo fluxo de pós-venda em 2 etapas?
            </p>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              <strong>1ª Etapa:</strong> O Juquinha manda um <em>Check-in humanizado</em>{' '}
              perguntando se o cliente está gostando do serviço/equipamento.{' '}
              <br className="hidden sm:inline" />
              <strong>2ª Etapa:</strong> Quando o cliente responder, clique em{' '}
              <strong>"Cliente respondeu → Liberar avaliações"</strong> para gerar 2 mensagens
              separadas: Avaliação do Técnico (⭐) e Avaliação no Google (🌐).
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <Tabs
          value={statusTab}
          onValueChange={(v) => {
            setStatusTab(v as any)
            if (activeKpi === 'ready' && v !== 'ready') setActiveKpi(null)
            if (activeKpi === 'pending' && v !== 'pending') setActiveKpi(null)
          }}
          className="w-full lg:w-auto"
        >
          <TabsList className="grid grid-cols-4 w-full lg:w-auto h-9 bg-slate-100 p-1">
            <TabsTrigger value="ready" className="text-xs font-bold px-3">
              Prontas ({readyCount})
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs font-bold px-3">
              Agendadas
            </TabsTrigger>
            <TabsTrigger value="sent" className="text-xs font-bold px-3">
              Enviadas
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs font-bold px-3">
              Todas
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 lg:max-w-xl">
          <div className="w-full sm:w-56">
            <Select
              value={tipoFilter}
              onValueChange={(v) => {
                setTipoFilter(v as any)
                if (activeKpi === 'checkin' && v !== 'checkin_pos_venda') setActiveKpi(null)
                if (activeKpi === 'eval' && v !== 'evaluations') setActiveKpi(null)
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50 border-slate-200">
                <Filter className="h-3.5 w-3.5 mr-1 text-slate-400" />
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-semibold">
                  Todos os tipos
                </SelectItem>
                <SelectItem value="evaluations" className="text-xs font-semibold text-purple-700">
                  ⭐ + 🌐 Avaliações (Técnico + Google)
                </SelectItem>
                <SelectItem value="checkin_pos_venda" className="text-xs">
                  💬 Check-in (Etapa 1)
                </SelectItem>
                <SelectItem value="avaliacao_tecnico" className="text-xs">
                  ⭐ Avaliação do Técnico
                </SelectItem>
                <SelectItem value="avaliacao_google" className="text-xs">
                  🌐 Avaliação no Google
                </SelectItem>
                <SelectItem value="pos_venda_7d" className="text-xs">
                  🛠️ Acompanhamento 7 dias
                </SelectItem>
                <SelectItem value="oferta_30d" className="text-xs">
                  🎁 Oferta Especial 30 dias
                </SelectItem>
                <SelectItem value="avaliacao_30min" className="text-xs">
                  ⭐ Avaliação Legado (30min)
                </SelectItem>
                <SelectItem value="resumo_finalizacao" className="text-xs">
                  📄 Resumo de Conclusão
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por cliente, OS ou texto..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Lista de Mensagens de Pós-Venda */}
      <div className="space-y-3">
        {loading && messages.length === 0 ? (
          <Card className="border-slate-200 p-8 text-center text-slate-500">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
            <p className="text-xs font-semibold">Carregando mensagens do Juquinha...</p>
          </Card>
        ) : filteredMessages.length === 0 ? (
          <Card className="border-slate-200 p-8 text-center text-slate-500">
            <p className="text-sm font-semibold">Nenhuma mensagem encontrada neste filtro.</p>
            <p className="text-xs text-slate-400 mt-1">
              As mensagens são agendadas automaticamente pelo Juquinha ao concluir uma Ordem de
              Serviço, ou você pode criar uma clicando em "Nova Mensagem".
            </p>
          </Card>
        ) : (
          filteredMessages.map((msg) => {
            const cust = msg.expand?.customer
            const so = msg.expand?.service_order
            const custName = getCustomerDisplayName(cust)
            const phone = getCustomerPhone(cust)
            const isCheckin = msg.tipo === 'checkin_pos_venda'
            const isReleasingThis = releasingEvaluationsId === msg.id
            const isMarkingResponded = markingRespondedId === msg.id
            const cardClasses = getCardVisualClasses(msg)

            return (
              <Card key={msg.id} className={`transition-all overflow-hidden ${cardClasses}`}>
                {/* Faixa decorativa no topo para check-in por situação */}
                {isCheckin && (
                  <div
                    className={`h-1.5 w-full ${
                      msg.avaliacoes_liberadas
                        ? 'bg-slate-300'
                        : msg.cliente_respondeu
                          ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 animate-pulse'
                          : msg.status === 'sent'
                            ? 'bg-amber-400'
                            : 'bg-blue-500'
                    }`}
                  />
                )}

                <CardContent className="p-4 sm:p-5 space-y-3">
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
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      <span>
                        Agendado para:{' '}
                        {msg.scheduled_at
                          ? new Date(msg.scheduled_at).toLocaleString('pt-BR')
                          : 'Imediato'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-indigo-600" />
                        {custName}
                        {isCheckin && msg.cliente_respondeu && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
                            ✓ Respondeu{' '}
                            {msg.cliente_respondeu_em
                              ? `(${new Date(msg.cliente_respondeu_em).toLocaleDateString('pt-BR')})`
                              : ''}
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

                  {/* Texto da mensagem prévia */}
                  <div className="bg-white/80 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                    {msg.texto_gerado || (
                      <span className="text-slate-400 italic">
                        O texto será gerado no momento do disparo comercial pelo Juquinha.
                      </span>
                    )}
                  </div>

                  {/* Ações Rápidas */}
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

                      {/* AÇÃO 3: Marcar Check-in como respondido pelo cliente */}
                      {isCheckin && (
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
                                {isMarkingResponded ? 'Gravando...' : 'Marcar como respondido'}
                              </span>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                markPosVendaMessageResponded(msg.id, false).then(() => loadData())
                              }
                              className="h-9 text-[11px] text-slate-400 hover:text-slate-600 rounded-lg"
                              title="Clique para desfazer a marcação de resposta"
                            >
                              Desmarcar resposta
                            </Button>
                          )}
                        </>
                      )}

                      {/* ETAPA 2 (Item 4): Botão 'Cliente respondeu → Liberar avaliações'
                          SÓ ATIVO APÓS RESPOSTA DO CLIENTE!
                          Enquanto NÃO respondido: cinza/desabilitado com texto 'Aguardando resposta do cliente...'.
                          Quando respondido: ativo (âmbar vibrante).
                          Quando já liberado: desabilitado com 'Avaliações já liberadas'.
                      */}
                      {isCheckin && (
                        <>
                          {msg.avaliacoes_liberadas ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled
                              className="h-9 text-xs font-semibold gap-1.5 bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed rounded-lg"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
                              <span>Avaliações já liberadas</span>
                            </Button>
                          ) : !msg.cliente_respondeu ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled
                              className="h-9 text-xs font-medium gap-1.5 bg-slate-100 hover:bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed rounded-lg opacity-75"
                              title="Aguardando o cliente responder ao WhatsApp para liberar os pedidos de avaliação."
                            >
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span>Aguardando resposta do cliente...</span>
                            </Button>
                          ) : (
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
                                  : 'Cliente respondeu → Liberar avaliações'}
                              </span>
                            </Button>
                          )}
                        </>
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
              Dispare manualmente um check-in, pedido de avaliação ou oferta para qualquer cliente
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
                      💬 Check-in Atendimento (Etapa 1)
                    </SelectItem>
                    <SelectItem value="avaliacao_tecnico" className="text-xs">
                      ⭐ Avaliação do Técnico (Etapa 2)
                    </SelectItem>
                    <SelectItem value="avaliacao_google" className="text-xs">
                      🌐 Avaliação no Google (Etapa 2)
                    </SelectItem>
                    <SelectItem value="pos_venda_7d" className="text-xs">
                      🛠️ Acompanhamento (7 dias)
                    </SelectItem>
                    <SelectItem value="oferta_30d" className="text-xs">
                      🎁 Oferta Especial (30 dias)
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
                Este link é inserido automaticamente nas mensagens separadas de avaliação no Google
                disparadas na etapa 2 do pós-venda.
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
                placeholder="Ex: 'Mencione que trocamos o SSD e ficou 10x mais rápido' ou 'Tom ainda mais carinhoso'..."
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
