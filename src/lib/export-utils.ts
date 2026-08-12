export interface ExportSection {
  title?: string
  headers?: string[]
  rows?: (string | number)[][]
}

export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob(['\ufeff' + content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportToCSV(filename: string, sections: ExportSection[]) {
  const lines: string[] = []
  for (const s of sections) {
    if (s.title) lines.push(s.title)
    if (s.headers) {
      lines.push(s.headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','))
      for (const row of s.rows || []) {
        lines.push(row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      }
    }
    lines.push('')
  }
  downloadFile(filename + '.csv', lines.join('\n'), 'text/csv;charset=utf-8;')
}

export function exportToExcel(filename: string, sections: ExportSection[]) {
  const tables = sections
    .map((s) => {
      const title = s.title ? `<h3>${s.title}</h3>` : ''
      if (!s.headers) return title
      const header = `<tr>${s.headers.map((h) => `<th>${h}</th>`).join('')}</tr>`
      const body = (s.rows || [])
        .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
        .join('')
      return `${title}<table border="1"><thead>${header}</thead><tbody>${body}</tbody></table>`
    })
    .join('')
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>${tables}</body></html>`
  downloadFile(filename + '.xls', html, 'application/vnd.ms-excel')
}
