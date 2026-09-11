import pb from '@/lib/pocketbase/client'
import { PosVendaMessage, PosVendaTipo, SystemSetting } from '@/types'
import { getCustomerDisplayName, getCustomerPhone } from '@/services/customers'
import { notifyStaffMembers } from '@/services/notifications'
import { WHATSAPP_FOOTER, WHATSAPP_HEADER } from '@/lib/whatsapp'

export const getPosVendaMessages = async (filterStr = '', sortStr = '-scheduled_at') => {
  return pb.collection('pos_venda_messages').getFullList<PosVendaMessage>({
    filter: filterStr,
    expand: 'customer,service_order,service_order.technician,service_order.equipment_ref',
    sort: sortStr,
  })
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
 * Auxiliar: cria mensagens de avaliação para uma dada mensagem de referência (check-in ou pos_venda_7d).
 * Cria as duas avaliações (avaliacao_tecnico e avaliacao_google) se ainda não existirem para a mesma O.S.
 */
export async function createEvaluationsForOrder(
  refMsg: PosVendaMessage,
  initialStatus: 'pending' | 'ready' = 'pending',
): Promise<{ techMsg?: PosVendaMessage; googleMsg?: PosVendaMessage }> {
  const cust = refMsg.expand?.customer
  const so = refMsg.expand?.service_order
  const custId = refMsg.customer
  const soId = refMsg.service_order

  const custName = getCustomerDisplayName(cust)
  const phone = getCustomerPhone(cust)
  const equip = so?.equipment || ''
  const soNumber = so?.number || ''
  const techName = so?.expand?.technician?.name || ''
  const googleReviewUrl = await getGoogleReviewUrl()

  const nowIso = new Date().toISOString()

  // Verifica se já existem avaliações criadas para esta OS
  let existingTech = null
  let existingGoogle = null
  if (soId) {
    try {
      const existing = await pb.collection('pos_venda_messages').getFullList<PosVendaMessage>({
        filter: `service_order = "${soId}" && (tipo = "avaliacao_tecnico" || tipo = "avaliacao_google")`,
      })
      existingTech = existing.find((m) => m.tipo === 'avaliacao_tecnico')
      existingGoogle = existing.find((m) => m.tipo === 'avaliacao_google')
    } catch {
      /* intentionally ignored */
    }
  }

  let techMsg = existingTech || undefined
  let googleMsg = existingGoogle || undefined

  if (!existingTech) {
    const textTecnico = buildJuquinhaMessageText({
      tipo: 'avaliacao_tecnico',
      customerName: custName,
      equipment: equip,
      orderNumber: soNumber,
      technicianName: techName,
    })
    const waLinkTecnico = buildJuquinhaWaLink(phone, textTecnico)
    techMsg = await createPosVendaMessage({
      customer: custId,
      service_order: soId,
      tipo: 'avaliacao_tecnico',
      status: initialStatus,
      scheduled_at: nowIso,
      texto_gerado: textTecnico,
      wa_me_link: waLinkTecnico,
      channel: 'whatsapp',
    })
  }

  if (!existingGoogle) {
    const textGoogle = buildJuquinhaMessageText({
      tipo: 'avaliacao_google',
      customerName: custName,
      equipment: equip,
      orderNumber: soNumber,
      technicianName: techName,
      googleReviewUrl,
    })
    const waLinkGoogle = buildJuquinhaWaLink(phone, textGoogle)
    googleMsg = await createPosVendaMessage({
      customer: custId,
      service_order: soId,
      tipo: 'avaliacao_google',
      status: initialStatus,
      scheduled_at: nowIso,
      texto_gerado: textGoogle,
      wa_me_link: waLinkGoogle,
      channel: 'whatsapp',
    })
  }

  return { techMsg, googleMsg }
}

/**
 * Promove avaliações existentes de uma OS de 'pending' para 'ready'.
 */
export async function promoteEvaluationsToReady(soId: string): Promise<number> {
  if (!soId) return 0
  try {
    const evals = await pb.collection('pos_venda_messages').getFullList<PosVendaMessage>({
      filter: `service_order = "${soId}" && (tipo = "avaliacao_tecnico" || tipo = "avaliacao_google") && status = "pending"`,
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
 * 2) Garante que as avaliações (avaliacao_tecnico e avaliacao_google) existam e sejam promovidas para 'ready'
 * 3) Dispara notificação para atendentes e admins:
 *    '💬 [Cliente] respondeu — avaliações da OS #X prontas para disparo' com link /pos-venda
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
    // Garante que existam
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
      title: `💬 ${custName} respondeu — avaliações da ${osLabel} prontas para disparo`,
      message: `${custName} respondeu ao contato de pós-venda da ${osLabel}. As mensagens de avaliação do técnico e Google estão prontas para disparo!`,
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
