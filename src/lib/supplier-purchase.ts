import * as XLSX from 'xlsx'
import pb from '@/lib/pocketbase/client'

export type PurchaseItem = { sku: string; barcode: string; name: string; quantity: number; unit: string; priceCents: number }
export type Purchase = { invoiceKey: string; invoice: string; supplier: string; items: PurchaseItem[]; declaredCount: number | null; countConfirmed?: boolean }
export type PurchasePreview = { sku: string; id: string | null; previousStock: number; nextStock: number; previousPrice: number | null; price: number; action: string }
export type PurchaseResponse = { preview?: PurchasePreview[]; result?: PurchasePreview[]; alreadyImported?: boolean; receiptId?: string }

export function purchaseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) throw new Error('Valor numérico ausente.')
  const s = value.trim().replace(/^R\$\s*/, '')
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(s)) throw new Error('Número inválido: ' + s)
  return Number(s.replace(/\./g, '').replace(',', '.'))
}

export function parsePurchaseRows(rows: unknown[][]): Purchase {
  const str = (x: unknown) => x == null ? '' : String(x).trim()
  const cells = rows.flat().map(str)
  const keys = [...new Set(cells.filter(x => /^\d{44}$/.test(x)))]
  if (keys.length !== 1) throw new Error('Não foi encontrada uma única chave de nota de 44 dígitos.')
  const meta = rows[5] || []
  const invoice = str(meta[9]), supplier = str(meta[11])
  if (!invoice || !supplier) throw new Error('Fornecedor ou número da nota não identificado. Use o relatório GET/Multilaser.')
  let declaredCount: number | null = null
  const items: PurchaseItem[] = []
  const seen = new Set<string>()
  for (let i = 13; i < rows.length; i++) {
    const r = rows[i], sku = str(r[0])
    if (/^itens\b/i.test(sku)) { declaredCount = purchaseNumber(r[3]); break }
    if (!sku && !str(r[7])) continue
    if (!/^\d+$/.test(sku) || !str(r[7])) throw new Error(`Linha ${i + 1}: código ou descrição inválido.`)
    if (seen.has(sku)) throw new Error('Código repetido: ' + sku)
    seen.add(sku)
    const quantity = purchaseNumber(r[13]), price = purchaseNumber(r[19])
    if (quantity <= 0 || price <= 0) throw new Error(`Linha ${i + 1}: quantidade e preço devem ser positivos.`)
    if (Math.abs(price * 100 - Math.round(price * 100)) > 0.00001) throw new Error('Preço com mais de duas casas decimais: ' + sku)
    items.push({ sku, barcode: str(r[4]), name: str(r[7]), quantity, unit: str(r[15]), priceCents: Math.round(price * 100) })
  }
  if (!items.length || items.length > 500) throw new Error('Relatório sem produtos ou com mais de 500 linhas.')
  return { invoiceKey: keys[0], invoice, supplier, items, declaredCount }
}

export async function readPurchase(file: File): Promise<Purchase> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Arquivo maior que 10 MB.')
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  if (book.SheetNames.length !== 1) throw new Error('Selecione um relatório com uma única aba.')
  return parsePurchaseRows(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, raw: true, defval: null }))
}

export async function sendPurchase(purchase: Purchase, mode: 'preview' | 'commit', expectedPreview?: PurchasePreview[]): Promise<PurchaseResponse> {
  return pb.send('/backend/v1/supplier-purchase', { method: 'POST', body: { ...purchase, mode, expectedPreview } })
}
