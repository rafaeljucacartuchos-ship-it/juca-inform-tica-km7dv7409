import pb from '@/lib/pocketbase/client'
import { PosVendaMessage, PosVendaTipo, SystemSetting } from '@/types'
import { getCustomerDisplayName, getCustomerPhone } from '@/services/customers'
import { WHATSAPP_FOOTER, WHATSAPP_HEADER } from '@/lib/whatsapp'

export const getPosVendaMessages = async (filterStr = '', sortStr = '-scheduled_at') => {
  return pb.collection('pos_venda_messages').getFullList<PosVendaMessage>({
    filter: filterStr,
    expand: 'customer,service_order,service_order.technician,service_order.equipment_ref',
    sort: sortStr,
  })
}

export const markPosVendaMessageSent = async (id: string) => {
  return pb.collection('pos_venda_messages').update<PosVendaMessage>(id, {
    status: 'sent',
    sent_at: new Date().toISOString(),
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
 * ETAPA 2 — LIBERAR AVALIAÇÕES APÓS RESPOSTA DO CLIENTE:
 * Quando o cliente responde ao check-in de atendimento, cria automaticamente
 * as DUAS mensagens de follow-up SEPARADAS:
 * 1) 'avaliacao_tecnico' (⭐)
 * 2) 'avaliacao_google' (🌐)
 * Ambas criadas com status 'ready' para disparo manual rápido (1 toque WhatsApp).
 */
export async function releaseJuquinhaEvaluations(checkinMsg: PosVendaMessage): Promise<{
  techMsg: PosVendaMessage
  googleMsg: PosVendaMessage
}> {
  const cust = checkinMsg.expand?.customer
  const so = checkinMsg.expand?.service_order
  const custId = checkinMsg.customer
  const soId = checkinMsg.service_order

  const custName = getCustomerDisplayName(cust)
  const phone = getCustomerPhone(cust)
  const equip = so?.equipment || ''
  const soNumber = so?.number || ''
  const techName = so?.expand?.technician?.name || ''
  const googleReviewUrl = await getGoogleReviewUrl()

  const nowIso = new Date().toISOString()

  // 1) Mensagem para avaliação do técnico
  const textTecnico = buildJuquinhaMessageText({
    tipo: 'avaliacao_tecnico',
    customerName: custName,
    equipment: equip,
    orderNumber: soNumber,
    technicianName: techName,
  })
  const waLinkTecnico = buildJuquinhaWaLink(phone, textTecnico)

  const techMsg = await createPosVendaMessage({
    customer: custId,
    service_order: soId,
    tipo: 'avaliacao_tecnico',
    status: 'ready',
    scheduled_at: nowIso,
    texto_gerado: textTecnico,
    wa_me_link: waLinkTecnico,
    channel: 'whatsapp',
  })

  // 2) Mensagem separada para avaliação no Google
  const textGoogle = buildJuquinhaMessageText({
    tipo: 'avaliacao_google',
    customerName: custName,
    equipment: equip,
    orderNumber: soNumber,
    technicianName: techName,
    googleReviewUrl,
  })
  const waLinkGoogle = buildJuquinhaWaLink(phone, textGoogle)

  const googleMsg = await createPosVendaMessage({
    customer: custId,
    service_order: soId,
    tipo: 'avaliacao_google',
    status: 'ready',
    scheduled_at: nowIso,
    texto_gerado: textGoogle,
    wa_me_link: waLinkGoogle,
    channel: 'whatsapp',
  })

  return { techMsg, googleMsg }
}
