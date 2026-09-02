/**
 * Utilitários centralizados de telefone para todo o sistema.
 * Garante padronização com prefixo '55' no banco de dados e exibição amigável na interface.
 */

/**
 * Normaliza um número de telefone/celular para o padrão internacional com prefixo '55':
 * 1. Remove todos os caracteres não numéricos.
 * 2. Se vazio, retorna string vazia.
 * 3. Trata zero à esquerda (ex: 067999999999 -> 67999999999).
 * 4. Se o número tiver 10 ou 11 dígitos (DDD + 8 ou 9 dígitos), adiciona automaticamente '55'.
 * 5. Se o número já começar com '55' e tiver 12 ou 13 dígitos (55 + DDD + 8 ou 9 dígitos), mantém intacto.
 * 6. Se o número tiver 8 ou 9 dígitos (sem DDD), assume o DDD padrão de MS (67) da empresa JUCA ou adiciona 5567 caso aplicável,
 *    ou adiciona 55 se o usuário/importação fornecer DDD + número. Para 8/9 dígitos isolados: adiciona '5567'.
 * 7. Retorna apenas dígitos numéricos como string pura.
 */
export function normalizePhone(rawPhone?: string | null): string {
  if (!rawPhone) return ''
  let digits = String(rawPhone).replace(/\D/g, '')
  if (!digits) return ''

  // Trata zeros repetidos à esquerda (ex: 067..., 0055...)
  while (digits.startsWith('0')) {
    digits = digits.substring(1)
  }

  // Se já começa com 55 e possui 12 ou 13 dígitos (DDI 55 + DDD 2 dígitos + 8 ou 9 dígitos)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits
  }

  // Se tem 10 ou 11 dígitos (DDD 2 dígitos + número de 8 ou 9 dígitos)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  // Se tem 8 ou 9 dígitos (número local sem DDD), usa DDD padrão 67 (Juca Cartuchos / MS)
  if (digits.length === 8 || digits.length === 9) {
    return `5567${digits}`
  }

  // Fallback seguro: se começar com 55 ou tiver outro comprimento, retorna dígitos limpos
  return digits
}

/**
 * Alias para compatibilidade com código existente de WhatsApp.
 */
export const sanitizePhone = normalizePhone

/**
 * Formata um número de telefone para exibição visual amigável:
 * - 5567999999999 -> (67) 99999-9999
 * - 556734414981  -> (67) 3441-4981
 * - 67999999999   -> (67) 99999-9999
 * - 999999999     -> 99999-9999
 */
export function formatPhone(phone?: string | null): string {
  if (!phone) return ''
  let digits = String(phone).replace(/\D/g, '')
  if (!digits) return ''

  // Se começa com 55 e tem 12 ou 13 dígitos, remove o 55 para formatar padrão BR (DDD) ...
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.substring(2)
  }

  if (digits.length === 11) {
    // Celular com DDD: (XX) 9XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  if (digits.length === 10) {
    // Fixo com DDD: (XX) XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  if (digits.length === 9) {
    // Celular sem DDD: 9XXXX-XXXX
    return `${digits.slice(0, 5)}-${digits.slice(5)}`
  }

  if (digits.length === 8) {
    // Fixo sem DDD: XXXX-XXXX
    return `${digits.slice(0, 4)}-${digits.slice(4)}`
  }

  return phone
}

/**
 * Aplica máscara de digitação em tempo real no input de formulário.
 * Suporta entrada enquanto o usuário digita celular/telefone.
 */
export function maskPhoneInput(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')

  // Se o usuário colou com 55 na frente (ex: 5567999998888), remove o 55 para exibição amigável
  let workingDigits = digits
  if (workingDigits.startsWith('55') && workingDigits.length >= 12) {
    workingDigits = workingDigits.substring(2)
  }

  if (workingDigits.length <= 2) {
    return workingDigits.length > 0 ? `(${workingDigits}` : ''
  }
  if (workingDigits.length <= 6) {
    return `(${workingDigits.slice(0, 2)}) ${workingDigits.slice(2)}`
  }
  if (workingDigits.length <= 10) {
    // Telefone fixo (ex: (67) 3441-4981)
    return `(${workingDigits.slice(0, 2)}) ${workingDigits.slice(2, 6)}-${workingDigits.slice(6)}`
  }
  // Celular (ex: (67) 99999-4981) - até 11 dígitos
  return `(${workingDigits.slice(0, 2)}) ${workingDigits.slice(2, 7)}-${workingDigits.slice(7, 11)}`
}
