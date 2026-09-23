import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  Star,
  ExternalLink,
  Loader2,
  Phone,
  Wrench,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
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

interface StarOption {
  nota: number
  emoji: string
  label: string
}

const STAR_OPTIONS: StarOption[] = [
  { nota: 1, emoji: '😠', label: 'Ruim' },
  { nota: 2, emoji: '🙁', label: 'Regular' },
  { nota: 3, emoji: '😐', label: 'Bom' },
  { nota: 4, emoji: '😊', label: 'Muito bom' },
  { nota: 5, emoji: '🤩', label: 'Excelente' },
]

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
  const [showFeedbackInput, setShowFeedbackInput] = useState(false)

  // Nota selecionada atualmente (pode ser ajustada por toque enquanto não sai)
  const [selectedNota, setSelectedNota] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)

  // Referência para envio com debounce ou transição de tela
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Link de avaliação inválido.')
      setLoading(false)
      return
    }

    let isMounted = true
    getAvaliacaoPublica(token)
      .then((res) => {
        if (!isMounted) return
        setData(res)

        // Se o cliente já avaliou anteriormente, vai direto para a Tela 2 do resultado
        if (res.jaAvaliado && typeof res.nota === 'number') {
          setSelectedNota(res.nota)
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
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current)
      }
    }
  }, [token])

  // Registro no toque: clicar na estrela grava imediatamente
  // Permite corrigir se tocar em outra estrela (última-escrita-vence)
  const handleSelectNota = (nota: number) => {
    if (!token || result) return

    setSelectedNota(nota)
    setSubmitting(true)

    // Cancela eventual timer anterior se o usuário tocou rápido em outra estrela
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current)
    }

    // Grava imediatamente no backend
    submitAvaliacaoPublica(token, nota, feedback)
      .then((res) => {
        // Transição suave para a Tela 2 após breve feedback visual do toque
        submitTimeoutRef.current = setTimeout(() => {
          setResult(res)
          setSubmitting(false)
        }, 350)
      })
      .catch((err: any) => {
        setSubmitting(false)
        setError(err.message || 'Erro ao registrar sua avaliação. Tente novamente.')
      })
  }

  // Enviar feedback complementar opcional
  const handleSaveFeedback = async () => {
    if (!token || !result || savingFeedback || !feedback.trim()) return
    setSavingFeedback(true)
    try {
      await submitAvaliacaoPublica(token, result.nota, feedback.trim())
      setFeedbackSaved(true)
    } catch {
      /* ignore */
    } finally {
      setSavingFeedback(false)
    }
  }

  // Telefone para ligar
  const primaryPhone = COMPANY_DATA.telefonesArray[0] || COMPANY_DATA.telefones
  const phoneDigits = primaryPhone.replace(/\D/g, '')

  // 1. Tela de Carregando
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Carregando avaliação...</p>
        </div>
      </div>
    )
  }

  // 2. Tela de Erro / Link inválido ou expirado
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-slate-200 shadow-xl overflow-hidden text-center bg-white">
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
              <a
                href={`tel:${phoneDigits}`}
                className="font-semibold text-indigo-600 hover:underline mt-1 inline-block"
              >
                {primaryPhone}
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentNota = result?.nota ?? selectedNota
  const isSatisfied = currentNota !== null ? currentNota >= 4 : false
  const googleUrl =
    result?.googleReviewUrl || data.googleReviewUrl || 'https://g.page/r/CfKb0UxVRFNsEAI/review'

  // Nome do técnico para tela 0 a 3 ("O [nome do técnico] vai te ligar em breve")
  const techDisplay = data.technicianName?.trim()
    ? `O técnico ${data.technicianName.trim()}`
    : 'Nosso técnico'

  // =========================================================================
  // TELA 2 — APÓS O TOQUE (OU SE JÁ AVALIADO)
  // =========================================================================
  if (result) {
    // RAMIFICAÇÃO A: NOTA 4 OU 5 → TELA VERDE COMEMORATIVA COM BOTÃO GIGANTE DO GOOGLE
    if (isSatisfied) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-500 via-emerald-600 to-teal-700 flex flex-col justify-between py-8 px-4 text-white">
          <div className="max-w-md w-full mx-auto my-auto space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
            {/* Chip topo */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-white text-xs font-bold border border-white/30 shadow-xs">
              <Wrench className="h-3.5 w-3.5" />
              <span>JUCA INFORMÁTICA</span>
            </div>

            {/* Ícone de Sucesso */}
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-60" />
              <div className="relative rounded-full bg-white text-emerald-600 p-4 shadow-2xl flex items-center justify-center">
                <CheckCircle2 className="h-16 w-16" />
              </div>
            </div>

            {/* Agradecimento curto */}
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                Muito obrigado, {data.firstName}! 😊
              </h1>
              <p className="text-emerald-100 text-sm max-w-xs mx-auto">
                Sua nota {currentNota} de 5 foi registrada com sucesso!
              </p>
            </div>

            {/* Botão Gigante Avaliar no Google */}
            <div className="pt-2 space-y-3">
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-center justify-center gap-3 w-full bg-white hover:bg-slate-50 text-slate-900 font-black text-base sm:text-lg py-5 px-6 rounded-2xl shadow-2xl hover:shadow-emerald-950/40 active:scale-98 transition-all border-2 border-white"
              >
                <div className="flex items-center gap-1 text-amber-400">
                  <Star className="h-6 w-6 fill-amber-400" />
                </div>
                <span>Avaliar no Google</span>
                <ExternalLink className="h-5 w-5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </a>

              <p className="text-xs text-emerald-100/90 font-medium flex items-center justify-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Leva apenas 30 segundos</span>
              </p>
            </div>

            {/* Link discreto opcional para deixar comentário */}
            <div className="pt-4 border-t border-white/20 text-center">
              {!showFeedbackInput && !feedbackSaved ? (
                <button
                  type="button"
                  onClick={() => setShowFeedbackInput(true)}
                  className="text-xs text-emerald-100 hover:text-white underline underline-offset-4 font-medium transition-colors cursor-pointer"
                >
                  Quer deixar um recado? (opcional)
                </button>
              ) : feedbackSaved ? (
                <p className="text-xs text-emerald-100 font-semibold">
                  ✓ Recado gravado! Obrigado!
                </p>
              ) : (
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 space-y-2 text-left border border-white/20 animate-in fade-in duration-200">
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Escreva seu recado ou elogio aqui..."
                    rows={2}
                    className="text-xs bg-white text-slate-900 resize-none border-white/40 focus:border-white placeholder:text-slate-400"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFeedbackInput(false)}
                      className="text-xs text-emerald-100 hover:text-white px-2 py-1"
                    >
                      Cancelar
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveFeedback}
                      disabled={savingFeedback || !feedback.trim()}
                      className="h-7 text-xs font-bold bg-white text-emerald-700 hover:bg-emerald-50"
                    >
                      {savingFeedback ? 'Enviando...' : 'Gravar Recado'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Rodapé discreto */}
          <div className="text-center text-[11px] text-emerald-100/70 pt-4">
            JUCA INFORMÁTICA • {COMPANY_DATA.telefonesArray[0]}
          </div>
        </div>
      )
    }

    // RAMIFICAÇÃO B: NOTA 0 A 3 → TELA SÓBRIA COM BOTÃO DE LIGAR
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between py-8 px-4 text-slate-800">
        <div className="max-w-md w-full mx-auto my-auto space-y-6 text-center animate-in fade-in duration-300">
          {/* Chip topo */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 shadow-xs">
            <Wrench className="h-3.5 w-3.5 text-slate-600" />
            <span>JUCA INFORMÁTICA</span>
          </div>

          {/* Card sóbrio central */}
          <Card className="border-slate-300 shadow-lg bg-white overflow-hidden text-center">
            <CardContent className="p-6 sm:p-8 space-y-5">
              <div className="h-16 w-16 rounded-full bg-slate-100 text-slate-600 mx-auto flex items-center justify-center border border-slate-200">
                <Phone className="h-8 w-8 text-slate-700" />
              </div>

              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Obrigado pela sinceridade.
                </h1>
                <p className="text-slate-600 text-sm leading-relaxed max-w-sm mx-auto">
                  {techDisplay} vai te ligar em breve 📞
                </p>
              </div>

              {/* Botão de Ligar */}
              <div className="pt-2">
                <Button
                  type="button"
                  size="lg"
                  asChild
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-base h-14 rounded-xl shadow-md gap-2"
                >
                  <a href={`tel:${phoneDigits}`}>
                    <Phone className="h-5 w-5" />
                    <span>Ligar para a JUCA: {primaryPhone}</span>
                  </a>
                </Button>
              </div>

              {/* Link discreto para recado opcional */}
              <div className="pt-2 border-t border-slate-100">
                {!showFeedbackInput && !feedbackSaved ? (
                  <button
                    type="button"
                    onClick={() => setShowFeedbackInput(true)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-4 transition-colors cursor-pointer"
                  >
                    Deixe um recado (opcional)
                  </button>
                ) : feedbackSaved ? (
                  <p className="text-xs text-emerald-600 font-semibold">
                    ✓ Seu recado foi salvo no histórico.
                  </p>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-left border border-slate-200 animate-in fade-in duration-200">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Conte o que aconteceu (opcional):
                    </label>
                    <Textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Escreva aqui seu comentário ou sugestão..."
                      rows={2}
                      className="text-xs bg-white text-slate-900 resize-none border-slate-300"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setShowFeedbackInput(false)}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveFeedback}
                        disabled={savingFeedback || !feedback.trim()}
                        className="h-8 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white"
                      >
                        {savingFeedback ? 'Enviando...' : 'Salvar Recado'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rodapé institucional */}
        <div className="text-center text-[11px] text-slate-500 pt-4">
          JUCA INFORMÁTICA • {COMPANY_DATA.razaoSocial}
        </div>
      </div>
    )
  }

  // =========================================================================
  // TELA 1 — AVALIAR: 5 ESTRELAS GRANDES CLICÁVEIS QUE REGISTRAM NO TOQUE
  // QUASE ZERO TEXTO, SEM NÚMERO DE O.S., SEM EQUIPAMENTO, SEM TÉCNICO
  // =========================================================================
  const displayRating = hoverRating ?? selectedNota ?? 0

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-6 px-4">
      <div className="max-w-md w-full mx-auto my-auto space-y-6">
        {/* Cabeçalho mínimo: Chip + Título + Olá, {Cliente}! 😊 */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold shadow-2xs">
            <Wrench className="h-3.5 w-3.5 text-indigo-700" />
            <span>🔧 JUCA INFORMÁTICA</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Avaliação de Atendimento
          </h1>

          <p className="text-lg font-bold text-slate-700">Olá, {data.firstName}! 😊</p>
        </div>

        {/* Card das 5 Estrelas Grandes */}
        <Card className="border-slate-200 shadow-xl bg-white overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-6 text-center">
            {/* 5 Estrelas Grandes Clicáveis */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 py-2">
              {STAR_OPTIONS.map((item) => {
                const isFilled = displayRating >= item.nota
                const isSelected = selectedNota === item.nota

                return (
                  <button
                    key={item.nota}
                    type="button"
                    disabled={submitting}
                    onMouseEnter={() => setHoverRating(item.nota)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => handleSelectNota(item.nota)}
                    aria-label={`${item.nota} estrelas - ${item.label}`}
                    className={`group relative flex flex-col items-center justify-center p-2 sm:p-3 rounded-2xl transition-all active:scale-90 cursor-pointer select-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      isSelected
                        ? 'bg-amber-50 scale-110 shadow-md ring-2 ring-amber-400'
                        : 'hover:bg-slate-50'
                    } ${submitting ? 'cursor-wait' : ''}`}
                  >
                    <Star
                      className={`h-11 w-11 sm:h-14 sm:w-14 transition-all duration-150 ${
                        isFilled
                          ? 'fill-amber-400 text-amber-400 drop-shadow-sm scale-105'
                          : 'fill-transparent text-slate-300 group-hover:text-amber-200'
                      }`}
                    />
                    {/* Carinha/expressão embaixo de cada estrela */}
                    <span className="text-lg sm:text-xl mt-1 select-none transition-transform group-hover:scale-125">
                      {item.emoji}
                    </span>
                    <span
                      className={`text-[10px] sm:text-xs font-bold mt-0.5 tracking-tight ${
                        isSelected
                          ? 'text-amber-700'
                          : isFilled
                            ? 'text-slate-700'
                            : 'text-slate-400'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Feedback visual sutil enquanto grava */}
            <div className="min-h-[24px] flex items-center justify-center">
              {submitting ? (
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Gravando sua nota...</span>
                </div>
              ) : selectedNota ? (
                <p className="text-xs text-slate-500 font-medium">
                  Nota {selectedNota} de 5 selecionada
                </p>
              ) : (
                <p className="text-xs text-slate-400 font-medium">Toque na estrela para avaliar</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rodapé institucional com telefones JUCA */}
      <div className="text-center text-[11px] text-slate-400 pt-4">
        JUCA INFORMÁTICA • Nova Andradina - MS
      </div>
    </div>
  )
}
