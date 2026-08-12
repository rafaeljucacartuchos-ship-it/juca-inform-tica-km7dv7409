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
  const linkText = shareUrl ? `\n\nAcesse sua OS e assine digitalmente: ${shareUrl}` : ''
  const techEval = `Olá ${customerName}! O serviço da sua Ordem de Serviço ${orderNumber} foi concluído. Por favor, avalie o atendimento do nosso técnico. De 1 a 5, como você avalia o serviço prestado? Sua opinião é muito importante para nós!${linkText}`
  const googleReview = `Olá ${customerName}! Sua ordem de serviço ${orderNumber} foi finalizada. Que tal deixar um review sobre nossa empresa no Google? Sua avaliação nos ajuda a melhorar continuamente! Acesse: https://search.google.com/local/writereview?place_id=CHANGEME`
  window.open(buildWhatsAppUrl(phone, techEval), '_blank')
  setTimeout(() => window.open(buildWhatsAppUrl(phone, googleReview), '_blank'), 1000)
}
