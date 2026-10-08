// Candidato para execução NO SERVIDOR, após autorização da proposta/token.
// Esta função não autentica, não consulta banco e não deve ser usada como filtro apenas no navegador.
type Row = Record<string, unknown>
function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Registro comercial inválido.')
  return value as Row
}
function text(value: unknown, required = false): string {
  if (value === undefined || value === null) {
    if (required) throw new Error('Identificação comercial ausente.')
    return ''
  }
  if (typeof value !== 'string' || (required && !value.trim())) throw new Error('Texto comercial inválido.')
  return value
}
function amount(value: unknown, integer = false, positive = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
      (integer && !Number.isSafeInteger(value)) || (positive && value === 0)) {
    throw new Error('Valor comercial ausente ou inválido.')
  }
  return value
}
export function projectRentalCommercialQuote(input: unknown) {
  const q = row(input)
  // Usa somente os valores congelados da proposta, sem preço atual de catálogo.
  const legacy = q.resultados === undefined || q.resultados === null ? {} : row(q.resultados)
  const machines = q.maquinas_comparadas ?? legacy.machines
  if (!Array.isArray(machines) || machines.length === 0) throw new Error('Proposta sem equipamento comercial.')
  return {
    id: text(q.id, true),
    titulo: text(q.titulo),
    created: text(q.created, true),
    cliente_nome_livre: text(q.cliente_nome_livre, true),
    cliente_documento: text(q.cliente_documento),
    cliente_telefone: text(q.cliente_telefone),
    cliente_endereco: text(q.cliente_endereco),
    contrato_meses: amount(q.contrato_meses, true, true),
    franquia_paginas: amount(q.franquia_paginas, true),
    maquinas_comparadas: machines.map(value => {
      const m = row(value)
      if (typeof m.scanner !== 'boolean') throw new Error('Scanner comercial não confirmado.')
      return {
        machineName: text(m.machineName, true),
        serial: text(m.serial),
        scanner: m.scanner,
        scannerDados: text(m.scannerDados),
        franquiaSugerida: amount(m.franquiaSugerida),
        excedenteSugerido: amount(m.excedenteSugerido),
        tco: amount(m.tco),
      }
    }),
  }
}
