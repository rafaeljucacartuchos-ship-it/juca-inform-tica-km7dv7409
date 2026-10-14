import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  readPurchase,
  sendPurchase,
  type Purchase,
  type PurchasePreview,
  type PurchaseResponse,
} from '@/lib/supplier-purchase'

export function SupplierPurchaseForm({ onDone }: { onDone: () => void }) {
  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [preview, setPreview] = useState<PurchasePreview[] | null>(null)
  const [receipt, setReceipt] = useState<PurchaseResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [acceptedCount, setAcceptedCount] = useState(false)
  const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const shown = preview || receipt?.result
  const mismatch =
    purchase && purchase.declaredCount !== null && purchase.declaredCount !== purchase.items.length
  const load = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setError('')
    setPurchase(null)
    setPreview(null)
    setReceipt(null)
    setAcceptedCount(false)
    try {
      setPurchase(await readPurchase(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ler a planilha.')
    } finally {
      setBusy(false)
    }
  }
  const run = async (commit: boolean) => {
    if (!purchase || (mismatch && !acceptedCount)) return
    setBusy(true)
    setError('')
    try {
      const result = await sendPurchase(
        { ...purchase, countConfirmed: acceptedCount },
        commit ? 'commit' : 'preview',
        preview || undefined,
      )
      if (result.receiptId) {
        setReceipt(result)
        setPreview(null)
      } else setPreview(result.preview || null)
    } catch (e) {
      setPreview(null)
      const err = e as { response?: { error?: string }; message?: string }
      setError(
        err.response?.error ||
          err.message ||
          'Não foi possível concluir. Confira novamente a mesma nota para verificar se já foi registrada antes de tentar outra entrada.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">Entrada de compra — GET / Multilaser</h3>
      <p>
        Some a compra ao estoque e atualize os preços de venda da planilha. Cada nota pode entrar
        uma única vez. Custos existentes serão preservados; custo ausente não representa lucro
        confirmado.
      </p>
      <input
        aria-label="Planilha de compra"
        type="file"
        accept=".xlsx,.xls"
        disabled={busy || !!receipt}
        onChange={(e) => void load(e.target.files?.[0])}
      />
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {purchase && (
        <>
          <p>
            <b>{purchase.supplier}</b> · Nota {purchase.invoice}
          </p>
          <p>
            {purchase.items.length} produtos · {purchase.items.reduce((s, x) => s + x.quantity, 0)}{' '}
            unidades
          </p>
          {mismatch && !receipt && (
            <label className="block bg-amber-50 p-3">
              <input
                type="checkbox"
                disabled={busy || !!preview}
                checked={acceptedCount}
                onChange={(e) => setAcceptedCount(e.target.checked)}
              />{' '}
              O rodapé informa {purchase.declaredCount} itens. Conferi a nota e confirmo que os{' '}
              {purchase.items.length} produtos listados estão completos.
            </label>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Entrada</th>
                  <th>Preço de venda</th>
                  <th>Estoque antes → depois</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((x, i) => (
                  <tr key={x.sku} className="border-b">
                    <td className="py-2">
                      {x.sku} — {x.name}
                    </td>
                    <td>
                      {x.quantity} {x.unit}
                    </td>
                    <td>
                      {shown && shown[i].previousPrice !== null
                        ? `${money(shown[i].previousPrice!)} → `
                        : ''}
                      {money(x.priceCents / 100)}
                    </td>
                    <td>
                      {shown
                        ? `${shown[i].previousStock} → ${shown[i].nextStock} (${shown[i].action === 'create' ? 'novo' : 'existente'})`
                        : 'A conferir'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!receipt && (
            <Button
              disabled={busy || !!(mismatch && !acceptedCount)}
              onClick={() => void run(!!preview)}
            >
              {busy
                ? 'Conferindo…'
                : preview
                  ? 'Confirmar entrada desta nota'
                  : 'Conferir com o estoque atual'}
            </Button>
          )}
        </>
      )}
      {receipt && (
        <div role="status" className="bg-green-50 p-3">
          <b>
            {receipt.alreadyImported
              ? 'Nota já registrada. Estoque não foi somado novamente.'
              : 'Entrada registrada.'}
          </b>
          <p>Recibo: {receipt.receiptId}</p>
          <p>{receipt.result?.length} produtos no comprovante.</p>
          <Button onClick={onDone}>Concluir</Button>
        </div>
      )}
    </section>
  )
}
