import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getPublicRentalQuote } from '@/services/rental'
import { RentalProposalPrintView } from '@/components/RentalProposalPrintView'
import { Printer, ShieldAlert, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RentalQuote } from '@/types'

export default function PropostaLocacaoPublica() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quote, setQuote] = useState<RentalQuote | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadQuote() {
      if (!id) {
        setError('Identificador da proposta não informado.')
        setLoading(false)
        return
      }

      if (!token) {
        setError(
          'Token de acesso não fornecido ou link inválido. Solicite um novo link à JUCA Informática.',
        )
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const data = await getPublicRentalQuote(id, token)
        if (!isMounted) return

        if (!data) {
          setError('Proposta de locação não encontrada ou token de acesso expirado/inválido.')
        } else {
          setQuote(data)
        }
      } catch (err: any) {
        if (!isMounted) return
        setError(err?.message || 'Erro ao carregar proposta de locação.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadQuote()

    return () => {
      isMounted = false
    }
  }, [id, token])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-sm w-full space-y-3">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto" />
          <h2 className="text-sm font-bold text-slate-900">Carregando Proposta de Locação...</h2>
          <p className="text-xs text-slate-500">
            Buscando as condições comerciais da JUCA Informática.
          </p>
        </div>
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-rose-200 text-center max-w-md w-full space-y-4">
          <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              Acesso Restrito / Proposta Não Encontrada
            </h2>
            <p className="text-xs text-slate-600">
              {error ||
                'Não foi possível carregar a proposta de locação. Verifique se o link foi copiado corretamente.'}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            Dúvidas? Entre em contato com a <strong>JUCA INFORMÁTICA</strong> pelo WhatsApp (67)
            99654-4981.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 py-4 sm:py-8 px-2 sm:px-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <RentalProposalPrintView quote={quote} isPublicView />
      </div>
    </div>
  )
}
