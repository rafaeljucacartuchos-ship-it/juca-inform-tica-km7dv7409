/**
 * Utilitários para validação segura de destinos internos, parsing de QR Code de Ordens de Serviço
 * e proteção contra redirecionamentos maliciosos (Open Redirect / XSS).
 */

const ORDER_ID_REGEX = /^[a-zA-Z0-9_-]{15,30}$/

/**
 * Valida se um destino é estritamente um caminho relativo da mesma origem.
 * Rejeita URLs com protocolos externos (http:, https:, javascript:, data:),
 * schemaless (//evil.com), caracteres de escape maliciosos e destinos fora do app.
 */
export function sanitizeInternalRedirect(target: unknown, fallback = '/ordens'): string {
  if (typeof target !== 'string') return fallback
  const trimmed = target.trim()
  if (!trimmed) return fallback

  // Rejeita qualquer URL absoluta ou tentativas de escape de protocolo (javascript:, data:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallback
  }

  // Rejeita schemaless URLs iniciadas por // ou \\
  if (trimmed.startsWith('//') || trimmed.startsWith('\\\\')) {
    return fallback
  }

  // Deve iniciar estritamente com uma única barra '/'
  if (!trimmed.startsWith('/') || trimmed.startsWith('/\\')) {
    return fallback
  }

  // Bloqueia tentativas de quebra ou injeção de controle
  if (/[\r\n\t]/.test(trimmed)) {
    return fallback
  }

  // Se não for um caminho interno aceitável, retorna fallback
  try {
    const parsed = new URL(trimmed, window.location.origin)
    if (parsed.origin !== window.location.origin) {
      return fallback
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

/**
 * Resultado do reconhecimento do QR Code
 */
export type ParsedQrOrderResult = {
  valid: boolean
  orderId?: string
  targetPath?: string
  reason?: 'invalid_domain' | 'invalid_path' | 'invalid_id' | 'unrecognized'
}

/**
 * Analisa o texto escaneado pelo QR Code e garante que seja EXCLUSIVAMENTE
 * uma rota de Ordem de Serviço da mesma aplicação / origem.
 * NUNCA permite navegação arbitrária para outros sites ou módulos desconhecidos.
 *
 * Formatos aceitos:
 * 1) URL completa da mesma origem: https://exemplo.com/ordens/:orderId
 * 2) Caminho relativo: /ordens/:orderId
 * 3) Identificador direto de 15 caracteres (PocketBase ID padrão de OS)
 */
export function parseJucaOrderQr(rawText: string): ParsedQrOrderResult {
  const trimmed = String(rawText || '').trim()
  if (!trimmed) {
    return { valid: false, reason: 'unrecognized' }
  }

  // Caso 1: ID direto de O.S. (15 caracteres alfanuméricos padrão do PocketBase)
  if (ORDER_ID_REGEX.test(trimmed) && trimmed.length === 15) {
    return {
      valid: true,
      orderId: trimmed,
      targetPath: `/ordens/${trimmed}`,
    }
  }

  // Caso 2: URL completa ou caminho relativo
  let parsedUrl: URL
  try {
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      parsedUrl = new URL(trimmed, window.location.origin)
    } else {
      parsedUrl = new URL(trimmed)
      // Mesma origem estrita (protocolo + host + porta)
      if (parsedUrl.origin !== window.location.origin) {
        return { valid: false, reason: 'invalid_domain' }
      }
    }
  } catch {
    return { valid: false, reason: 'unrecognized' }
  }

  // Apenas a rota /ordens/:id é aceita
  const pathname = parsedUrl.pathname.replace(/\/+$/, '') // remove trailing slash
  const match = pathname.match(/^\/ordens\/([a-zA-Z0-9_-]+)$/)

  if (!match) {
    return { valid: false, reason: 'invalid_path' }
  }

  const orderId = match[1]
  if (!ORDER_ID_REGEX.test(orderId)) {
    return { valid: false, reason: 'invalid_id' }
  }

  return {
    valid: true,
    orderId,
    targetPath: `/ordens/${orderId}`,
  }
}
