export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = sanitizePhone(phone)
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export function openWhatsApp(phone: string, message: string) {
  window.open(buildWhatsAppUrl(phone, message), '_blank')
}

export function buildServiceMessage(
  customerName: string,
  orderNumber: string,
  status: string,
  shareUrl: string,
): string {
  const statusLabels: Record<string, string> = {
    open: 'Aberta',
    in_progress: 'Em Andamento',
    waiting_parts: 'Aguardando Peças',
    completed: 'Concluída',
    closed: 'Fechada',
    cancelled: 'Cancelada',
  }
  const statusText = statusLabels[status] || status
  return `Olá ${customerName}! Tudo bem?

Sua Ordem de Serviço *${orderNumber}* foi atualizada e está com status: *${statusText}*.

Acompanhe os detalhes e assine digitalmente sua OS através do link:
${shareUrl}

Qualquer dúvida, estamos à disposição!

Juca Cartuchos e Informática Ltda
(67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981`
}

export function triggerWhatsAppEvaluation(
  phone: string,
  customerName: string,
  orderNumber: string,
  shareUrl?: string,
) {
  const googleReviewUrl = 'https://g.page/r/CfKb0UxVRFNsEAI/review'
  const linkText = shareUrl ? `\n\nAcesse sua OS e faça sua avaliação: ${shareUrl}` : ''
  const techEval = `Olá ${customerName}! Sua Ordem de Serviço ${orderNumber} foi concluída. Por favor, avalie o atendimento do nosso técnico e o serviço prestado.${linkText}\n\nVocê também pode nos avaliar no Google: ${googleReviewUrl}`
  openWhatsApp(phone, techEval)
}
