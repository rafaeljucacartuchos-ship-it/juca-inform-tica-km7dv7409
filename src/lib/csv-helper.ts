/**
 * Utilitário de escape e formatação rigorosa de CSV conforme RFC 4180
 * Suporta aspas, separadores (vírgula ou ponto-e-vírgula), quebras de linha e caracteres especiais.
 */

export function escapeCSVCell(value: any): string {
  if (value === null || value === undefined) {
    return '""'
  }
  const str = String(value)
  // Dobra aspas internas (" -> "") e envelopa tudo em aspas duplas
  const escaped = str.replace(/"/g, '""')
  return `"${escaped}"`
}

export function buildCSVRow(cells: any[], delimiter: string = ';'): string {
  return cells.map(escapeCSVCell).join(delimiter)
}

export function buildCSVContent(headers: string[], rows: any[][], delimiter: string = ';'): string {
  const headerRow = buildCSVRow(headers, delimiter)
  const dataRows = rows.map((r) => buildCSVRow(r, delimiter))
  // Prefixo BOM UTF-8 (\uFEFF) para visualização correta no Excel e editores no Windows/Mac/Linux
  return '\uFEFF' + [headerRow, ...dataRows].join('\r\n')
}
