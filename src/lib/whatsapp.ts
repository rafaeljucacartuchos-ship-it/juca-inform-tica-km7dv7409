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
): string {
  return `Olá ${customerName}! Sua ordem de serviço ${orderNumber} está com status: ${status}. Entre em contato para mais informações.`
}

export function triggerWhatsAppEvaluation(
  phone: string,
  customerName: string,
  orderNumber: string,
) {
  const techEval = `Olá ${customerName}! O serviço da sua ordem ${orderNumber} foi concluído. Por favor, avalie o atendimento do nosso técnico. De 1 a 5, como você avalia o serviço prestado? Sua opinião é muito importante para nós!`
  const googleReview = `Olá ${customerName}! Sua ordem de serviço ${orderNumber} foi finalizada. Que tal deixar um review sobre nossa empresa no Google? Sua avaliação nos ajuda a melhorar continuamente! Acesse: https://search.google.com/local/writereview?place_id=CHANGEME`
  window.open(buildWhatsAppUrl(phone, techEval), '_blank')
  setTimeout(() => window.open(buildWhatsAppUrl(phone, googleReview), '_blank'), 1000)
}
