import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Star,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageSquareHeart,
  Loader2,
  Phone,
  Wrench,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  getAvaliacaoPublica,
  submitAvaliacaoPublica,
  PublicAvaliacaoData,
  SubmitAvaliacaoResult,
} from '@/services/avaliacao_publica'
import { COMPANY_DATA } from '@/lib/company'

export default function AvaliacaoPublica() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PublicAvaliacaoData | null>(null)
  const [result, setResult] = useState<SubmitAvaliacaoResult | null>(null)

  // Feedback escrito opcional
  const [feedback, setFeedback] = useState('')
  const [feedbackSaved, setFeedbackSaved] = useState(false)
  const [savingFeedback, setSavingFeedback] = useState(false)

  // Hover visual nas estrelas/botões
  const [hoverRating, setHoverRating] = useState<number | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Link de avaliação inválido.')
      setLoading(false)
      return
    }

    let isMounted = true
    getAvaliacaoPublica(token)
      .then((res) => {
        if (isMounted) {
          setData(res)
          if (res.jaAvaliado && typeof res.nota === 'number') {
            setResult({
              alreadyEvaluated: true,
              nota: res.nota,
              statusFunil: res.statusFunil,
              isSatisfied: res.nota >= 4,
              googleReviewUrl: res.googleReviewUrl,
              customerName: res.customerName,
              orderNumber: res.orderNumber,
              message:
                res.nota >= 4
                  ? 'Você já avaliou este atendimento! Muito obrigado pelo carinho!'
                  : 'Sua avaliação foi registrada. Nossa equipe está à disposição!',
            })
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Não foi possível carregar a avaliação.')
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [token])

  // Ao clicar na nota: registra sozinho na hora, 100% automático
  const handleSelectNota = async (nota: number) => {
    if (!token || submitting || result) return

    setSubmitting(true)
    try {
      const res = await submitAvaliacaoPublica(token, nota, feedback)
      setResult(res)
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar sua avaliação. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // Enviar feedback complementar se o cliente desejar
  const handleSaveFeedback = async () => {
    if (!token || !result || savingFeedback) return
    setSavingFeedback(true)
    try {
      await submitAvaliacaoPublica(token, result.nota, feedback)
      setFeedbackSaved(true)
    } catch {
      /* ignore */
    } finally {
      setSavingFeedback(false)
    }
  }

  // Tela de Carregando
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/20 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Carregando avaliação...</p>
        </div>
      </div>
    )
  }

  // Tela de Erro / Link inválido
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-slate-200 shadow-xl overflow-hidden text-center">
          <div className="bg-red-500 h-2 w-full" />
          <CardContent className="p-6 sm:p-8 space-y-4">
            <div className="h-14 w-14 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Link Não Encontrado</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {error || 'Este link de avaliação é inválido ou já foi encerrado.'}
            </p>
            <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
              Dúvidas? Entre em contato com a <strong>JUCA Informática</strong>:
              <br />
              <span className="font-semibold text-slate-700">
                {COMPANY_DATA.telefonesArray[0] || COMPANY_DATA.telefones}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentNota = result?.nota ?? null
  const isSatisfied = currentNota !== null ? currentNota >= 4 : false
  const googleUrl =
    result?.googleReviewUrl || data.googleReviewUrl || 'https://g.page/r/CfKb0UxVRFNsEAI/review'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/30 to-slate-100 flex flex-col justify-between py-6 px-4 sm:px-6">
      <div className="max-w-lg w-full mx-auto space-y-5">
        {/* Topo com Identidade JUCA */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100/80 border border-indigo-200 text-indigo-900 text-xs font-bold shadow-xs">
            <Wrench className="h-3.5 w-3.5 text-indigo-700" />
            <span>JUCA INFORMÁTICA</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight pt-1">
            Avaliação de Atendimento
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Sua opinião é fundamental para nossa constante evolução!
          </p>
        </div>

        {/* Card Principal */}
        <Card className="border-slate-200 shadow-xl overflow-hidden bg-white/95 backdrop-blur-sm">
          {/* Faixa decorativa dinâmica */}
          <div
            className={`h-2 w-full transition-colors ${
              result
                ? isSatisfied
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500'
                  : 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500'
                : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500'
            }`}
          />

          <CardContent className="p-5 sm:p-7 space-y-6">
            {/* Saudação e contexto do atendimento */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-xs space-y-1.5 text-slate-700">
              <p className="font-bold text-slate-900 text-sm">Olá, {data.firstName}! 😊</p>
              <p className="leading-relaxed text-slate-600">
                Seu atendimento{' '}
                {data.orderNumber ? (
                  <strong className="text-indigo-700 font-mono">(O.S. #{data.orderNumber})</strong>
                ) : (
                  'recente'
                )}{' '}
                {data.technicianName && (
                  <>
                    foi realizado pelo técnico{' '}
                    <strong className="text-slate-800">{data.technicianName}</strong>.
                  </>
                )}
                {data.equipment && (
                  <>
                    {' '}
                    Equipamento: <strong className="text-slate-800">{data.equipment}</strong>.
                  </>
                )}
              </p>
            </div>

            {/* SEÇÃO 1: PERGUNTA DE NOTA 0 A 5 */}
            {!result ? (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-sm sm:text-base font-extrabold text-slate-900">
                    De 0 a 5, como você avalia o atendimento que recebeu?
                  </p>
                  <p className="text-xs text-slate-500">
                    Toque na sua nota abaixo. O registro é imediato:
                  </p>
                </div>

                {/* Botoeira grande e acessível mobile-first (0 a 5) */}
                <div className="grid grid-cols-6 gap-1.5 sm:gap-2 pt-1">
                  {[0, 1, 2, 3, 4, 5].map((notaVal) => {
                    const isHovered = hoverRating !== null && hoverRating >= notaVal && notaVal > 0
                    const isHigh = notaVal >= 4

                    return (
                      <button
                        key={notaVal}
                        type="button"
                        disabled={submitting}
                        onMouseEnter={() => setHoverRating(notaVal)}
                        onMouseLeave={() => setHoverRating(null)}
                        onClick={() => handleSelectNota(notaVal)}
                        className={`flex flex-col items-center justify-center rounded-xl py-3 px-1 transition-all active:scale-95 border cursor-pointer select-none ${
                          isHovered
                            ? isHigh
                              ? 'bg-emerald-50 border-emerald-400 shadow-md ring-2 ring-emerald-300'
                              : 'bg-amber-50 border-amber-400 shadow-md ring-2 ring-amber-300'
                            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-xs'
                        } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span
                          className={`text-lg sm:text-2xl font-black font-mono transition-colors ${
                            isHigh
                              ? 'text-emerald-600'
                              : notaVal === 0
                                ? 'text-red-600'
                                : 'text-slate-700'
                          }`}
                        >
                          {notaVal}
                        </span>
                        <div className="mt-1 flex items-center justify-center">
                          {notaVal === 0 ? (
                            <span className="text-[10px] font-bold text-red-500 uppercase">
                              Zero
                            </span>
                          ) : (
                            <Star
                              className={`h-4 w-4 ${
                                isHigh
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'fill-amber-300/50 text-amber-400'
                              }`}
                            />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {submitting && (
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-indigo-700 pt-2 animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Registrando sua nota com sucesso...</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1 font-medium">
                  <span className="text-red-500 font-bold">0 = Não gostei</span>
                  <span className="text-amber-600">3 = Regular</span>
                  <span className="text-emerald-600 font-bold">5 = Excelente</span>
                </div>
              </div>
            ) : (
              /* SEÇÃO 2: PÓS-REGISTRO — RESPOSTA AUTOMÁTICA NA MESMA TELA */
              <div className="space-y-5 animate-in fade-in duration-300">
                {/* Nota Confirmada */}
                <div className="text-center space-y-2">
                  <div
                    className={`inline-flex items-center justify-center h-16 w-16 rounded-full mx-auto shadow-md ${
                      isSatisfied
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-amber-100 text-amber-600'
                    }`}
                  >
                    {isSatisfied ? (
                      <CheckCircle2 className="h-9 w-9" />
                    ) : (
                      <MessageSquareHeart className="h-8 w-8" />
                    )}
                  </div>

                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                      Sua Nota:{' '}
                      <strong className={isSatisfied ? 'text-emerald-600' : 'text-amber-600'}>
                        {currentNota} de 5
                      </strong>
                    </span>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-2">
                      {isSatisfied
                        ? 'Que alegria ter você conosco!'
                        : 'Obrigado pela sua sinceridade!'}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto mt-1 leading-relaxed">
                      {result.message}
                    </p>
                  </div>
                </div>

                {/* RAMIFICAÇÃO A: NOTA 4 OU 5 — PEDIDO DO GOOGLE NA MESMA TELA (100% AUTOMÁTICO) */}
                {isSatisfied && (
                  <div className="bg-gradient-to-br from-emerald-50 via-teal-50/60 to-sky-50 p-4 sm:p-5 rounded-2xl border-2 border-emerald-400/80 shadow-md space-y-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="h-5 w-5 fill-amber-400" />
                      ))}
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center justify-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        Poderia nos avaliar no Google?
                      </h3>
                      <p className="text-xs text-slate-700 leading-relaxed max-w-md mx-auto">
                        Sua opinião pública no <strong>Google Meu Negócio</strong> ajuda novos
                        clientes a confiarem no trabalho da nossa equipe técnica. Leva só 30
                        segundos!
                      </p>
                    </div>

                    <div className="pt-1">
                      <Button
                        type="button"
                        size="lg"
                        asChild
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm h-12 shadow-lg shadow-emerald-600/30 rounded-xl gap-2 active:scale-98 transition-all"
                      >
                        <a href={googleUrl} target="_blank" rel="noopener noreferrer">
                          <Star className="h-4 w-4 fill-white" />
                          <span>Avaliar 5 Estrelas no Google</span>
                          <ExternalLink className="h-4 w-4 ml-1" />
                        </a>
                      </Button>
                    </div>

                    <p className="text-[11px] text-emerald-900/70 font-medium">
                      O botão abre diretamente a página oficial de avaliações da JUCA Informática.
                    </p>
                  </div>
                )}

                {/* RAMIFICAÇÃO B: NOTA 0 A 3 — MENSAGEM EMPÁTICA E CONTATO IMEDIATO */}
                {!isSatisfied && (
                  <div className="bg-amber-50/90 p-4 sm:p-5 rounded-2xl border-2 border-amber-300 shadow-sm space-y-3 text-center">
                    <div className="space-y-1">
                      <h3 className="text-sm sm:text-base font-bold text-amber-950">
                        Nossa equipe já foi notificada
                      </h3>
                      <p className="text-xs text-amber-900 leading-relaxed max-w-md mx-auto">
                        Sentimos muito que o atendimento não tenha superado todas as suas
                        expectativas. O responsável entrará em contato em breve para entender
                        detalhadamente o ocorrido e garantir a solução definitiva.
                      </p>
                    </div>

                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        asChild
                        className="h-10 text-xs font-bold gap-1.5 border-amber-300 text-amber-900 bg-white hover:bg-amber-100 rounded-xl"
                      >
                        <a href={`tel:${COMPANY_DATA.telefonesArray[0].replace(/\D/g, '')}`}>
                          <Phone className="h-3.5 w-3.5 text-amber-700" />
                          <span>Falar direto conosco: {COMPANY_DATA.telefonesArray[0]}</span>
                        </a>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Campo opcional de comentário/elogio/crítica complementar */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-800 block">
                    Quer deixar uma mensagem ou detalhe a mais? (Opcional)
                  </label>
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Escreva aqui seu comentário sobre o atendimento, rapidez ou sugestão..."
                    rows={3}
                    disabled={feedbackSaved}
                    className="text-xs bg-white resize-none"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      {feedbackSaved
                        ? '✓ Mensagem gravada!'
                        : 'Seu comentário fica salvo no histórico.'}
                    </span>
                    {!feedbackSaved && feedback.trim() && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveFeedback}
                        disabled={savingFeedback}
                        className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        {savingFeedback ? 'Enviando...' : 'Enviar Comentário'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rodapé institucional com telefones JUCA */}
        <div className="text-center space-y-1 text-slate-500 text-xs pt-2">
          <p className="font-semibold text-slate-700">{COMPANY_DATA.razaoSocial}</p>
          <p className="text-[11px]">{COMPANY_DATA.telefones}</p>
          <p className="text-[10px] text-slate-400">{COMPANY_DATA.endereco}</p>
        </div>
      </div>
    </div>
  )
}
