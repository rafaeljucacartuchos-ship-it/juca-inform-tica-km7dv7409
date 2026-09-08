import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MessageCircle,
  X,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Clock,
  Phone,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getPendingOrcamentoAgradecimentoMessages,
  markPosVendaMessageSent,
  dismissPosVendaMessage,
} from '@/services/pos_venda'
import { PosVendaMessage } from '@/types'
import { openWhatsApp } from '@/lib/whatsapp'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'

/**
 * AgradecimentoAprovadoBanner
 *
 * Automatização do envio da mensagem de agradecimento ao cliente após aprovação do orçamento:
 *
 * TRANSPARÊNCIA TÉCNICA (LIMITAÇÃO DE NAVEGADORES):
 * Navegadores web modernos bloqueiam a abertura de popups / URLs externas (window.open wa.me)
 * que não tenham sido disparadas diretamente por um gesto do usuário (clique / toque).
 * Sem contratar e integrar uma API/gateway não-oficial pago (Evolution API, Z-API, Baileys),
 * o wa.me NÃO permite envio 100% invisível sem nenhuma janela aberta.
 *
 * Estratégia implementada para máxima automação possível:
 * 1. No momento da aprovação do orçamento em tempo real, o app TENTA abrir a janela do WhatsApp
 *    automaticamente via `openWhatsApp`.
 * 2. Se o navegador bloquear o popup (o que é padrão na maioria dos browsers sem gesto imediato),
 *    o sistema apresenta este BANNER DESTACADO no topo do sistema:
 *    "🎉 Cliente aprovou! Mensagem de agradecimento pronta — TOQUE PARA ENVIAR".
 * 3. Num ÚNICO TOQUE, o WhatsApp é aberto com a mensagem já pré-montada (número do cliente +
 *    texto alegre do Juquinha agradecendo a confiança).
 * 4. Ao disparar, o registro correspondente em `pos_venda_messages` é atualizado para `status: 'sent'`,
 *    garantindo idempotência e histórico para o cliente.
 * 5. Se o técnico fechar e reabrir o app mais tarde, as mensagens que ainda não foram enviadas
 *    continuam no banner aguardando o envio.
 */
export function AgradecimentoAprovadoBanner() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<PosVendaMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  // Guarda IDs para os quais já tentamos o auto-open nesta sessão
  const attemptedAutoOpenRef = useRef<Set<string>>(new Set())

  const loadPendingMessages = useCallback(async () => {
    if (!user) return
    try {
      const list = await getPendingOrcamentoAgradecimentoMessages()
      setMessages(list)

      // Para cada mensagem recebida, se ainda não tentamos o auto-open, tenta abrir
      list.forEach((msg) => {
        if (!attemptedAutoOpenRef.current.has(msg.id)) {
          attemptedAutoOpenRef.current.add(msg.id)
          triggerAutoOpen(msg)
        }
      })
    } catch {
      /* ignore */
    }
  }, [user])

  // Tenta abrir o WhatsApp automaticamente
  const triggerAutoOpen = async (msg: PosVendaMessage) => {
    const phone = msg.expand?.customer?.celular || msg.expand?.customer?.phone || ''
    const text = msg.texto_gerado || ''

    if (!phone || !text) return

    // Tenta abrir janela sem gesto direto
    const opened = openWhatsApp(phone, text)

    if (opened) {
      // Se o navegador aceitou o popup, marca como enviado imediatamente!
      try {
        await markPosVendaMessageSent(msg.id)
        toast.success('WhatsApp aberto automaticamente!', {
          description: `Mensagem de agradecimento enviada para ${msg.expand?.customer?.name || 'o cliente'}.`,
        })
        setMessages((prev) => prev.filter((m) => m.id !== msg.id))
      } catch {
        /* ignore */
      }
    } else {
      // Navegador bloqueou o popup sem interação — exibe aviso toast convidando ao 1 toque
      toast.info('🎉 Proposta aprovada pelo cliente!', {
        description: 'Toque no banner destacado no topo para disparar o WhatsApp de agradecimento.',
        duration: 8000,
      })
    }
  }

  useEffect(() => {
    loadPendingMessages()
  }, [loadPendingMessages])

  // Escuta novas mensagens na coleção pos_venda_messages em tempo real
  useRealtime(
    'pos_venda_messages',
    (e) => {
      if (!user) return
      if (e.action === 'create' || e.action === 'update' || e.action === 'delete') {
        loadPendingMessages()
      }
    },
    !!user,
  )

  // Escuta aprovação de orçamentos para recarregar com prioridade máxima
  useRealtime(
    'orcamentos',
    (e) => {
      if (!user) return
      if (e.record && e.record.status === 'aprovado') {
        // Pequeno atraso para garantir que o hook do PocketBase já gravou a mensagem em pos_venda_messages
        setTimeout(() => {
          loadPendingMessages()
        }, 800)
      }
    },
    !!user,
  )

  const handleSendNow = async (msg: PosVendaMessage) => {
    setSendingId(msg.id)
    try {
      const phone = msg.expand?.customer?.celular || msg.expand?.customer?.phone || ''
      const text = msg.texto_gerado || ''

      // Abertura com gesto do usuário — garantido pelo clique do botão!
      if (phone && text) {
        openWhatsApp(phone, text)
      } else if (msg.wa_me_link) {
        window.open(msg.wa_me_link, '_blank', 'noopener,noreferrer')
      }

      // Marca como enviado no banco
      await markPosVendaMessageSent(msg.id)

      toast.success('Mensagem de agradecimento disparada!', {
        description: 'WhatsApp aberto e histórico do cliente atualizado.',
      })

      setMessages((prev) => prev.filter((m) => m.id !== msg.id))
    } catch (err: any) {
      toast.error('Erro ao registrar envio', {
        description: err?.message || 'Tente novamente.',
      })
    } finally {
      setSendingId(null)
    }
  }

  const handleDismiss = async (msgId: string) => {
    try {
      await dismissPosVendaMessage(msgId)
      setMessages((prev) => prev.filter((m) => m.id !== msgId))
      toast('Mensagem dispensada.')
    } catch {
      /* ignore */
    }
  }

  if (messages.length === 0) return null

  return (
    <div className="w-full space-y-2 px-3 sm:px-6 pt-3 pb-1">
      {messages.map((msg) => {
        const custName =
          msg.expand?.customer?.nome_fantasia ||
          msg.expand?.customer?.razao_social ||
          msg.expand?.customer?.name ||
          'Cliente'
        const phone = msg.expand?.customer?.celular || msg.expand?.customer?.phone || ''
        const osNumber = msg.expand?.service_order?.number || ''
        const isSending = sendingId === msg.id

        return (
          <div
            key={msg.id}
            className="relative overflow-hidden rounded-xl border border-emerald-400/80 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-3.5 sm:p-4 text-white shadow-lg shadow-emerald-900/15 animate-in fade-in slide-in-from-top-3 duration-300"
          >
            {/* Efeito sutil de brilho de fundo */}
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/30 text-white shadow-inner">
                  <Sparkles className="h-5 w-5 text-amber-200 animate-pulse" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
                      🎉 Cliente aprovou a proposta!
                    </span>
                    <Badge className="bg-amber-400 text-amber-950 font-bold border-0 text-[10px] px-2 py-0.5 shadow-2xs">
                      Agradecimento Pronto
                    </Badge>
                  </div>

                  <p className="text-xs sm:text-sm text-emerald-50 mt-0.5 line-clamp-1">
                    <strong className="text-white font-semibold">{custName}</strong>
                    {phone && (
                      <span className="opacity-90 ml-1.5 font-mono text-[11px] bg-white/15 px-1.5 py-0.5 rounded">
                        {phone}
                      </span>
                    )}
                    {osNumber && (
                      <span className="opacity-90 ml-1.5 text-emerald-100">• O.S. #{osNumber}</span>
                    )}
                  </p>

                  <p className="text-[11px] text-emerald-100/90 mt-1 flex items-center gap-1">
                    <MessageCircle className="h-3 w-3 text-emerald-200 shrink-0" />
                    <span>
                      Mensagem humanizada do Juquinha pronta. Toque no botão ao lado para enviar em
                      1 toque!
                    </span>
                  </p>
                </div>
              </div>

              {/* Ações: Enviar em 1 Toque + Dispensar */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/15">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSendNow(msg)}
                  disabled={isSending}
                  className="flex-1 sm:flex-none h-11 sm:h-10 px-4 text-xs sm:text-sm font-bold bg-white text-emerald-900 hover:bg-emerald-50 hover:text-emerald-950 shadow-md gap-2 rounded-lg transition-transform active:scale-95 border border-white"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{isSending ? 'Abrindo WhatsApp...' : 'TOQUE PARA ENVIAR'}</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDismiss(msg.id)}
                  title="Dispensar aviso"
                  className="h-10 w-10 text-white/80 hover:text-white hover:bg-white/20 rounded-lg shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
