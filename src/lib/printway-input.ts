/** Valor vazio ou inválido permanece ausente. Zero deve ser digitado explicitamente. */
export function parseNonNegativeMoney(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return null
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) && value >= 0 ? value : null
}
export const parsePrintwayInput = parseNonNegativeMoney
