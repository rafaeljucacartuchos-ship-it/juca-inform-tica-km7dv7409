import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getOrcamento, getOrcamentoItens, getOrcamentoAnexos } from '@/services/orcamentos'
import { Orcamento, OrcamentoItem, OrcamentoAnexo } from '@/types'
import { OrcamentoPrintDocument } from '@/components/OrcamentoPrintDocument'

export default function OrcamentoPrint() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const mode = (searchParams.get('mode') === 'os_summary' ? 'os_summary' : 'complete') as
    | 'complete'
    | 'os_summary'

  const [orcamento, setOrcamento] = useState<Orcamento | null>(null)
  const [items, setItems] = useState<OrcamentoItem[]>([])
  const [anexos, setAnexos] = useState<OrcamentoAnexo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([getOrcamento(id), getOrcamentoItens(id), getOrcamentoAnexos(id)])
      .then(([o, it, an]) => {
        setOrcamento(o)
        setItems(it)
        setAnexos(an)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-xs text-slate-500">
        Carregando documento do orçamento...
      </div>
    )
  }

  if (!orcamento) {
    return (
      <div className="flex h-screen items-center justify-center text-xs text-slate-500">
        Orçamento não encontrado.
      </div>
    )
  }

  return <OrcamentoPrintDocument orcamento={orcamento} items={items} anexos={anexos} mode={mode} />
}
