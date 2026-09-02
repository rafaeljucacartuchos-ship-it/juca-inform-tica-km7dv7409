// Cabeçalho padrão exibido no topo de TODAS as mensagens WhatsApp.
const WHATSAPP_HEADER = '🛠️ *JUCA CARTUCHOS E INFORMÁTICA*\n\n'
// Rodapé padrão com a assinatura da empresa.
const WHATSAPP_FOOTER =
  '\n\nJuca Cartuchos e Informática Ltda\n(67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981'
// Link de avaliação no Google (fixo conforme solicitado).
export const GOOGLE_REVIEW_URL = 'https://g.page/r/CfKb0UxVRFNsEAI/review'

export function sanitizePhone(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  // Se tiver 10 ou 11 dígitos (DDD + número brasileiro sem DDI 55), adiciona o prefixo 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }
  // Se começar com 0 (ex: 067999999999), remove o 0 inicial e se tiver 10 ou 11 adiciona 55
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    const withoutZero = digits.substring(1)
    if (withoutZero.length === 10 || withoutZero.length === 11) {
      return `55${withoutZero}`
    }
  }
  return digits
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = sanitizePhone(phone)
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
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
