// Política proposta: o cadastro grava números JSON; ausência não equivale a zero.
export function readRentalReserveRate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Taxa de reserva ausente ou inválida. Revise o planejamento antes de gerar propostas.')
  }
  return value
}

export function validRentalReserveInput(rate: unknown, pages: unknown): boolean {
  return typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 &&
    typeof pages === 'number' && Number.isSafeInteger(pages) && pages >= 0
}
