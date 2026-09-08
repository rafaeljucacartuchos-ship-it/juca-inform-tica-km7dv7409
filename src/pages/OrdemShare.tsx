import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  CheckCircle,
  Loader2,
  Pen,
  Printer,
  Star,
  Heart,
  ThumbsUp,
  AlertCircle,
  ExternalLink,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { SignaturePad } from '@/components/SignaturePad'
import { COMPANY_DATA } from '@/lib/company'
import pb from '@/lib/pocketbase/client'
import { PrintOrderDocument } from '@/components/PrintOrderDocument'
import type {
  ServiceOrder,
  ServiceOrderItem,
  ServiceAttachment,
  Orcamento,
  OrcamentoItem,
  OrcamentoAnexo,
} from '@/types'

interface ShareItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

interface EvaluationData {
  id: string
  rating: number
  satisfaction: string
  feedback: string
  created: string
}

interface ShareData {
  id: string
  number: string
  status: string
  priority: string
  title: string
  description: string
  equipment: string
  service_report: string
  total: number
  created: string
  customer_signature: string
  technician_signature: string
  customer: {
    name: string
    phone: string
    street: string
    number: string
    city: string
    state: string
    zip: string
  } | null
  technician: { id?: string; name: string; phone: string } | null
  items: ShareItem[]
  status_history: Array<{
    status: string
    note: string
    changed_by: string
    created: string
  }>
  attachments: Array<{
    id: string
    file: string
    caption: string
  }>
  evaluation?: EvaluationData | null
  // Dados enriquecidos retornados pelo endpoint
  attendance_date?: string
  attendance_time?: string
  started_at?: string
  equipment_ref?: string
  desconto?: number
  acrescimo?: number
  attendance_type_data?: { id: string; name: string } | null
  equipment_data?: {
    id: string
    name: string
    type?: string
    brand?: string
    model?: string
    serial_number?: string
    notes?: string
    photos?: string[]
  } | null
  orcamento?: Orcamento | null
  orcamento_itens?: OrcamentoItem[]
  orcamento_anexos?: OrcamentoAnexo[]
}

const satisfactionOptions = [
  {
    value: 'nao_gostei',
    label: 'Não gostei',
    icon: AlertCircle,
    color: 'text-rose-500 bg-rose-50 border-rose-200',
  },
  {
    value: 'pode_melhorar',
    label: 'Pode melhorar',
    icon: AlertCircle,
    color: 'text-amber-500 bg-amber-50 border-amber-200',
  },
  { value: 'bom', label: 'Bom', icon: ThumbsUp, color: 'text-blue-500 bg-blue-50 border-blue-200' },
  {
    value: 'excelente',
    label: 'Excelente',
    icon: Heart,
    color: 'text-emerald-500 bg-emerald-50 border-emerald-200',
  },
]

export default function OrdemShare() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signed, setSigned] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form states for satisfaction survey
  const [rating, setRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [satisfaction, setSatisfaction] = useState<string>('excelente')
  const [feedback, setFeedback] = useState<string>('')
  const [submittingEval, setSubmittingEval] = useState<boolean>(false)
  const [evalSubmitted, setEvalSubmitted] = useState<boolean>(false)
  const [evalError, setEvalError] = useState<string>('')

  const googleReviewUrl = 'https://g.page/r/CfKb0UxVRFNsEAI/review'

  useEffect(() => {
    if (!id) return
    pb.send(`/backend/v1/os/${id}/share`, { method: 'GET' })
      .then((d: ShareData) => {
        setData(d)
        setSigned(!!d.customer_signature)
        if (d.evaluation) {
          setEvalSubmitted(true)
        }
      })
      .catch(() => setError('Não foi possível carregar esta ordem de serviço.'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSign = async (dataUrl: string) => {
    if (!id) return
    setSaving(true)
    setError('')
    try {
      // O SignaturePad agora entrega uma string base64 (data URL) via
      // canvas.toDataURL('image/png'). Enviamos a assinatura como JSON
      // (Content-Type: application/json) em vez de multipart/form-data.
      //
      // Motivo: o fluxo anterior (canvas.toBlob -> new File -> FormData ->
      // multipart) perdia o tipo MIME image/png em alguns navegadores móveis
      // (Samsung Internet, Chrome antigo, Safari iOS), e o backend recebia o
      // arquivo com MIME vazio ("") e o rejeitava. Base64 é uma string pura e
      // funciona de forma idêntica em TODOS os navegadores, sem exceção. O
      // backend decodifica a string e cria o arquivo com MIME definido no
      // servidor, onde temos controle total.
      const baseUrl = import.meta.env.VITE_POCKETBASE_URL
      const res = await fetch(`${baseUrl}/backend/v1/os/${id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: dataUrl }),
      })

      if (!res.ok) {
        let msg = 'Erro ao salvar assinatura. Tente novamente.'
        try {
          const data = await res.json()
          if (data?.error) msg = data.error
          else if (data?.message) msg = data.message
        } catch (_) {
          // resposta sem corpo JSON — mantém a mensagem padrão
        }
        throw new Error(msg)
      }

      setSigned(true)
      const fresh: ShareData = await pb.send(`/backend/v1/os/${id}/share`, { method: 'GET' })
      setData(fresh)
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Erro ao salvar assinatura. Tente novamente.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSubmittingEval(true)
    setEvalError('')

    try {
      const res = await pb.send(`/backend/v1/os/${id}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({
          rating,
          satisfaction,
          feedback,
        }),
      })

      if (res.success) {
        setEvalSubmitted(true)
        const fresh: ShareData = await pb.send(`/backend/v1/os/${id}/share`, { method: 'GET' })
        setData(fresh)
      } else {
        throw new Error(res.error || 'Erro ao enviar avaliação.')
      }
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Não foi possível enviar a avaliação.')
    } finally {
      setSubmittingEval(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
            <p className="text-sm font-medium text-slate-700">{error}</p>
            <p className="text-xs text-slate-500">
              Verifique se o link está correto ou entre em contato com o suporte da assistência
              técnica.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  // Mapeia os dados recebidos de `data` para o modelo `ServiceOrder` esperado por `PrintOrderDocument`
  const mappedOrder: ServiceOrder = {
    id: data.id,
    number: data.number,
    customer: data.customer?.name || 'share_customer',
    title: data.title,
    description: data.description,
    status: data.status as any,
    priority: data.priority as any,
    equipment: data.equipment,
    service_report: data.service_report,
    total: data.total,
    desconto: data.desconto,
    acrescimo: data.acrescimo,
    customer_signature: data.customer_signature,
    technician_signature: data.technician_signature,
    attendance_date: data.attendance_date,
    attendance_time: data.attendance_time,
    started_at: data.started_at,
    created: data.created,
    updated: data.created,
    expand: {
      customer: data.customer
        ? ({
            id: 'share_customer',
            name: data.customer.name,
            phone: data.customer.phone,
            street: data.customer.street,
            number: data.customer.number,
            city: data.customer.city,
            state: data.customer.state,
            zip: data.customer.zip,
          } as any)
        : undefined,
      technician: data.technician
        ? ({
            id: data.technician.id || 'share_tech',
            name: data.technician.name,
            phone: data.technician.phone,
          } as any)
        : undefined,
      attendance_type: data.attendance_type_data
        ? ({
            id: data.attendance_type_data.id,
            name: data.attendance_type_data.name,
          } as any)
        : undefined,
      equipment_ref: data.equipment_data
        ? ({
            id: data.equipment_data.id,
            name: data.equipment_data.name,
            type: data.equipment_data.type,
            brand: data.equipment_data.brand,
            model: data.equipment_data.model,
            serial_number: data.equipment_data.serial_number,
            notes: data.equipment_data.notes,
            photos: data.equipment_data.photos || [],
          } as any)
        : undefined,
    },
  }

  const mappedItems: ServiceOrderItem[] = (data.items || []).map((it, idx) => ({
    id: `item_${idx}`,
    service_order: data.id,
    description: it.description,
    quantity: it.quantity,
    unit_price: it.unit_price,
    total: it.total,
    created: data.created,
    updated: data.created,
  }))

  const mappedAttachments: ServiceAttachment[] = (data.attachments || []).map((a) => ({
    id: a.id,
    service_order: data.id,
    file: a.file,
    caption: a.caption,
    created: data.created,
    updated: data.created,
  }))

  return (
    <div className="min-h-screen bg-slate-100/70 py-4 px-2 sm:px-4 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Barra superior de ações no visualizador público */}
        <div className="no-print flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2 py-1 rounded">
              OS {data.number}
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Documento Oficial JUCA Informática
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => window.print()}
              className="gap-2 bg-blue-600 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
            >
              <Printer className="h-4 w-4" /> Imprimir / Salvar PDF (1 Pág)
            </Button>
          </div>
        </div>

        {/* DOCUMENTO OFICIAL A4 COMPACTADO (EXATAMENTE O MESMO DO SISTEMA/PDF) */}
        <div className="overflow-x-auto print:overflow-visible">
          <PrintOrderDocument
            order={mappedOrder}
            items={mappedItems}
            attachments={mappedAttachments}
            orcamento={data.orcamento || null}
            orcamentoItens={data.orcamento_itens || []}
            orcamentoAnexos={data.orcamento_anexos || []}
            hideActions={true}
          />
        </div>

        {/* COLETAR ASSINATURA DO CLIENTE SE AINDA NÃO ASSINOU */}
        {!signed && (
          <Card className="no-print border-emerald-200 bg-emerald-50/40 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Pen className="h-4 w-4 text-emerald-600" />
                Assinatura do Cliente
              </CardTitle>
              <CardDescription className="text-xs text-slate-600">
                Por favor, confirme o recebimento do seu equipamento e a aprovação do serviço
                assinando abaixo:
              </CardDescription>
            </CardHeader>
            <CardContent>
              {saving ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                </div>
              ) : (
                <div className="space-y-2">
                  {error && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      {error}
                    </p>
                  )}
                  <SignaturePad onConfirm={handleSign} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* PESQUISA DE SATISFAÇÃO E GOOGLE REVIEW */}
        <Card className="border-indigo-100 shadow-sm bg-gradient-to-b from-indigo-50/50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  Pesquisa de Satisfação
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  Sua opinião é fundamental para melhorarmos continuamente nossos serviços.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {evalSubmitted || data.evaluation ? (
              <div className="space-y-4 text-center py-4 bg-white rounded-xl border border-indigo-100 p-4 shadow-2xs">
                <div className="flex justify-center">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Obrigado pelo seu feedback!</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Sua avaliação foi registrada com sucesso.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-1 text-amber-400 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= (data.evaluation?.rating || rating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  ))}
                </div>

                {/* Google Review Box */}
                <div className="mt-4 pt-4 border-t border-slate-100 text-left bg-indigo-50/60 p-3.5 rounded-lg border border-indigo-100">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-2xs font-bold text-sm shrink-0">
                      G
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900">
                        Avalie-nos também no Google!
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Gostou do atendimento? Que tal deixar uma avaliação em nossa página do
                        Google para ajudar outros clientes?
                      </p>
                      <a
                        href={googleReviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Deixar avaliação no Google
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitEvaluation} className="space-y-4">
                {evalError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {evalError}
                  </p>
                )}

                {/* Classificação com estrelas */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Como você avalia a qualidade geral do serviço?
                  </label>
                  <div className="flex items-center gap-1.5 py-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 rounded-md focus:outline-hidden hover:bg-amber-50 transition-colors"
                      >
                        <Star
                          className={`h-7 w-7 transition-all duration-150 ${
                            star <= (hoverRating || rating)
                              ? 'fill-amber-400 text-amber-400 scale-110'
                              : 'text-slate-300 hover:text-amber-200'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-xs font-bold font-mono text-slate-700">
                      {hoverRating || rating}/5
                    </span>
                  </div>
                </div>

                {/* Opções de nível de satisfação */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    O que achou do atendimento prestado?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {satisfactionOptions.map((opt) => {
                      const Icon = opt.icon
                      const isSelected = satisfaction === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSatisfaction(opt.value)}
                          className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                            isSelected
                              ? `${opt.color} ring-2 ring-indigo-500 shadow-2xs`
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Crítica Construtiva / Feedback */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Crítica Construtiva ou Comentários (Opcional):
                  </label>
                  <Textarea
                    placeholder="Conte-nos o que funcionou bem ou o que podemos melhorar em nossos serviços..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="text-xs bg-white border-slate-200 min-h-[80px]"
                  />
                </div>

                {/* Google Review Shortcut in Form */}
                <div className="bg-slate-100/80 p-3 rounded-lg flex items-center justify-between text-xs">
                  <div className="text-slate-600">
                    Também quer avaliar no Google?{' '}
                    <a
                      href={googleReviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                    >
                      Acesse o Google Review <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submittingEval}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-10 gap-2"
                >
                  {submittingEval ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Enviando avaliação...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Enviar Avaliação</span>
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-[11px] text-slate-400 pb-4">
          <p className="font-semibold text-slate-500">{COMPANY_DATA.razaoSocial}</p>
          <p>{COMPANY_DATA.endereco}</p>
          <p>Telefones: {COMPANY_DATA.telefones}</p>
        </div>
      </div>
    </div>
  )
}
