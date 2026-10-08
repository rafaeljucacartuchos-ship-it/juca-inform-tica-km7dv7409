/** Ponte entre os cinco campos legados e vínculos com posição explícita. */
export interface PrinterSupplyLink {
  id: string
  impressora: string
  suprimento: string
  posicao: number
  ativo: boolean
}
export interface PrinterLinkSource {
  id?: string
  vinculos_variaveis_ativos?: boolean
  vinculos_suprimentos?: PrinterSupplyLink[]
  suprimento_1?: string | null
  suprimento_2?: string | null
  suprimento_3?: string | null
  suprimento_4?: string | null
  suprimento_5?: string | null
}
export function getPrinterSupplyIds(printer: PrinterLinkSource): Array<string | null> {
  if (!printer.vinculos_variaveis_ativos) return [
    printer.suprimento_1 || null, printer.suprimento_2 || null,
    printer.suprimento_3 || null, printer.suprimento_4 || null, printer.suprimento_5 || null,
  ]
  if (!Array.isArray(printer.vinculos_suprimentos))
    throw new Error('Vínculos ampliados não carregados. Recarregue o cadastro antes de calcular.')
  const slots: Array<string | null> = Array(5).fill(null)
  const positions = new Set<number>()
  for (const link of printer.vinculos_suprimentos) {
    if (link.impressora !== printer.id) throw new Error('Vínculo pertence a outro equipamento.')
    if (!link.ativo) continue
    if (!Number.isSafeInteger(link.posicao) || link.posicao < 1 || link.posicao > 1000)
      throw new Error('Posição de suprimento inválida.')
    if (positions.has(link.posicao)) throw new Error('Mais de um vínculo ativo na mesma posição.')
    if (typeof link.suprimento !== 'string' || !link.suprimento.trim())
      throw new Error('Vínculo ativo sem suprimento.')
    positions.add(link.posicao)
    while (slots.length < link.posicao) slots.push(null)
    slots[link.posicao - 1] = link.suprimento
  }
  return slots
}
export function resolvePrinterSupplies<T extends {id: string}>(
  printer: PrinterLinkSource, supplies: T[], legacyExpansion?: Record<string, T>,
): Array<T | undefined> {
  const map = new Map(supplies.map(s => [s.id, s]))
  return getPrinterSupplyIds(printer).map((id, index) => {
    if (!id) return undefined
    const fallback = !printer.vinculos_variaveis_ativos ? legacyExpansion?.['suprimento_' + (index + 1)] : undefined
    const supply = map.get(id) || (fallback?.id === id ? fallback : undefined)
    if (!supply) throw new Error('Suprimento vinculado não carregado: ' + id)
    return supply
  })
}
export function readPrinterSupplies<T extends {id: string}>(
  printer: PrinterLinkSource | null, supplies: T[], legacyExpansion?: Record<string, T>,
): { slots: Array<T | undefined>; error: string | null } {
  if (!printer) return {slots: [], error: null}
  try { return {slots: resolvePrinterSupplies(printer, supplies, legacyExpansion), error: null} }
  catch (error) { return {slots: [], error: error instanceof Error ? error.message : 'Falha ao carregar vínculos.'} }
}
