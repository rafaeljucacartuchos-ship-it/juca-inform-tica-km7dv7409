import pb from '@/lib/pocketbase/client'
import { PosVendaMessage, PosVendaTipo, PosVendaFunilStatus, SystemSetting } from '@/types'
import { getCustomerDisplayName, getCustomerPhone } from '@/services/customers'
import { notifyStaffMembers } from '@/services/notifications'
import {
  WHATSAPP_FOOTER,
  WHATSAPP_HEADER,
  buildAvaliacaoSatisfacaoMessage,
  buildGoogleReviewRequestMessage,
} from '@/lib/whatsapp'

export async function generatePosVendaToken(len = 32): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let res = ''
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(len)
    crypto.getRandomValues(arr)
    for (let i = 0; i < len; i++) {
      res += chars[arr[i] % chars.length]
    }
    return res
  }
  for (let i = 0; i < len; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return res
}

export const getPosVendaMessages = async (filterStr = '', sortStr = '-scheduled_at') => {
  const records = await pb.collection('pos_venda_messages').getFullList<PosVendaMessage>({
    filter: filterStr,
    expand: 'customer,service_order,service_order.technician,service_order.equipment_ref',
    sort: sortStr,
  })

  // Garante que todo card de avaliacao_satisfacao tenha token_acesso e wa_me_link com o link atualizado
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  for (const m of records) {
    if (
      m.tipo === 'avaliacao_satisfacao' &&
      (!m.token_acesso || !m.wa_me_link?.includes('/avaliar/'))
    ) {
      try {
        const token = m.token_acesso || (await generatePosVendaToken(32))
        const evalUrl = origin ? `${origin}/avaliar/${token}` : ''
        const cust = m.expand?.customer
        const so = m.expand?.service_order
        const custName = getCustomerDisplayName(cust)
        const phone = getCustomerPhone(cust)
        const soNumber = so?.number || ''
        const techName = so?.expand?.technician?.name || ''

        const textSatisfacao = buildAvaliacaoSatisfacaoMessage({
          customerName: custName,
          technicianName: techName,
          orderNumber: soNumber,
          evaluationUrl: evalUrl,
        })
        const waLink = buildJuquinhaWaLink(phone, textSatisfacao)

        await pb.collection('pos_venda_messages').update(m.id, {
          token_acesso: token,
          texto_gerado: textSatisfacao,
          wa_me_link: waLink,
        })
        m.token_acesso = token
        m.texto_gerado = textSatisfacao
        m.wa_me_link = waLink
      } catch {
        /* ignore */
      }
    }
  }

  return records
}

export const dismissPosVendaMessage = async (id: string) => {
  return pb.collection('pos_venda_messages').update<PosVendaMessage>(id, {
    status: 'dismissed',
  })
}

export const createPosVendaMessage = async (data: Partial<PosVendaMessage>) => {
  return pb.collection('pos_venda_messages').create<PosVendaMessage>(data)
}

/**
 * Busca mensagens de agradecimento de proposta aprovada pendentes de envio
 * ou prontas (status = 'ready' ou 'pending', canal = 'whatsapp').
 */
export const getPendingOrcamentoAgradecimentoMessages = async () => {
  return pb.collection('pos_venda_messages').getFullList<PosVendaMessage>({
    filter:
      'status = "ready" && channel = "whatsapp" && texto_gerado ~ "Que alegria que a proposta"',
    expand: 'customer,service_order,service_order.technician,service_order.equipment_ref',
    sort: '-created',
  })
}

export const getGoogleReviewUrl = async (): Promise<string> => {
  try {
    const records = await pb.collection('settings').getFullList<SystemSetting>({
      filter: 'key = "google_review_url"',
    })
    if (records.length > 0 && records[0].value) {
      return records[0].value.trim()
    }
  } catch {
    /* fallback */
  }
  return 'https://g.page/r/CfKb0UxVRFNsEAI/review'
}

export const updateGoogleReviewUrl = async (url: string) => {
  try {
    const records = await pb.collection('settings').getFullList<SystemSetting>({
      filter: 'key = "google_review_url"',
    })
    if (records.length > 0) {
      return await pb.collection('settings').update(records[0].id, { value: url })
    } else {
      return await pb.collection('settings').create({
        key: 'google_review_url',
        value: url,
        description: 'Link público para avaliação no Google Meu Negócio',
      })
    }
  } catch {
    /* ignore */
  }
}

/**
 * Gera mensagem humanizada no padrão Juquinha para qualquer tipo de pós-venda.
 */
export function buildJuquinhaMessageText(params: {
  tipo: PosVendaTipo
  customerName: string
  equipment?: string
  orderNumber?: string
  technicianName?: string
  googleReviewUrl?: string
  itemsSummary?: string
  serviceReport?: string
}): string {
  const {
    tipo,
    customerName,
    equipment = '',
    orderNumber = '',
    technicianName = '',
    googleReviewUrl = 'https://g.page/r/CfKb0UxVRFNsEAI/review',
    itemsSummary = '',
    serviceReport = '',
  } = params

  const firstName = customerName.trim().split(' ')[0] || 'Cliente'
  const equipPart = equipment.trim() ? `o seu *${equipment.trim()}*` : 'o seu equipamento'
  const osPart = orderNumber.trim() ? ` (O.S. *${orderNumber.trim()}*)` : ''
  const techMention = technicianName.trim() ? ` e o técnico *${technicianName.trim()}*` : ''

  let body = ''

  switch (tipo) {
    case 'checkin_pos_venda': {
      body =
        `Oi, ${firstName}! Tudo bem com você? Aqui é o *Juquinha* da JUCA Informática! 😄🙋‍♂️\n\n` +
        `Passando rapidinho para bater um papo e saber: como está ${equipPart}${osPart}?\n\n` +
        `Você já teve um tempinho de testar? Está gostando do serviço que fizemos por aqui? Ficou tudo 100% como você esperava?\n\n` +
        `Eu${techMention} ficamos muito felizes em te atender! Se tiver qualquer dúvida, detalhe ou precisar de um ajuste, é só me responder por aqui que estou à sua disposição!`
      break
    }
    case 'avaliacao_satisfacao': {
      // Mensagem unificada de Avaliação de Satisfação (nota 0 a 5 primeiro com link direto)
      return buildAvaliacaoSatisfacaoMessage({
        customerName,
        technicianName,
        orderNumber,
        evaluationUrl:
          typeof window !== 'undefined' ? `${window.location.origin}/avaliar/link` : undefined,
      })
    }
    case 'avaliacao_tecnico': {
      const techLabel = technicianName.trim() ? `*${technicianName.trim()}*` : 'nosso técnico'
      body =
        `Oi, ${firstName}! Que bom falar com você! Aqui é o *Juquinha* da JUCA! ⭐\n\n` +
        `Como você achou o atendimento e a atenção do técnico ${techLabel}${osPart ? ` na sua ${osPart}` : ''}?\n\n` +
        `De 1 a 5 estrelas ⭐, como você avalia o trabalho dele? Se puder responder com uma nota ou uma palavrinha sobre o que achou, ficamos imensamente gratos!`
      break
    }
    case 'avaliacao_google': {
      const gLink = googleReviewUrl.trim()
        ? `\n\n👉 ${googleReviewUrl.trim()}\n\n`
        : '\n\n(Acesse nossa página no Google e deixe seu comentário!)\n\n'
      body =
        `Oi, ${firstName}! *Juquinha* por aqui mais uma vez! 🌐✨\n\n` +
        `A sua opinião no Google é muito importante para nós e ajuda outros clientes a conhecerem a dedicação da nossa equipe.\n\n` +
        `Poderia dedicar 30 segundinhos para deixar uma avaliação 5 estrelas no nosso perfil do Google?` +
        gLink +
        `Muito obrigado pela parceria e carinho de sempre! 🚀`
      break
    }
    case 'avaliacao_30min': {
      body =
        `Oi, ${firstName}! Tudo bem? Aqui é o *Juquinha* da JUCA Informática! 🙋‍♂️\n\n` +
        `Passando para agradecer pela confiança em trazer ${equipPart}${osPart}!\n\n` +
        `A sua opinião é fundamental para nós. Se puder deixar uma avaliação rápida no Google, nos ajuda muito: ⭐⭐⭐⭐⭐\n\n` +
        `👉 ${googleReviewUrl}\n\n` +
        `Muito obrigado de coração!`
      break
    }
    case 'pos_venda_7d': {
      let detailsLine = ''
      if (serviceReport) {
        detailsLine = ` após o serviço de ${serviceReport}`
      } else if (itemsSummary) {
        detailsLine = ` após ${itemsSummary}`
      }
      body =
        `Olá, ${firstName}! Tudo ótimo por aí? Aqui é o *Juquinha* da JUCA Informática novamente! 🛠️👋\n\n` +
        `Já se passou uma semaninha desde que finalizamos ${equipPart}${osPart}${detailsLine}${technicianName ? ` com o nosso técnico *${technicianName}*` : ''}.\n\n` +
        `Como tem sido o uso no dia a dia? O equipamento está respondendo direitinho, rápido e sem nenhum problema?\n\n` +
        `Conta para mim! Se precisar de qualquer suporte complementar ou orientação, nós estamos por aqui para te dar total apoio!`
      break
    }
    case 'oferta_30d': {
      body =
        `Oi, ${firstName}! Como você está? Aqui é o *Juquinha* da JUCA Informática passando para te dar um alô! ✨😊\n\n` +
        `Já faz 1 mês que cuidamos de ${equipPart}${osPart} e esperamos que tudo continue funcionando perfeitamente por aí!\n\n` +
        `Você já sabe: manutenção preventiva e cuidado contínuo evitam surpresas e mantêm seu trabalho sempre fluindo.\n\n` +
        `Se estiver precisando de recarga de cartuchos, toners, cabos, SSD/memória ou um check-up com descontos especiais de cliente parceiro, me dá um toque aqui no WhatsApp!\n\n` +
        (technicianName
          ? `O técnico *${technicianName}* e toda a nossa família JUCA mandam aquele abraço forte!`
          : `Toda a nossa equipe da JUCA manda aquele abraço forte!`)
      break
    }
    default: {
      body =
        `Oi, ${firstName}! Tudo bem? Aqui é o *Juquinha* da JUCA Informática! 😄\n\n` +
        `Passando para saber se está tudo bem com ${equipPart}${osPart}. Qualquer dúvida ou suporte, estamos sempre à disposição!`
      break
    }
  }

  return `${WHATSAPP_HEADER}${body}${WHATSAPP_FOOTER}`
}

/**
 * Cria a URL do WhatsApp a partir de um telefone e texto formatado.
 */
export function buildJuquinhaWaLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  const fullDigits = digits.startsWith('55')
    ? digits
    : digits.startsWith('0')
      ? '55' + digits.substring(1)
      : '55' + digits
  return `https://wa.me/${fullDigits}?text=${encodeURIComponent(text)}`
}

/**
 * Auxiliar: cria a mensagem UNIFICADA de Avaliação de Satisfação (nota 0 a 5)
 * para a mesma O.S. se ainda não existir.
 * Se já existirem registros legados (avaliacao_tecnico / avaliacao_google), não quebra.
 */
export async function createEvaluationsForOrder(
  refMsg: PosVendaMessage,
  initialStatus: 'pending' | 'ready' = 'pending',
): Promise<{
  satisfacaoMsg?: PosVendaMessage
  techMsg?: PosVendaMessage
  googleMsg?: PosVendaMessage
}> {
  const cust = refMsg.expand?.customer
  const so = refMsg.expand?.service_order
  const custId = refMsg.customer
  const soId = refMsg.service_order

  const custName = getCustomerDisplayName(cust)
  const phone = getCustomerPhone(cust)
  const soNumber = so?.number || ''
  const techName = so?.expand?.technician?.name || ''

  const nowIso = new Date().toISOString()

  // Verifica se já existem avaliações criadas para esta OS
  let existingSatisfacao: PosVendaMessage | undefined
  let existingTech: PosVendaMessage | undefined
  let existingGoogle: PosVendaMessage | undefined

  if (soId) {
    try {
      const existing = await pb.collection('pos_venda_messages').getFullList<PosVendaMessage>({
        filter: `service_order = "${soId}" && (tipo = "avaliacao_satisfacao" || tipo = "avaliacao_tecnico" || tipo = "avaliacao_google")`,
      })
      existingSatisfacao = existing.find((m) => m.tipo === 'avaliacao_satisfacao')
      existingTech = existing.find((m) => m.tipo === 'avaliacao_tecnico')
      existingGoogle = existing.find((m) => m.tipo === 'avaliacao_google')
    } catch {
      /* intentionally ignored */
    }
  }

  // Se já existe o unificado, retorna
  if (existingSatisfacao) {
    return { satisfacaoMsg: existingSatisfacao, techMsg: existingTech, googleMsg: existingGoogle }
  }

  // Se NÃO existe o unificado, cria o CARD UNIFICADO
  // Gera token opaco e seguro para o link público da O.S.
  const token = await generatePosVendaToken(32)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const evalUrl = origin ? `${origin}/avaliar/${token}` : ''

  const textSatisfacao = buildAvaliacaoSatisfacaoMessage({
    customerName: custName,
    technicianName: techName,
    orderNumber: soNumber,
    evaluationUrl: evalUrl,
  })
  const waLink = buildJuquinhaWaLink(phone, textSatisfacao)

  const satisfacaoMsg = await createPosVendaMessage({
    customer: custId,
    service_order: soId,
    tipo: 'avaliacao_satisfacao',
    status: initialStatus,
    status_funil: 'aguardando_nota',
    scheduled_at: nowIso,
    texto_gerado: textSatisfacao,
    wa_me_link: waLink,
    channel: 'whatsapp',
    token_acesso: token,
  })

  // Desativa legados pendentes para não duplicarem cards
  if (existingTech && existingTech.status === 'pending') {
    try {
      await pb.collection('pos_venda_messages').update(existingTech.id, {
        status: 'dismissed',
        feedback_cliente: 'Substituído por card unificado de satisfação (0-5)',
      })
    } catch {
      /* ignore */
    }
  }
  if (existingGoogle && existingGoogle.status === 'pending') {
    try {
      await pb.collection('pos_venda_messages').update(existingGoogle.id, {
        status: 'dismissed',
        feedback_cliente: 'Substituído por card unificado de satisfação (0-5)',
      })
    } catch {
      /* ignore */
    }
  }

  return { satisfacaoMsg }
}

/**
 * Promove avaliações existentes de uma OS de 'pending' para 'ready'.
 */
export async function promoteEvaluationsToReady(soId: string): Promise<number> {
  if (!soId) return 0
  try {
    const evals = await pb.collection('pos_venda_messages').getFullList<PosVendaMessage>({
      filter: `service_order = "${soId}" && (tipo = "avaliacao_satisfacao" || tipo = "avaliacao_tecnico" || tipo = "avaliacao_google") && status = "pending"`,
    })
    for (const ev of evals) {
      await pb.collection('pos_venda_messages').update(ev.id, {
        status: 'ready',
      })
    }
    return evals.length
  } catch (err) {
    console.warn('Erro ao promover avaliações para ready:', err)
    return 0
  }
}

/**
 * REGISTRAR NOTA DO CLIENTE NO FUNIL DE AVALIAÇÃO (0 a 5):
 * - Nota 4 ou 5:
 *   Funil avança para 'google_sugerido'. Mensagem do Google é disponibilizada com link e 1-toque WhatsApp.
 *   Salva na coleção de avaliações (evaluations) com satisfação 'excelente' (5) ou 'bom' (4).
 * - Nota 0 a 3:
 *   Funil vira 'critica_contato_pendente'. Alerta interno destacado para contato imediato do Rafael.
 *   Salva na coleção de avaliações (evaluations) com satisfação 'pode_melhorar' (2-3) ou 'nao_gostei' (0-1).
 *   Cria notificação para administradores e atendentes alertando sobre a crítica pendente.
 */
export async function registrarNotaAvaliacao(params: {
  messageId: string
  serviceOrderId?: string
  technicianId?: string
  nota: number
  feedback?: string
  customerName?: string
  orderNumber?: string
}): Promise<PosVendaMessage> {
  const {
    messageId,
    serviceOrderId,
    technicianId,
    nota,
    feedback = '',
    customerName = 'Cliente',
    orderNumber = '',
  } = params

  const isSatisfied = nota >= 4
  const statusFunil: PosVendaFunilStatus = isSatisfied
    ? 'google_sugerido'
    : 'critica_contato_pendente'

  // 1) Atualiza a mensagem de pós-venda
  const updated = await pb.collection('pos_venda_messages').update<PosVendaMessage>(messageId, {
    nota_avaliacao: nota,
    status_funil: statusFunil,
    cliente_respondeu: true,
    cliente_respondeu_em: new Date().toISOString(),
    feedback_cliente: feedback,
  })

  // 2) Alimenta a coleção 'evaluations' para refletir no Relatório de Avaliações existente
  if (serviceOrderId) {
    try {
      // Mapear nota para o enum satisfaction existente
      let satisfaction: 'nao_gostei' | 'bom' | 'excelente' | 'pode_melhorar' = 'excelente'
      if (nota >= 5) satisfaction = 'excelente'
      else if (nota === 4) satisfaction = 'bom'
      else if (nota >= 2) satisfaction = 'pode_melhorar'
      else satisfaction = 'nao_gostei'

      // Se já houver avaliação registrada para a O.S., atualiza; senão cria nova
      const existingEvals = await pb.collection('evaluations').getFullList({
        filter: `service_order = "${serviceOrderId}"`,
      })

      if (existingEvals.length > 0) {
        await pb.collection('evaluations').update(existingEvals[0].id, {
          rating: Math.max(1, Math.min(5, nota === 0 ? 1 : nota)), // evaluations rating é 1-5 na média
          satisfaction,
          feedback:
            feedback || (nota <= 3 ? `Avaliação pós-venda: Nota ${nota}/5 registrada.` : ''),
          technician: technicianId || existingEvals[0].technician,
        })
      } else {
        await pb.collection('evaluations').create({
          service_order: serviceOrderId,
          technician: technicianId || null,
          rating: Math.max(1, Math.min(5, nota === 0 ? 1 : nota)),
          satisfaction,
          feedback:
            feedback || (nota <= 3 ? `Avaliação pós-venda: Nota ${nota}/5 registrada.` : ''),
        })
      }
    } catch (evalErr) {
      console.warn('Erro ao registrar avaliação na coleção evaluations:', evalErr)
    }
  }

  // 3) Se for crítica (nota 0-3), cria alerta interno para a equipe (Rafael) ligar para o cliente
  if (!isSatisfied) {
    try {
      const osLabel = orderNumber ? `OS #${orderNumber}` : 'O.S.'
      await notifyStaffMembers({
        title: `⚠️ Crítica de Pós-venda: Nota ${nota} na ${osLabel}`,
        message: `${customerName} avaliou com nota ${nota}/5 na ${osLabel}. Contato imediato recomendado para entender e solucionar antes de avaliação pública.`,
        type: 'service_order',
        link: '/pos-venda',
      })
    } catch (notifErr) {
      console.warn('Erro ao notificar crítica de pós-venda:', notifErr)
    }
  }

  return updated
}

/**
 * Marca a etapa do Google como enviada (disparada)
 */
export async function marcarGoogleEnviado(messageId: string): Promise<PosVendaMessage> {
  return pb.collection('pos_venda_messages').update<PosVendaMessage>(messageId, {
    status_funil: 'google_enviado',
  })
}

/**
 * Marca a crítica como resolvida / tratada
 */
export async function marcarCriticaResolvida(messageId: string): Promise<PosVendaMessage> {
  return pb.collection('pos_venda_messages').update<PosVendaMessage>(messageId, {
    status_funil: 'resolvido',
  })
}

/**
 * CADEIA AUTOMÁTICA AO DISPARAR MENSAGEM (1-Toque WhatsApp):
 * 1) Marca a mensagem como status='sent' e sent_at=agora
 * 2) Se for tipo 'pos_venda_7d':
 *    Cria automaticamente as 2 mensagens de avaliação (avaliacao_tecnico e avaliacao_google)
 *    com status 'pending' (aguardando resposta do cliente).
 *    Se o check-in ou 7d já estiver marcado como cliente_respondeu=true, cria como 'ready'!
 */
export const markPosVendaMessageSent = async (
  id: string,
  fullMsg?: PosVendaMessage,
): Promise<PosVendaMessage> => {
  const nowIso = new Date().toISOString()
  const updated = await pb.collection('pos_venda_messages').update<PosVendaMessage>(id, {
    status: 'sent',
    sent_at: nowIso,
  })

  // Se a mensagem for pos_venda_7d, dispara a cadeia automática
  const msgToCheck = fullMsg || updated
  if (msgToCheck.tipo === 'pos_venda_7d') {
    try {
      const soId = msgToCheck.service_order
      // Verifica se houve resposta prévia do cliente nesta OS
      let alreadyResponded = !!msgToCheck.cliente_respondeu
      if (!alreadyResponded && soId) {
        try {
          const sisterCheckin = await pb
            .collection('pos_venda_messages')
            .getFullList<PosVendaMessage>({
              filter: `service_order = "${soId}" && tipo = "checkin_pos_venda" && cliente_respondeu = true`,
            })
          if (sisterCheckin.length > 0) alreadyResponded = true
        } catch {
          /* intentionally ignored */
        }
      }

      await createEvaluationsForOrder(msgToCheck, alreadyResponded ? 'ready' : 'pending')
    } catch (chainErr) {
      console.warn('Erro na cadeia automática ao enviar 7d:', chainErr)
    }
  }

  return updated
}

/**
 * CADEIA AUTOMÁTICA AO MARCAR 'CLIENTE RESPONDEU':
 * Quando o check-in OU a mensagem de 7 dias for marcada como 'Cliente respondeu':
 * 1) Atualiza a mensagem com cliente_respondeu=true, cliente_respondeu_em=agora, avaliacoes_liberadas=true
 * 2) Garante que a avaliação unificada (avaliacao_satisfacao) exista e seja promovida para 'ready'
 * 3) Dispara notificação para atendentes e admins:
 *    '💬 [Cliente] respondeu — avaliação da OS #X pronta para disparo' com link /pos-venda
 */
export const markPosVendaMessageResponded = async (
  id: string,
  responded = true,
  refMsg?: PosVendaMessage,
) => {
  const nowIso = new Date().toISOString()

  // 1) Atualiza o registro
  const updated = await pb.collection('pos_venda_messages').update<PosVendaMessage>(id, {
    cliente_respondeu: responded,
    cliente_respondeu_em: responded ? nowIso : null,
    avaliacoes_liberadas: responded ? true : undefined,
  })

  if (!responded) {
    return updated
  }

  const msg = refMsg || updated
  const cust = msg.expand?.customer
  const custName = getCustomerDisplayName(cust)
  const so = msg.expand?.service_order
  const soId = msg.service_order
  const soNumber = so?.number || ''
  const osLabel = soNumber ? `OS #${soNumber}` : 'O.S.'

  // 2) Cria (se não existirem) e promove as avaliações para 'ready'
  try {
    // Garante que existam (e substitui legados pendentes se houver)
    await createEvaluationsForOrder(msg, 'ready')
    // Promove quaisquer que estivessem pending
    if (soId) {
      await promoteEvaluationsToReady(soId)
    }
  } catch (evalErr) {
    console.warn('Erro ao promover/criar avaliações na resposta:', evalErr)
  }

  // 3) Notificação para atendentes e admin
  try {
    await notifyStaffMembers({
      title: `💬 ${custName} respondeu — avaliação da ${osLabel} pronta para disparo`,
      message: `${custName} respondeu ao contato de pós-venda da ${osLabel}. A avaliação de satisfação está pronta para disparo!`,
      type: 'service_order',
      link: '/pos-venda',
    })
  } catch (notifErr) {
    console.warn('Erro ao notificar equipe da resposta do cliente:', notifErr)
  }

  return updated
}

/**
 * ETAPA 2 — LIBERAR AVALIAÇÕES MANUALMENTE (fallback / ação explícita):
 */
export async function releaseJuquinhaEvaluations(msg: PosVendaMessage): Promise<{
  satisfacaoMsg?: PosVendaMessage
  techMsg?: PosVendaMessage
  googleMsg?: PosVendaMessage
}> {
  const result = await createEvaluationsForOrder(msg, 'ready')

  if (msg.service_order) {
    await promoteEvaluationsToReady(msg.service_order)
  }

  // Marca a mensagem de referência
  try {
    const nowIso = new Date().toISOString()
    await pb.collection('pos_venda_messages').update(msg.id, {
      avaliacoes_liberadas: true,
      cliente_respondeu: true,
      cliente_respondeu_em: msg.cliente_respondeu_em || nowIso,
    })
  } catch (err) {
    console.warn('Não foi possível marcar avaliacoes_liberadas:', err)
  }

  return result
}

/**
 * CONVERSÃO / MIGRAÇÃO AUTOMÁTICA DOS PARES LEGADOS DE AVALIAÇÃO:
 * Substitui os pares legados de avaliação (avaliacao_tecnico + avaliacao_google)
 * ainda pendentes por um único card unificado de satisfação 0-5 (avaliacao_satisfacao).
 * - Pares/mensagens que já foram disparados (status != 'pending') ficam intocados como histórico.
 * - Os registros legados pendentes são desativados com status 'dismissed' (exclusão lógica).
 * - O novo card unificado herda scheduled_at, cliente, O.S., telefone e texto gerado oficial.
 * - Retorna a quantidade de O.S. que foram unificadas.
 */
export async function unificarAvaliacoesLegadasPendentes(): Promise<{
  convertedOrdersCount: number
  convertedOrders: string[]
}> {
  try {
    // 1) Busca todas as mensagens de avaliação com expand
    const allEvalMessages = await pb.collection('pos_venda_messages').getFullList<PosVendaMessage>({
      filter:
        'tipo = "avaliacao_satisfacao" || tipo = "avaliacao_tecnico" || tipo = "avaliacao_google"',
      expand: 'customer,service_order,service_order.technician,service_order.equipment_ref',
      sort: 'created',
    })

    // 2) Agrupa por O.S. (service_order)
    const byOrder = new Map<string, PosVendaMessage[]>()
    for (const msg of allEvalMessages) {
      if (!msg.service_order) continue
      const list = byOrder.get(msg.service_order) || []
      list.push(msg)
      byOrder.set(msg.service_order, list)
    }

    const convertedOrders: string[] = []
    const nowIso = new Date().toISOString()

    for (const [soId, msgs] of byOrder.entries()) {
      // Já tem card unificado de satisfação?
      const hasSatisfacao = msgs.some((m) => m.tipo === 'avaliacao_satisfacao')
      if (hasSatisfacao) {
        continue
      }

      // Encontra legados pendentes dessa OS
      const pendingLegacy = msgs.filter(
        (m) =>
          (m.tipo === 'avaliacao_tecnico' || m.tipo === 'avaliacao_google') &&
          m.status === 'pending',
      )

      // Se não tem nenhum legado pendente, não há o que unificar nesta OS
      if (pendingLegacy.length === 0) {
        continue
      }

      // Referência para montar a nova mensagem unificada
      const refMsg = pendingLegacy[0]
      const cust = refMsg.expand?.customer
      const so = refMsg.expand?.service_order
      const custId = refMsg.customer
      const custName = getCustomerDisplayName(cust)
      const phone = getCustomerPhone(cust)
      const soNumber = so?.number || ''
      const techName = so?.expand?.technician?.name || ''

      const token = await generatePosVendaToken(32)
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const evalUrl = origin ? `${origin}/avaliar/${token}` : ''

      const textSatisfacao = buildAvaliacaoSatisfacaoMessage({
        customerName: custName,
        technicianName: techName,
        orderNumber: soNumber,
        evaluationUrl: evalUrl,
      })
      const waLink = buildJuquinhaWaLink(phone, textSatisfacao)

      // Se a OS já teve cliente_respondeu=true ou avaliacoes_liberadas em alguma mensagem,
      // o status inicial pode ser 'ready'; caso contrário 'pending'
      const isAlreadyResponded = msgs.some((m) => m.cliente_respondeu || m.avaliacoes_liberadas)

      // Cria a mensagem unificada
      await createPosVendaMessage({
        customer: custId,
        service_order: soId,
        tipo: 'avaliacao_satisfacao',
        status: isAlreadyResponded ? 'ready' : 'pending',
        status_funil: 'aguardando_nota',
        scheduled_at: refMsg.scheduled_at || nowIso,
        texto_gerado: textSatisfacao,
        wa_me_link: waLink,
        channel: 'whatsapp',
        token_acesso: token,
      })

      // Desativa os registros legados pendentes (exclusão lógica via dismissed)
      for (const leg of pendingLegacy) {
        try {
          await pb.collection('pos_venda_messages').update(leg.id, {
            status: 'dismissed',
            feedback_cliente: 'Substituído por card unificado de satisfação (0-5)',
          })
        } catch (upErr) {
          console.warn(`Erro ao descartar mensagem legada ${leg.id}:`, upErr)
        }
      }

      convertedOrders.push(soNumber ? `OS #${soNumber}` : soId)
    }

    return {
      convertedOrdersCount: convertedOrders.length,
      convertedOrders,
    }
  } catch (err) {
    console.error('Erro na unificação de avaliações legadas:', err)
    return { convertedOrdersCount: 0, convertedOrders: [] }
  }
}
