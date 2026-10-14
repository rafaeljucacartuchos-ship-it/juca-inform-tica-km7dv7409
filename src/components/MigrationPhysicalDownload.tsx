import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { buildStoredZip } from '@/lib/migration-zip'
import type { AttachmentManifestItem } from '@/services/migration-export'

const BATCH_SIZE = 25
export function MigrationPhysicalDownload({
  manifest,
  exportId,
}: {
  manifest: AttachmentManifestItem[]
  exportId: string
}) {
  const [batch, setBatch] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [ready, setReady] = useState<{ url: string; filename: string } | null>(null)
  const totalBatches = Math.ceil(manifest.length / BATCH_SIZE)
  useEffect(
    () => () => {
      if (ready) URL.revokeObjectURL(ready.url)
    },
    [ready],
  )
  const prepare = async () => {
    setBusy(true)
    setReady(null)
    const files: { name: string; bytes: Uint8Array }[] = []
    const report: Record<string, unknown>[] = []
    let size = 0
    let failed = 0
    const items = manifest.slice(batch * BATCH_SIZE, (batch + 1) * BATCH_SIZE)
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        setMessage(
          'Recebendo arquivo ' + (i + 1) + ' de ' + items.length + ' do lote ' + (batch + 1) + '…',
        )
        try {
          let bytes: Uint8Array
          let expectedHash: string | undefined
          if (item.is_embedded_base64 && item.download_url.startsWith('data:')) {
            const response = await fetch(item.download_url)
            bytes = new Uint8Array(await response.arrayBuffer())
          } else {
            const response = await fetch(
              pb.baseURL.replace(/\/$/, '') + '/backend/v1/migration/admin-export',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: 'Bearer ' + pb.authStore.token,
                },
                body: JSON.stringify({
                  action: 'download_physical',
                  collection: item.collection,
                  record_id: item.record_id,
                  filename: item.filename,
                  include_data: true,
                }),
                signal: AbortSignal.timeout(60000),
              },
            )
            if (!response.ok) {
              const detail = await response.json().catch(() => ({}))
              throw new Error(detail.error || 'Servidor respondeu HTTP ' + response.status)
            }
            const data = await response.json()
            if (!data.success || typeof data.data_base64 !== 'string') {
              throw new Error(data.error || 'Servidor não entregou os bytes do arquivo.')
            }
            bytes = Uint8Array.from(atob(data.data_base64), (c) => c.charCodeAt(0))
            if (bytes.length !== data.size_bytes)
              throw new Error('Tamanho recebido diverge do servidor.')
          }
          const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
          const sha256 = Array.from(new Uint8Array(digest), (n) =>
            n.toString(16).padStart(2, '0'),
          ).join('')
          if (expectedHash && sha256 !== expectedHash.toLowerCase())
            throw new Error('Hash recebido diverge do servidor.')
          if (size + bytes.length > 128 * 1024 * 1024)
            throw new Error('Lote excede 128 MB. Arquivo não incluído; precisa de lote menor.')
          const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '_')
          const path =
            'arquivos/' +
            safe(item.collection) +
            '/' +
            safe(item.record_id) +
            '/' +
            String(batch * BATCH_SIZE + i + 1).padStart(4, '0') +
            '_' +
            safe(item.filename)
          files.push({ name: path, bytes })
          size += bytes.length
          report.push({
            collection: item.collection,
            record_id: item.record_id,
            field: item.field,
            filename: item.filename,
            zip_path: path,
            size_bytes: bytes.length,
            sha256,
            status: 'included_in_zip',
          })
        } catch (error) {
          failed++
          report.push({
            collection: item.collection,
            record_id: item.record_id,
            field: item.field,
            filename: item.filename,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
      if (!files.length) {
        setMessage(
          'Nenhum arquivo recebido. ' + String(report[0]?.error || 'Confira a lista de anexos.'),
        )
        return
      }
      const count = files.length
      files.push({
        name: 'manifesto-lote.json',
        bytes: new TextEncoder().encode(
          JSON.stringify(
            {
              export_id: exportId,
              batch: batch + 1,
              total_batches: totalBatches,
              status: failed ? 'partial' : 'complete',
              files: report,
            },
            null,
            2,
          ),
        ),
      })
      const zip = buildStoredZip(files)
      const filename =
        'juca_anexos_' +
        exportId.replace(/[^a-zA-Z0-9_-]/g, '_') +
        '_lote_' +
        String(batch + 1).padStart(3, '0') +
        (failed ? '_PARCIAL' : '') +
        '.zip'
      setReady({ url: URL.createObjectURL(zip), filename })
      setMessage(
        count +
          ' arquivos recebidos e conferidos (' +
          (size / 1048576).toFixed(1) +
          ' MB). ' +
          (failed ? failed + ' falhas registradas no ZIP. ' : '') +
          'Clique em Salvar ZIP e confira o download no navegador.',
      )
    } catch (error) {
      setMessage('Falha: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="rounded border border-indigo-300 bg-white p-3 space-y-2">
      <p className="font-semibold text-xs">Baixar fotos e anexos reais — ZIP por lote</p>
      <p className="text-xs">
        O manifesto é uma lista. Os arquivos físicos estão nos ZIPs abaixo. A verificação antiga não
        comprova que os arquivos foram salvos no computador.
      </p>
      <label className="block text-xs">
        Escolha o lote
        <select
          className="block w-full border rounded p-2"
          value={batch}
          disabled={busy}
          onChange={(e) => {
            setBatch(Number(e.target.value))
            setReady(null)
            setMessage('')
          }}
        >
          {Array.from({ length: totalBatches }, (_, i) => (
            <option key={i} value={i}>
              Lote {i + 1} de {totalBatches} — arquivos {i * BATCH_SIZE + 1} a{' '}
              {Math.min((i + 1) * BATCH_SIZE, manifest.length)}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        disabled={busy || !manifest.length}
        className="w-full text-xs"
        onClick={prepare}
      >
        {busy ? 'Recebendo e conferindo…' : 'Preparar ZIP do lote selecionado'}
      </Button>
      <p role="status" className="text-xs whitespace-pre-wrap">
        {message}
      </p>
      {ready && (
        <a
          className="block rounded bg-emerald-700 text-white p-3 text-center text-sm font-semibold"
          href={ready.url}
          download={ready.filename}
        >
          Salvar ZIP do lote {batch + 1}
        </a>
      )}
      <p className="text-xs">
        Após salvar, selecione o próximo lote. Para repetir um download, selecione o lote novamente.
        Nenhum dado do sistema é alterado.
      </p>
    </div>
  )
}
