import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getLaudo } from '@/services/laudos'
import { LaudoTecnicoPrintView } from '@/components/LaudoTecnicoPrintView'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft } from 'lucide-react'
import type { LaudoTecnico } from '@/types'

export function LaudoPrint() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [laudo, setLaudo] = useState<LaudoTecnico | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    getLaudo(id)
      .then((data) => {
        if (active) {
          setLaudo(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          console.error(err)
          setError('Não foi possível carregar os dados do laudo para impressão.')
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    )
  }

  if (error || !laudo) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-900 text-white p-4">
        <p className="text-sm text-red-400 mb-4">{error || 'Laudo não encontrado.'}</p>
        <Button
          onClick={() => navigate('/laudos')}
          variant="outline"
          className="text-white border-slate-700 hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para listagem
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-2 sm:p-6 print:p-0 print:bg-white">
      <LaudoTecnicoPrintView laudo={laudo} onBack={() => navigate(-1)} />
    </div>
  )
}

export default LaudoPrint
