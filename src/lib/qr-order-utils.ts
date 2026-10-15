/**
 * Utilitários para validação segura de destinos internos, parsing de QR Code de Ordens de Serviço
 * e proteção contra redirecionamentos maliciosos (Open Redirect / XSS).
 */

// PocketBase record ID padrão: 15 caracteres alfanuméricos minúsculos/dígitos.
// Permitimos de 15 a 30 caracteres alfanuméricos/hífen/underline para resiliência.
export const ORDER_ID_REGEX = /^[a-zA-Z0-9_-]{15,30}$/

/**
 * Verifica se um hostname pertence ao ecossistema do projeto Skip / JUCA INFORMÁTICA
 * ou à origem atual do navegador.
 *
 * Aceita:
 * - Mesma origem do navegador (window.location.hostname)
 * - localhost / 127.0.0.1 em desenvolvimento
 * - Domínios goskip.app (*.goskip.app, incluindo prévias e produções)
 * - Domínios skip.app (*.skip.app)
 */
export function isAllowedProjectHost(hostname: string): boolean {
  if (!hostname) return false
  const host = hostname.toLowerCase().trim()

  // 1. Hostname atual da janela onde o app está rodando
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const currentHost = window.location.hostname.toLowerCase()
    if (host === currentHost) return true
    // Ex: www.meudominio.com vs meudominio.com
    if (host === `www.${currentHost}` || `www.${host}` === currentHost) return true
  }

  // 2. Localhost e desenvolvimento local
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
    return true
  }

  // 3. Domínios oficiais do Skip (goskip.app / skip.app) para prévias e produção
  if (host === 'goskip.app' || host.endsWith('.goskip.app')) {
    return true
  }
  if (host === 'skip.app' || host.endsWith('.skip.app')) {
    return true
  }

  return false
}

/**
 * Valida se um destino é estritamente um caminho relativo seguro da aplicação.
 * Rejeita URLs com protocolos externos perigosos (javascript:, data:, vbscript:),
 * schemaless (//evil.com), caracteres de escape maliciosos e destinos fora do app.
 *
 * Se uma URL absoluta dos domínios autorizados do projeto for informada,
 * extrai o pathname + search + hash interno correspondente de forma segura.
 */
export function sanitizeInternalRedirect(target: unknown, fallback = '/ordens'): string {
  if (typeof target !== 'string') return fallback
  const trimmed = target.trim()
  if (!trimmed) return fallback

  // Bloqueia tentativas de injeção de controle ou quebra de linha
  if (/[\r\n\t]/.test(trimmed)) {
    return fallback
  }

  // Rejeita esquemas maliciosos explicitamente
  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:')
  ) {
    return fallback
  }

  // Rejeita schemaless URLs iniciadas por // ou \\
  if (trimmed.startsWith('//') || trimmed.startsWith('\\\\')) {
    return fallback
  }

  // Caso A: caminho relativo iniciado por '/'
  if (trimmed.startsWith('/') && !trimmed.startsWith('/\\')) {
    try {
      const baseOrigin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'http://localhost'
      const parsed = new URL(trimmed, baseOrigin)
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    } catch {
      return fallback
    }
  }

  // Caso B: URL absoluta completa (http: ou https:)
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed)
      if (!isAllowedProjectHost(parsed.hostname)) {
        return fallback
      }
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    } catch {
      return fallback
    }
  }

  return fallback
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
 * Analisa o texto escaneado pelo QR Code ou colado pelo usuário e garante
 * a identificação segura e robusta de uma Ordem de Serviço da JUCA INFORMÁTICA.
 *
 * Proteções ativas:
 * - NUNCA redireciona o navegador para endereços externos arbitrários.
 * - Extrai exclusivamente o orderId e gera o targetPath interno do React Router (`/ordens/${orderId}`).
 * - Rejeita protocolos perigosos (javascript:, data:, schemaless //).
 * - Rejeita domínios de terceiros desconhecidos (classificados como 'invalid_domain').
 * - Aceita etiquetas impressas em qualquer ambiente do projeto (preview ou produção goskip.app,
 *   mesma origem ou localhost), contornando divergências de domínio entre onde a etiqueta
 *   foi impressa e onde está sendo escaneada.
 *
 * Formatos aceitos:
 * 1) URL completa do projeto: https://*-preview.goskip.app/ordens/:orderId ou https://producao.goskip.app/ordens/:orderId
 * 2) Caminho relativo do app: /ordens/:orderId
 * 3) ID direto da OS: 15 a 30 caracteres alfanuméricos (ex: PocketBase ID padrão de 15 caracteres)
 * 4) Código com prefixo ou querystring (ex: OS-0227 ou ?id=..., extraindo o id limpo)
 */
export function parseJucaOrderQr(rawText: string): ParsedQrOrderResult {
  const trimmed = String(rawText || '').trim()
  if (!trimmed) {
    return { valid: false, reason: 'unrecognized' }
  }

  // Bloqueio imediato de esquemas perigosos (XSS / injeção)
  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('\\\\') ||
    /[\r\n\t]/.test(trimmed)
  ) {
    return { valid: false, reason: 'unrecognized' }
  }

  // Caso 1: ID direto de O.S. (alfanumérico do PocketBase de 15 a 30 chars, sem barras)
  if (ORDER_ID_REGEX.test(trimmed) && !trimmed.includes('/')) {
    return {
      valid: true,
      orderId: trimmed,
      targetPath: `/ordens/${trimmed}`,
    }
  }

  // Caso 2: Caminho relativo do app (/ordens/:id...)
  if (trimmed.startsWith('/') && !trimmed.startsWith('/\\')) {
    try {
      const baseOrigin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'http://localhost'
      const parsed = new URL(trimmed, baseOrigin)
      const pathname = parsed.pathname.replace(/\/+$/, '') // remove trailing slashes
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
    } catch {
      return { valid: false, reason: 'unrecognized' }
    }
  }

  // Caso 3: URL absoluta completa (http: ou https:)
  if (/^https?:\/\//i.test(trimmed)) {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(trimmed)
    } catch {
      return { valid: false, reason: 'unrecognized' }
    }

    // Validação de domínio: aceita origem atual, domínios goskip.app / skip.app e localhost
    const isDomainAllowed = isAllowedProjectHost(parsedUrl.hostname)

    // Caminho da rota no URL
    const pathname = parsedUrl.pathname.replace(/\/+$/, '')
    const match = pathname.match(/^\/ordens\/([a-zA-Z0-9_-]+)$/)

    // Se o domínio for estranho/externo
    if (!isDomainAllowed) {
      return { valid: false, reason: 'invalid_domain' }
    }

    // Se o caminho não casar com /ordens/:id
    if (!match) {
      return { valid: false, reason: 'invalid_path' }
    }

    const orderId = match[1]
    if (!ORDER_ID_REGEX.test(orderId)) {
      return { valid: false, reason: 'invalid_id' }
    }

    // Retorna navegação estritamente interna com o ID limpo extraído
    return {
      valid: true,
      orderId,
      targetPath: `/ordens/${orderId}`,
    }
  }

  // Caso 4: Se o usuário digitou sem protocolo mas incluiu um host/caminho (ex: assistencia.goskip.app/ordens/xyz)
  if (trimmed.includes('/ordens/')) {
    const splitIndex = trimmed.indexOf('/ordens/')
    const pathPart = trimmed.slice(splitIndex)
    const hostPart = trimmed
      .slice(0, splitIndex)
      .replace(/^https?:\/\//i, '')
      .replace(/:\d+$/, '')

    if (hostPart && !isAllowedProjectHost(hostPart)) {
      return { valid: false, reason: 'invalid_domain' }
    }

    try {
      const match = pathPart
        .replace(/[?#].*$/, '')
        .replace(/\/+$/, '')
        .match(/^\/ordens\/([a-zA-Z0-9_-]+)$/)
      if (match && ORDER_ID_REGEX.test(match[1])) {
        return {
          valid: true,
          orderId: match[1],
          targetPath: `/ordens/${match[1]}`,
        }
      }
    } catch {
      /* ignore */
    }
  }

  return { valid: false, reason: 'unrecognized' }
}
