import { useRef, useState } from 'react'
import { prepareContractPhoto, MAX_CONTRACT_PHOTOS, type RentalContractPhoto } from '@/lib/rental-contract-photos'

export function RentalContractPhotosEditor({ photos, onChange, disabled, onBusyChange }: {
  photos: RentalContractPhoto[]
  onChange: (photos: RentalContractPhoto[]) => void
  disabled: boolean
  onBusyChange: (busy: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState('')
  return <section className="rounded border p-3 space-y-3" aria-label="Fotos do contrato">
    <h3 className="font-semibold">Fotos do contrato — Anexo II</h3>
    <p>Até 6 fotos JPG, PNG ou WebP, com até 12 MB cada. Serão guardadas cópias compactadas junto ao contrato. Confira a legibilidade e conserve os originais. As alterações só são gravadas ao salvar o rascunho.</p>
    <label className="block">Adicionar fotos
      <input aria-label="Adicionar fotos ao contrato" className="block w-full" type="file" accept="image/jpeg,image/png,image/webp" multiple
        disabled={disabled || busy || photos.length >= MAX_CONTRACT_PHOTOS}
        onChange={async (e) => {
          const files = Array.from(e.target.files || [])
          e.target.value = ''
          if (!files.length || lock.current) return
          if (photos.length + files.length > MAX_CONTRACT_PHOTOS) { setError('O limite é 6 fotos por contrato.'); return }
          lock.current = true; setBusy(true); onBusyChange(true); setError('')
          try {
            const added: RentalContractPhoto[] = []
            for (const file of files) added.push(await prepareContractPhoto(file))
            onChange([...photos, ...added])
          } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível preparar as fotos.') }
          finally { lock.current = false; setBusy(false); onBusyChange(false) }
        }} />
    </label>
    {busy && <p role="status">Preparando fotos…</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="grid sm:grid-cols-2 gap-3">
      {photos.map((photo, index) => <figure key={photo.id} className="border rounded p-2">
        <img src={photo.dataUrl} alt={photo.caption || photo.name} className="w-full h-40 object-contain" />
        <figcaption className="break-all">{index + 1}. {photo.name}</figcaption>
        <label>Legenda da foto {index + 1}
          <input aria-label={'Legenda da foto ' + (index + 1)} maxLength={200} value={photo.caption} disabled={disabled || busy}
            className="block w-full border rounded p-2"
            onChange={(e) => onChange(photos.map((p) => p.id === photo.id ? {...p, caption: e.target.value} : p))} />
        </label>
        <button type="button" className="border rounded px-3 py-1 mt-2" disabled={disabled || busy}
          onClick={() => onChange(photos.filter((p) => p.id !== photo.id))}>Remover foto {index + 1}</button>
      </figure>)}
    </div>
  </section>
}
