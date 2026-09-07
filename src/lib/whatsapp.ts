// Cabeçalho padrão exibido no topo de TODAS as mensagens WhatsApp.
const WHATSAPP_HEADER = '🛠️ *JUCA CARTUCHOS E INFORMÁTICA*\n\n'
// Rodapé padrão com a assinatura da empresa.
const WHATSAPP_FOOTER =
  '\n\nJuca Cartuchos e Informática Ltda\n(67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981'
// Link de avaliação no Google (fixo conforme solicitado).
export const GOOGLE_REVIEW_URL = 'https://g.page/r/CfKb0UxVRFNsEAI/review'

import { normalizePhone, sanitizePhone } from './phones'

export { normalizePhone, sanitizePhone } from './phones'

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = sanitizePhone(phone)
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

/**
 * Mensagem de contato inicial / boas-vindas com o cliente na OS aberta.
 * Inclui o nome do técnico responsável para identificação pessoal.
 * O técnico abre a conversa em 1 toque sem precisar digitar nada.
 */
export function buildOpenOrderWelcomeMessage(
  customerName: string,
  orderNumber: string,
  equipment?: string,
  technicianName?: string,
): string {
  const intro = technicianName?.trim()
    ? `Aqui é o técnico ${technicianName.trim()}, da equipe técnica da *JUCA INFORMÁTICA*.`
    : `Aqui é da equipe técnica da *JUCA INFORMÁTICA*.`

  const equipStr = equipment?.trim() ? ` (${equipment.trim()})` : ''

  return (
    `JUCA INFORMÁTICA\n\n` +
    `Olá, ${customerName}! Tudo bem?\n\n` +
    `${intro} Estamos com a sua Ordem de Serviço *${orderNumber}* aberta em nosso sistema${equipStr}.\n\n` +
    `Este é o nosso canal direto para qualquer dúvida ou acompanhamento do seu atendimento!\n\n` +
    `Juca Informática\n\n` +
    `(67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981`
  )
}

/**
 * Mensagem com o RESUMO COMPLETO da finalização da O.S.:
 * Itens executados, peças aplicadas, descrição do serviço e valor total.
 */
export function buildOrderCompletionSummaryMessage(params: {
  customerName: string
  orderNumber: string
  equipment?: string
  serviceReport?: string
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>
  total: number
  shareUrl: string
}): string {
  const { customerName, orderNumber, equipment, serviceReport, items, total, shareUrl } = params

  const itemsList =
    items.length > 0
      ? items
          .map(
            (it, idx) =>
              `  ${idx + 1}. ${it.description} (${it.quantity}x R$ ${it.unitPrice.toFixed(2)}) = *R$ ${it.total.toFixed(2)}*`,
          )
          .join('\n')
      : '  • Serviço de mão de obra técnica especializada.'

  return (
    WHATSAPP_HEADER +
    `Olá, *${customerName}*! Sua Ordem de Serviço *${orderNumber}* foi *CONCLUÍDA*! 🎉\n\n` +
    (equipment ? `🖥️ *Equipamento:* ${equipment}\n` : '') +
    (serviceReport ? `📝 *Serviço Executado:*\n${serviceReport}\n\n` : '') +
    `📦 *Itens e Serviços Realizados:*\n${itemsList}\n\n` +
    `💰 *Valor Total:* *R$ ${total.toFixed(2)}*\n\n` +
    `Acesse o comprovante digital e assine o recebimento pelo link:\n${shareUrl}\n\n` +
    `Muito obrigado pela confiança em nossa assistência técnica!` +
    WHATSAPP_FOOTER
  )
}

export function openWhatsApp(phone: string, message: string) {
  window.open(buildWhatsAppUrl(phone, message), '_blank')
}

/**
 * Mensagem de ENVIO INICIAL / atualização de status da O.S. (status != "Concluída").
 * Contém apenas o link de compartilhamento/assinatura — SEM avaliação.
 * A avaliação é disparada separadamente por `triggerWhatsAppEvaluation`
 * quando a O.S. muda para "Concluída".
 */
export function buildServiceMessage(
  customerName: string,
  orderNumber: string,
  status: string,
  shareUrl: string,
): string {
  const statusLabels: Record<string, string> = {
    open: 'Aberta',
    in_progress: 'Em Andamento',
    paused: 'Pausada',
    waiting_parts: 'Aguardando Peças',
    completed: 'Concluída',
    closed: 'Fechada',
    cancelled: 'Cancelada',
  }
  const statusText = statusLabels[status] || status
  return (
    WHATSAPP_HEADER +
    `Olá ${customerName}! Tudo bem?

Sua Ordem de Serviço *${orderNumber}* foi atualizada e está com status: *${statusText}*.

Acompanhe os detalhes e assine digitalmente sua OS através do link:
${shareUrl}

Qualquer dúvida, estamos à disposição!` +
    WHATSAPP_FOOTER
  )
}

/**
 * Mensagem enviada APENAS quando a O.S. muda para "Concluída".
 * Segunda mensagem separada, contendo agradecimento + link de avaliação
 * do técnico (shareUrl) + link de avaliação no Google.
 */
export function buildCompletionEvaluationMessage(
  customerName: string,
  orderNumber: string,
  shareUrl: string,
  details?: {
    equipment?: string
    serviceReport?: string
    technicianName?: string
    itemsSummary?: string
  },
): string {
  const firstName = customerName.split(' ')[0] || customerName
  const equipPart = details?.equipment
    ? ` o seu *${details.equipment.trim()}*`
    : ' o seu equipamento'
  const osPart = orderNumber ? ` (O.S. *${orderNumber}*)` : ''
  const techPart = details?.technicianName?.trim()
    ? `cuidado com carinho pelo nosso técnico *${details.technicianName.trim()}*`
    : `cuidado com toda dedicação pela nossa equipe técnica`

  let servicePart = ''
  if (details?.itemsSummary && details?.serviceReport) {
    servicePart = `após ${details.serviceReport.trim()} e itens: ${details.itemsSummary.trim()}`
  } else if (details?.itemsSummary) {
    servicePart = `após serviço realizado com ${details.itemsSummary.trim()}`
  } else if (details?.serviceReport) {
    servicePart = `após ${details.serviceReport.trim()}`
  }

  return (
    WHATSAPP_HEADER +
    `Olá, *${firstName}*! Tudo bem? Aqui é o *Juquinha* da JUCA Informática! 🙋‍♂️\n\n` +
    `Sua Ordem de Serviço *${orderNumber}* foi finalizada com sucesso! 🎉\n\n` +
    `Agradecemos de coração pela confiança em trazer${equipPart}${osPart}, ${techPart}${servicePart ? ' (' + servicePart + ')' : ''}.\n\n` +
    (shareUrl
      ? `Acompanhe os detalhes da OS e o termo de conclusão pelo link:\n${shareUrl}\n\n`
      : '') +
    `A sua avaliação é muito importante para valorizar o trabalho do técnico e ajudar a JUCA a crescer!\n` +
    `Dedique 30 segundinhos para nos avaliar no Google — é rapidinho e ajuda muito: ⭐⭐⭐⭐⭐\n` +
    `${GOOGLE_REVIEW_URL}\n\n` +
    `Qualquer dúvida, estamos sempre à disposição!` +
    WHATSAPP_FOOTER
  )
}

/**
 * Abre o WhatsApp com a mensagem de avaliação de conclusão.
 * Usada quando o status da O.S. muda para "Concluída".
 */
export function triggerWhatsAppEvaluation(
  phone: string,
  customerName: string,
  orderNumber: string,
  shareUrl?: string,
  details?: {
    equipment?: string
    serviceReport?: string
    technicianName?: string
    itemsSummary?: string
  },
) {
  const link = shareUrl || ''
  const msg = buildCompletionEvaluationMessage(customerName, orderNumber, link, details)
  openWhatsApp(phone, msg)
}
