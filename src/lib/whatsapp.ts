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
 * O técnico abre a conversa em 1 toque sem precisar digitar nada.
 */
export function buildOpenOrderWelcomeMessage(
  customerName: string,
  orderNumber: string,
  equipment?: string,
): string {
  return (
    WHATSAPP_HEADER +
    `Olá, ${customerName}! Tudo bem?\n\n` +
    `Aqui é da equipe técnica da *JUCA Informática*. Estamos com a sua Ordem de Serviço *${orderNumber}* aberta em nosso sistema${
      equipment ? ' (' + equipment + ')' : ''
    }.\n\n` +
    `Este é o nosso canal direto para qualquer dúvida ou acompanhamento do seu atendimento!\n\n` +
    `Como podemos te ajudar hoje?` +
    WHATSAPP_FOOTER
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
): string {
  return (
    WHATSAPP_HEADER +
    `Olá ${customerName}! Sua Ordem de Serviço *${orderNumber}* foi *CONCLUÍDA*! 🎉

Muito obrigado pela confiança em nosso serviço! 🙏

Por favor, avalie o atendimento do nosso técnico e o serviço prestado:
${shareUrl}

Gostou do serviço? Deixe também sua avaliação no Google — é rapidinho e ajuda muito:
${GOOGLE_REVIEW_URL}

Qualquer dúvida, estamos à disposição!` +
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
) {
  const link = shareUrl || ''
  const msg = buildCompletionEvaluationMessage(customerName, orderNumber, link)
  openWhatsApp(phone, msg)
}
