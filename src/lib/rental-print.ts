/** Prints only the document, outside the app's fixed-height scrolling workspace. */
export const RENTAL_PRINT_CSS = `
@page { size: A4 portrait; margin: 12mm; }
html, body { width:auto!important; height:auto!important; min-height:0!important;
  max-height:none!important; overflow:visible!important; margin:0!important;
  padding:0!important; background:white!important; color:#0f172a!important;
  font-size:10pt!important; line-height:1.35!important; }
* { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
[data-rental-document] { width:186mm!important; max-width:100%!important;
  height:auto!important; max-height:none!important; overflow:visible!important;
  margin:0!important; padding:0!important; border:0!important; border-radius:0!important;
  box-shadow:none!important; font-size:10pt!important; line-height:1.4!important; }
[data-rental-document] .print\\:hidden { display:none!important; }
[data-rental-document] .truncate { overflow:visible!important; white-space:normal!important; }
[data-rental-document] p { orphans:3; widows:3; }
[data-rental-document] h1, [data-rental-document] h2, [data-rental-document] h3,
[data-rental-document] h4 { break-after:avoid; }
[data-rental-document] img { max-width:100%; }
.page-break-inside-avoid, [data-rental-document] tr { break-inside:avoid; }
.rental-v2 .annex { break-before:page; }
[data-rental-document="proposal"] { font-size:9pt!important; line-height:1.25!important; }
[data-rental-document="proposal"] .rental-options-two { grid-template-columns:repeat(2,minmax(0,1fr))!important; }
[data-rental-document="proposal"] .rental-customer-grid,
[data-rental-document="proposal"] ul { grid-template-columns:repeat(2,minmax(0,1fr))!important; }
[data-rental-document="proposal"] > div { margin-bottom:3mm!important; }
[data-rental-document="proposal"] .rental-option { padding:3mm!important; break-inside:avoid; }
`

export async function printRentalDocument(source: HTMLElement): Promise<void> {
  const frame = document.createElement('iframe')
  frame.title = 'Documento de locação A4'
  frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;height:1123px;border:0;'
  document.body.appendChild(frame)
  const cleanup = () => frame.remove()
  try {
    const doc = frame.contentDocument
    const win = frame.contentWindow
    if (!doc || !win) throw new Error('Impressão indisponível')
    doc.title = source.dataset.rentalDocument === 'proposal' ? 'Proposta de locação JUCA' : 'Contrato de locação JUCA'
    const base = doc.createElement('base')
    base.href = document.baseURI
    doc.head.appendChild(base)
    const styles: Promise<void>[] = []
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((style) => {
      const copy = style.cloneNode(true) as HTMLElement
      if (copy.tagName === 'LINK') styles.push(new Promise((resolve, reject) => {
        copy.onload = () => resolve()
        copy.onerror = () => reject(new Error('Falha ao carregar estilo'))
      }))
      doc.head.appendChild(copy)
    })
    const css = doc.createElement('style')
    css.textContent = RENTAL_PRINT_CSS
    doc.head.appendChild(css)
    const copy = source.cloneNode(true) as HTMLElement
    copy.querySelectorAll('button, script, .print\\:hidden').forEach((el) => el.remove())
    doc.body.appendChild(copy)
    await Promise.race([
      Promise.all(styles),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Tempo de carregamento excedido')), 15000)),
    ])
    await doc.fonts.ready
    await Promise.all(Array.from(doc.images).map(async (img) => {
      try { await img.decode() } catch { /* Text remains printable if the logo is unavailable. */ }
    }))
    // Fit ordinary proposals on one A4 sheet. Never crop long documents or hide clauses.
    if (copy.dataset.rentalDocument === 'proposal') {
      const usableHeight = 273 * 96 / 25.4
      const scale = Math.min(1, usableHeight / copy.scrollHeight)
      if (scale >= 0.8) copy.style.zoom = String(scale)
    }
    win.addEventListener('afterprint', cleanup, { once: true })
    setTimeout(cleanup, 300000)
    win.focus()
    win.print()
  } catch (error) { cleanup(); throw error }
}
