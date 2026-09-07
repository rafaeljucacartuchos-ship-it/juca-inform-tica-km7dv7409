import { useState, useEffect } from 'react'
import {
  MessageSquare,
  Sparkles,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Settings,
  RefreshCw,
  Search,
  Filter,
  Check,
  User,
  Wrench,
  Link as LinkIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  getPosVendaMessages,
  markPosVendaMessageSent,
  dismissPosVendaMessage,
  getGoogleReviewUrl,
  updateGoogleReviewUrl,
} from '@/services/pos_venda'
import { PosVendaMessage, PosVendaStatus, PosVendaTipo } from '@/types'
import { getCustomerDisplayName, getCustomerPhone } from '@/services/customers'
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
    const digits = phone.replace(/\D/g, '')
    const fullDigits = digits.startsWith('55') ? digits : '55' + digits
    const newWaLink = `https://wa.me/${fullDigits}?text=${encodeURIComponent(aiGeneratedText)}`

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

  const getTipoBadge = (tipo: PosVendaTipo) => {
    switch (tipo) {
      case 'avaliacao_30min':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[11px] font-bold">
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
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[11px] font-bold">
            ✅ Resumo de Conclusão
          </Badge>
        )
      default:
        return <Badge variant="outline">{tipo}</Badge>
    }
  }

  const getStatusBadge = (status: PosVendaStatus) => {
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

  const filteredMessages = messages.filter((m) => {
    if (statusTab !== 'all' && m.status !== statusTab) return false
    if (!filterText.trim()) return true
    const q = filterText.toLowerCase()
    const cust = m.expand?.customer
    const name = (cust?.razao_social || cust?.nome_fantasia || cust?.name || '').toLowerCase()
    const soNumber = (m.expand?.service_order?.number || '').toLowerCase()
    return (
      name.includes(q) || soNumber.includes(q) || (m.texto_gerado || '').toLowerCase().includes(q)
    )
  })

  const readyCount = messages.filter((m) => m.status === 'ready').length
  const pendingCount = messages.filter((m) => m.status === 'pending').length

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
                  Agente Ativo
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-indigo-200 mt-0.5">
                Automação humanizada de avaliações, pós-venda 7 dias e ofertas 30 dias via WhatsApp
                1-toque.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
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

        {/* Indicadores rápidos de mensagens */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs">
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <span className="text-indigo-200 text-[11px] block">Prontas para Disparo</span>
            <span className="text-xl font-bold font-mono text-emerald-300">{readyCount}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <span className="text-indigo-200 text-[11px] block">Agendadas (Aguardando)</span>
            <span className="text-xl font-bold font-mono text-amber-300">{pendingCount}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <span className="text-indigo-200 text-[11px] block">Horário Comercial</span>
            <span className="text-xs font-semibold text-slate-200 mt-1 block">08:00 às 18:00</span>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <span className="text-indigo-200 text-[11px] block">LGPD / Consentimento</span>
            <span className="text-xs font-semibold text-emerald-300 mt-1 block">
              Respeitado 100%
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <Tabs
          value={statusTab}
          onValueChange={(v) => setStatusTab(v as any)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-4 w-full sm:w-auto h-9 bg-slate-100 p-1">
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

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por cliente, OS ou texto..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      {/* Lista de Mensagens de Pós-Venda */}
      <div className="space-y-3">
        {filteredMessages.length === 0 ? (
          <Card className="border-slate-200 p-8 text-center text-slate-500">
            <p className="text-sm font-semibold">Nenhuma mensagem encontrada neste filtro.</p>
            <p className="text-xs text-slate-400 mt-1">
              As mensagens são agendadas automaticamente pelo Juquinha ao concluir uma Ordem de
              Serviço.
            </p>
          </Card>
        ) : (
          filteredMessages.map((msg) => {
            const cust = msg.expand?.customer
            const so = msg.expand?.service_order
            const custName = getCustomerDisplayName(cust)
            const phone = getCustomerPhone(cust)

            return (
              <Card
                key={msg.id}
                className="border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getTipoBadge(msg.tipo)}
                      {getStatusBadge(msg.status)}
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
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                    {msg.texto_gerado || (
                      <span className="text-slate-400 italic">
                        O texto será gerado no momento do disparo comercial pelo Juquinha.
                      </span>
                    )}
                  </div>

                  {/* Ações Rápidas (1-Toque WhatsApp, Personalizar com IA Juquinha, Descartar) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAiModal(msg)}
                        className="h-9 text-xs font-semibold gap-1.5 border-indigo-200 text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 rounded-lg"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Refinar c/ IA Juquinha</span>
                      </Button>
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
                      className="h-10 px-4 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 rounded-xl"
                    >
                      <Send className="h-4 w-4" />
                      <span>Disparar WhatsApp (1-Toque)</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

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
                Este link é inserido automaticamente nas mensagens de avaliação disparadas 30
                minutos após o término da O.S.
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
