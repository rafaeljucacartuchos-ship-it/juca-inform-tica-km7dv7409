import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Calendar,
  User,
  Wrench,
  FileText,
  CreditCard,
  MessageCircle,
  Image as ImageIcon,
  Loader2,
  Lock,
  ArrowRight,
  Eye,
  X,
  Phone,
  Check,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { CompanyHeader } from '@/components/CompanyHeader'
import { PublicSignaturePadModal } from '@/components/PublicSignaturePadModal'
import { PropostaPrintDocument } from '@/components/PropostaPrintDocument'
import {
  getPropostaByToken,
  aprovarPropostaByToken,
  type PropostaData,
  type PropostaAnexo,
} from '@/services/proposta_publica'
import { buildOrcamentoAprovadoAgradecimentoMessage, openWhatsApp } from '@/lib/whatsapp'
import { COMPANY_DATA } from '@/lib/company'

const PB_URL = import.meta.env.VITE_POCKETBASE_URL

export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<PropostaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [redirectNotice, setRedirectNotice] = useState<string | null>(null)

  // Assinatura
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const [localSignatureUrl, setLocalSignatureUrl] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [approvalResult, setApprovalResult] = useState<{
    alreadyApproved?: boolean
    approvedNow?: boolean
    date?: string
    msg?: string
  } | null>(null)

  // Visualizador de foto em tela cheia
  const [fullscreenPhoto, setFullscreenPhoto] = useState<PropostaAnexo | null>(null)

  const loadProposta = async () => {
    if (!token) {
      setErrorMsg('Link de proposta inválido.')
      setLoading(false)
      return
    }
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await getPropostaByToken(token)

      // Redirecionamento automático se a proposta estiver substituída e existir uma versão mais recente
      if (
        res.status === 'substituido' &&
        res.versao_mais_recente?.token_acesso &&
        res.versao_mais_recente.token_acesso !== token
      ) {
        setRedirectNotice(
          `Você está vendo a versão mais recente desta proposta (${res.versao_mais_recente.numero_orcamento || ''}).`,
        )
        navigate(`/proposta/${res.versao_mais_recente.token_acesso}`, { replace: true })
        return
      }

      setData(res)
      if (res.status === 'aprovado' || res.status === 'faturado') {
        setApprovalResult({
          alreadyApproved: true,
          date: res.data_assinatura_cliente,
        })
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Proposta não encontrada ou expirada.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProposta()
  }, [token])

  // Se a proposta foi carregada e for substituída mas não redirecionou antes, tenta redirecionar se o token mudar
  useEffect(() => {
    if (
      data?.status === 'substituido' &&
      data?.versao_mais_recente?.token_acesso &&
      data.versao_mais_recente.token_acesso !== token
    ) {
      setRedirectNotice(
        `Você está vendo a versão mais recente desta proposta (${data.versao_mais_recente.numero_orcamento || ''}).`,
      )
      navigate(`/proposta/${data.versao_mais_recente.token_acesso}`, { replace: true })
    }
  }, [data, token, navigate])

  // Cálculo de vencimento
  const expiryInfo = useMemo(() => {
    if (!data?.created) return { isExpired: false, daysLeft: 15, hasValidExpiry: false }
    const cleanCreated = String(data.created).replace(' ', 'T')
    const createdDate = new Date(cleanCreated.endsWith('Z') ? cleanCreated : cleanCreated + 'Z')
    const createdTimestamp = createdDate.getTime()
    if (isNaN(createdTimestamp)) {
      return { isExpired: false, daysLeft: 15, hasValidExpiry: false }
    }
    const validadeDias =
      typeof data.validade === 'number' && !isNaN(data.validade) ? data.validade : 15
    const expiryDate = new Date(createdTimestamp + validadeDias * 24 * 60 * 60 * 1000)
    const now = new Date()
    const diffMs = expiryDate.getTime() - now.getTime()
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return {
      isExpired: !isNaN(daysLeft) && daysLeft <= 0,
      daysLeft: isNaN(daysLeft) ? null : Math.max(0, daysLeft),
      hasValidExpiry: !isNaN(daysLeft),
      expiryDateFormatted: isNaN(expiryDate.getTime())
        ? null
        : expiryDate.toLocaleDateString('pt-BR'),
    }
  }, [data])

  // Verificações de bloqueio
  const isApproved = data?.status === 'aprovado' || data?.status === 'faturado' || !!approvalResult
  const isSubstituido = data?.status === 'substituido'
  const isRejeitado = data?.status === 'rejeitado'
  const isExpired = expiryInfo.isExpired && !isApproved
  const canApprove =
    !isApproved && !isSubstituido && !isRejeitado && !isExpired && data?.status !== 'rascunho'

  const hasSignature = !!localSignatureUrl || !!data?.has_customer_signature

  // Cálculo de parcelas
  const numParcelas = Math.max(1, data?.parcelas || 1)
  const valorParcela = (data?.total_geral || 0) / numParcelas

  // Trata aprovação
  const handleAprovarProposta = async () => {
    if (!token || !canApprove || !hasSignature) return
    setApproving(true)
    try {
      const res = await aprovarPropostaByToken(token, localSignatureUrl || undefined)
      setApprovalResult({
        approvedNow: true,
        alreadyApproved: res.alreadyApproved,
        date: res.data_assinatura_cliente || new Date().toISOString(),
      })
      setData((prev) => (prev ? { ...prev, status: 'aprovado' } : prev))

      // Nota de arquitetura: A mensagem oficial de agradecimento da JUCA é disparada
      // pelo app do técnico (via realtime / fallback de 1 toque no painel JUCA).
      // Não fazemos o cliente enviar mensagem para ele mesmo aqui.
    } catch (err: any) {
      alert(err.message || 'Erro ao aprovar proposta. Tente novamente.')
    } finally {
      setApproving(false)
    }
  }

  const handleFalarComEquipeJuca = () => {
    // Permite que o cliente abra canal direto de atendimento com a JUCA Informática
    const phoneJuca = '5567996544981'
    const msg = `Olá! Acabei de aprovar a proposta do orçamento *${data?.numero_orcamento || ''}* referente à O.S. #${data?.os?.number || ''}. Aguardo orientações da equipe técnica!`
    openWhatsApp(phoneJuca, msg)
  }

  const handlePrint = () => {
    // Dispara a impressão imediatamente no mesmo tick / contexto de gesto de toque do usuário
    // Funciona perfeitamente em mobile (Safari iOS, Chrome Android) e desktop
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-semibold text-slate-700">
          Carregando proposta da JUCA Informática...
        </p>
        <p className="text-xs text-slate-400 mt-1">Aguarde um instante.</p>
      </div>
    )
  }

  if (errorMsg || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-rose-200 bg-white shadow-md text-center p-6 space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Proposta Indisponível</h1>
            <p className="text-xs text-slate-600 mt-2">
              {errorMsg || 'Não foi possível carregar a proposta com o link fornecido.'}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
            Entre em contato com a equipe JUCA Informática:
            <br />
            <strong>(67) 3441-4981</strong> | <strong>(67) 99654-4981</strong>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 pb-36 font-sans">
      {/* Documento A4 Unificado para Impressão (visível apenas na impressão @media print) */}
      <PropostaPrintDocument data={data} localSignatureUrl={localSignatureUrl} />

      {/* Top Banner Oficial JUCA (oculto na impressão) */}
      <div className="no-print bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <img
              src={COMPANY_DATA.logoUrl}
              alt="JUCA Informática"
              className="h-9 sm:h-10 object-contain rounded shrink-0"
            />
            <div className="min-w-0">
              <span className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight block truncate">
                {COMPANY_DATA.nomeFantasia}
              </span>
              <span className="text-[10px] text-slate-500 hidden sm:block truncate">
                {COMPANY_DATA.slogan} • Nova Andradina - MS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Botão de Imprimir Documento Unificado A4 */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              onTouchEnd={(e) => {
                // Previne delay em Safari iOS se necessário, mas o onClick já atende nativamente
                e.preventDefault()
                handlePrint()
              }}
              title="Imprimir proposta unificada A4 ou salvar em PDF"
              className="h-9 px-2.5 sm:px-3 text-xs font-semibold text-slate-700 hover:text-indigo-700 bg-white hover:bg-slate-50 border-slate-300 rounded-full shadow-2xs gap-1.5"
            >
              <Printer className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span>Imprimir</span>
            </Button>

            <a
              href={`tel:${COMPANY_DATA.telefonesArray[0].replace(/\D/g, '')}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-full h-9"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Falar com a JUCA</span>
              <span className="sm:hidden">Ligar</span>
            </a>
          </div>
        </div>
      </div>

      <main className="no-print max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* Aviso de redirecionamento para a versão mais recente */}
        {redirectNotice && (
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 shadow-xs flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{redirectNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setRedirectNotice(null)}
              className="text-blue-600 hover:text-blue-800 p-1 rounded-md"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Banner de Status Especial (Aprovado, Vencido, Substituído, Rejeitado) */}
        {isApproved && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-sm flex items-start gap-3">
            <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold">Proposta Aprovada! 🎉</h2>
              <p className="text-xs text-emerald-800 mt-0.5">
                {approvalResult?.date
                  ? `Esta proposta foi aprovada e assinada em ${new Date(
                      approvalResult.date,
                    ).toLocaleString('pt-BR')}.`
                  : 'Esta proposta já foi aprovada e está em execução pela equipe técnica.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleFalarComEquipeJuca}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 h-9"
                >
                  <MessageCircle className="h-4 w-4" />
                  Falar com a JUCA pelo WhatsApp
                </Button>
              </div>
            </div>
          </div>
        )}

        {isSubstituido && (
          <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 flex items-start gap-3">
            <Lock className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
            <div className="text-xs space-y-2">
              <strong className="block text-sm font-bold text-slate-900">
                Proposta Substituída
              </strong>
              <p>
                Uma nova versão atualizada deste orçamento foi gerada pela nossa equipe.
                {data.versao_mais_recente?.token_acesso
                  ? ' Clique no botão abaixo para abrir a versão mais recente.'
                  : ' Entre em contato para receber o novo link.'}
              </p>
              {data.versao_mais_recente?.token_acesso && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    navigate(`/proposta/${data.versao_mais_recente!.token_acesso}`)
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-8 px-3 rounded-lg gap-1.5"
                >
                  <span>
                    Ver Versão Mais Recente ({data.versao_mais_recente.numero_orcamento || 'Novo'})
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}

        {isRejeitado && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="block text-sm font-bold text-rose-950">
                Proposta Consta como Rejeitada
              </strong>
              {data.motivo_rejeicao
                ? `Motivo: "${data.motivo_rejeicao}"`
                : 'Esta proposta foi cancelada ou recusada.'}
            </div>
          </div>
        )}

        {isExpired && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="block text-sm font-bold text-amber-950">
                Prazo de Validade Vencido
              </strong>
              Esta proposta tinha validade de {data.validade || 15} dias e expirou em{' '}
              {expiryInfo.expiryDateFormatted}. Entre em contato para atualizar valores e
              disponibilidade de peças.
            </div>
          </div>
        )}

        {/* Cabeçalho da Proposta */}
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-5 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold text-indigo-300 tracking-wider uppercase">
                  Proposta Comercial de Serviços
                </span>
                <h1 className="text-xl sm:text-2xl font-black font-mono tracking-tight mt-0.5">
                  {data.numero_orcamento}
                </h1>
                {data.os?.number ? (
                  <p className="text-xs text-indigo-200 mt-1">Ordem de Serviço #{data.os.number}</p>
                ) : (
                  <p className="text-xs text-indigo-200 mt-1">Orçamento Independente</p>
                )}
              </div>

              <div className="flex flex-wrap sm:flex-col sm:items-end gap-2 text-xs">
                <Badge
                  className={`text-xs px-3 py-1 font-semibold ${
                    isApproved
                      ? 'bg-emerald-500 text-white border-0'
                      : isExpired || isRejeitado
                        ? 'bg-rose-500 text-white border-0'
                        : 'bg-amber-400 text-amber-950 border-0'
                  }`}
                >
                  {isApproved
                    ? 'Aprovada'
                    : isSubstituido
                      ? 'Substituída'
                      : isRejeitado
                        ? 'Rejeitada'
                        : isExpired
                          ? 'Vencida'
                          : 'Aguardando sua Aprovação'}
                </Badge>
                <span className="text-[11px] text-indigo-200 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Validade: {data.validade || 15} dias
                  {!isApproved &&
                    !isExpired &&
                    expiryInfo.hasValidExpiry &&
                    expiryInfo.daysLeft !== null && (
                      <span className="text-emerald-300 font-semibold">
                        ({expiryInfo.daysLeft}d restantes)
                      </span>
                    )}
                </span>
              </div>
            </div>
          </div>

          <CardContent className="p-4 sm:p-5 text-xs divide-y divide-slate-100 space-y-4">
            {/* Cliente & Técnico */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <span className="font-semibold text-slate-500 block">Cliente:</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">
                  {data.customer?.name || 'Cliente'}
                </p>
                {data.customer?.phone && (
                  <p className="text-slate-600 mt-0.5">Telefone: {data.customer.phone}</p>
                )}
                {data.customer?.city && (
                  <p className="text-slate-500 text-[11px]">
                    {data.customer.city}
                    {data.customer.state ? ` - ${data.customer.state}` : ''}
                  </p>
                )}
              </div>

              <div>
                <span className="font-semibold text-slate-500 block">
                  Atendimento & Responsável Técnico:
                </span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">
                  {data.technician?.name || 'Equipe JUCA Informática'}
                </p>
                <p className="text-slate-600 mt-0.5">
                  Emissão: {data.created ? new Date(data.created).toLocaleDateString('pt-BR') : '—'}
                </p>
              </div>
            </div>

            {/* Resumo Integrado da Ordem de Serviço */}
            <div className="pt-3">
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-100/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-indigo-700 shrink-0" />
                    <span className="font-bold text-indigo-950 text-xs uppercase tracking-wide">
                      Resumo da Ordem de Serviço
                    </span>
                  </div>
                  {data.os?.number && (
                    <Badge
                      variant="outline"
                      className="bg-white border-indigo-200 text-indigo-800 font-mono text-[11px]"
                    >
                      {data.os.number}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block">
                      Equipamento:
                    </span>
                    <p className="font-semibold text-slate-900 mt-0.5">
                      {data.equipment?.name || data.os?.equipment || 'Equipamento não especificado'}
                      {data.equipment?.brand ? ` • ${data.equipment.brand}` : ''}
                      {data.equipment?.model ? ` ${data.equipment.model}` : ''}
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block">
                      Técnico Responsável:
                    </span>
                    <p className="font-semibold text-slate-900 mt-0.5">
                      {data.technician?.name || 'JUCA Informática'}
                    </p>
                  </div>
                </div>

                {data.os?.description && (
                  <div className="bg-white/80 border border-indigo-100/70 p-2.5 rounded-lg text-xs">
                    <span className="font-semibold text-slate-700 block text-[11px] mb-1">
                      Defeito Relatado pelo Cliente:
                    </span>
                    <p className="text-slate-800 leading-relaxed">{data.os.description}</p>
                  </div>
                )}

                {(data.os?.service_report || data.os?.diagnostic) && (
                  <div className="bg-white/80 border border-emerald-100 p-2.5 rounded-lg text-xs">
                    <span className="font-semibold text-emerald-900 block text-[11px] mb-1">
                      Diagnóstico Técnico / Serviço Executado:
                    </span>
                    <p className="text-slate-800 leading-relaxed">
                      {data.os.service_report || data.os.diagnostic}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Itens e Peças */}
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="p-4 bg-slate-50 border-b border-slate-200">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>Peças, Produtos e Serviços Inclusos</span>
              <Badge variant="outline" className="text-xs">
                {data.items.length} {data.items.length === 1 ? 'item' : 'itens'}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {/* Visualização 1 (Mobile): Cartões Empilhados */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {data.items.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  Nenhum item adicionado a este orçamento.
                </div>
              ) : (
                data.items.map((it, idx) => (
                  <div key={it.id || idx} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 text-xs block">
                          {it.descricao}
                        </span>
                        <span className="text-[11px] text-slate-500 capitalize block mt-0.5">
                          {it.tipo} • {it.quantidade}x R${' '}
                          {(it.valor_unitario || 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 text-xs shrink-0">
                        R${' '}
                        {(it.valor_total_item || 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    {it.desconto_item && it.desconto_item > 0 && (
                      <div className="text-[11px] text-emerald-700 font-mono font-medium">
                        Desconto: -R${' '}
                        {(it.desconto_item_tipo === 'percentual'
                          ? (it.valor_unitario * it.quantidade * it.desconto_item) / 100
                          : it.desconto_item
                        ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Visualização 2 (Desktop): Tabela Completa */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Item / Descrição</th>
                    <th className="py-2.5 px-2 text-center w-12">Qtd</th>
                    <th className="py-2.5 px-3 text-right hidden sm:table-cell">Vlr. Unit.</th>
                    <th className="py-2.5 px-3 text-right hidden sm:table-cell">Desconto</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        Nenhum item adicionado a este orçamento.
                      </td>
                    </tr>
                  ) : (
                    data.items.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-900">{it.descricao}</div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">{it.quantidade}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 hidden sm:table-cell">
                          R${' '}
                          {(it.valor_unitario || 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 hidden sm:table-cell">
                          {it.desconto_item && it.desconto_item > 0 ? (
                            <>
                              -R${' '}
                              {(it.desconto_item_tipo === 'percentual'
                                ? (it.valor_unitario * it.quantidade * it.desconto_item) / 100
                                : it.desconto_item
                              ).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          R${' '}
                          {(it.valor_total_item || 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Resumo Financeiro */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal dos Itens:</span>
                <span className="font-mono">
                  R${' '}
                  {data.subtotal.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {data.desconto_total_valor > 0 && (
                <div className="flex justify-between text-xs text-emerald-700 font-semibold">
                  <span>Desconto Especial Concedido:</span>
                  <span className="font-mono">
                    -R${' '}
                    {data.desconto_total_valor.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-2 border-t border-slate-300">
                <span className="text-sm font-bold text-slate-900">TOTAL GERAL DA PROPOSTA:</span>
                <span className="font-mono font-black text-xl sm:text-2xl text-indigo-700">
                  R${' '}
                  {data.total_geral.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Condições de Pagamento */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="p-4 bg-slate-50 border-b border-slate-200">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-indigo-600" />
              Condições de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 font-semibold block">
                  Forma Escolhida
                </span>
                <p className="text-sm font-bold text-slate-900 uppercase mt-0.5">
                  {data.forma_pagamento || 'PIX'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 font-semibold block">Parcelamento</span>
                <p className="text-sm font-bold text-indigo-700 mt-0.5 font-mono">
                  {numParcelas > 1 ? (
                    <>
                      {numParcelas}x de R${' '}
                      {valorParcela.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </>
                  ) : (
                    'À vista (1 parcela)'
                  )}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 font-semibold block">
                  Entrada / Restante
                </span>
                <p className="text-xs font-mono text-slate-800 mt-0.5">
                  {data.entrada && data.entrada > 0 ? (
                    <>
                      Entrada: R${' '}
                      {data.entrada.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      <br />
                      Restante: R${' '}
                      {(data.restante || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </>
                  ) : (
                    'Sem necessidade de entrada'
                  )}
                </p>
              </div>
            </div>

            {data.observacoes && (
              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg text-indigo-950">
                <span className="font-semibold block text-[11px] text-indigo-900 mb-0.5">
                  Observações Gerais & Garantia:
                </span>
                <p className="leading-relaxed whitespace-pre-line">{data.observacoes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fotos e Anexos Técnicos (Miniaturas + Tela Cheia) */}
        {data.anexos && data.anexos.length > 0 && (
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="p-4 bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-indigo-600" />
                Fotos Anexadas do Equipamento e Defeito ({data.anexos.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {data.anexos.map((anexo) => {
                  const fullUrl = `${PB_URL}${anexo.url}`
                  return (
                    <div
                      key={anexo.id}
                      onClick={() => setFullscreenPhoto(anexo)}
                      className="group cursor-pointer relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-square flex flex-col items-center justify-center hover:border-indigo-400 transition-all shadow-2xs"
                    >
                      <img
                        src={fullUrl}
                        alt={anexo.legenda || 'Foto do equipamento'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye className="h-6 w-6" />
                      </div>
                      {anexo.legenda && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] p-1 truncate">
                          {anexo.legenda}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campo de Assinatura do Cliente */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="p-4 bg-slate-50 border-b border-slate-200">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Assinatura Digital do Cliente
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Fundo transparente</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-xs space-y-3">
            <p className="text-slate-600">
              Para aprovar este orçamento, utilize o campo abaixo para assinar digitalmente com o
              dedo na tela do celular ou com o mouse.
            </p>

            {/* Pré-visualização da assinatura coletada */}
            {localSignatureUrl || data.assinatura_cliente_url ? (
              <div className="space-y-3">
                <div className="h-28 bg-slate-50 border-2 border-dashed border-emerald-300 rounded-xl p-2 flex items-center justify-center relative">
                  <img
                    src={
                      localSignatureUrl ||
                      (data.assinatura_cliente_url ? `${PB_URL}${data.assinatura_cliente_url}` : '')
                    }
                    alt="Assinatura Coletada"
                    className="max-h-full max-w-full object-contain"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] gap-1">
                      <Check className="h-3 w-3" /> Assinatura Coletada
                    </Badge>
                  </div>
                </div>

                {canApprove && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSignatureModalOpen(true)}
                    className="w-full text-xs font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50 min-h-[44px] h-11 touch-manipulation active:scale-[0.98]"
                  >
                    Refazer Assinatura
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-6 px-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl space-y-3">
                <p className="text-slate-500 font-medium">Nenhuma assinatura coletada ainda.</p>
                {canApprove && (
                  <Button
                    type="button"
                    onClick={() => setSignatureModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs min-h-[44px] h-11 px-5 rounded-lg shadow-sm touch-manipulation active:scale-[0.98]"
                  >
                    Assinar com o Dedo
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Barra Fixa Inferior de Aprovação (Mobile-First, Botões ≥44px) - Oculta na impressão */}
      <div className="no-print fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:px-6 shadow-xl">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                Total do Orçamento
              </span>
              <span className="font-mono font-black text-lg sm:text-xl text-indigo-700">
                R${' '}
                {data.total_geral.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            {numParcelas > 1 && (
              <div className="text-right sm:text-left border-l border-slate-200 pl-3">
                <span className="text-[10px] text-slate-500 block">Condição</span>
                <span className="font-mono font-bold text-xs text-slate-800">
                  {numParcelas}x de R${' '}
                  {valorParcela.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            {isApproved ? (
              <div className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-100 text-emerald-800 font-bold text-xs h-12 px-6 rounded-xl border border-emerald-300">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <span>Proposta Aprovada</span>
              </div>
            ) : canApprove ? (
              <Button
                type="button"
                disabled={!hasSignature || approving}
                onClick={handleAprovarProposta}
                className="w-full sm:w-auto h-12 px-6 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 rounded-xl gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  !hasSignature
                    ? 'Assine no campo de assinatura antes de aprovar'
                    : 'Aprovar proposta comercial'
                }
              >
                {approving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
                <span>
                  {approving
                    ? 'Gravando Aprovação...'
                    : hasSignature
                      ? 'Aprovar Proposta'
                      : 'Assine para Aprovar'}
                </span>
              </Button>
            ) : (
              <Button
                type="button"
                disabled
                className="w-full sm:w-auto h-12 px-6 text-xs font-bold bg-slate-200 text-slate-400 cursor-not-allowed rounded-xl"
              >
                <Lock className="h-4 w-4 mr-1.5" />
                Proposta Indisponível para Aprovação
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Assinatura Fullscreen com Travamento Retrato */}
      <PublicSignaturePadModal
        open={signatureModalOpen}
        onOpenChange={setSignatureModalOpen}
        customerName={data.customer?.name}
        numeroOrcamento={data.numero_orcamento}
        onConfirmSignature={(dataUrl) => {
          setLocalSignatureUrl(dataUrl)
        }}
      />

      {/* Modal de Foto em Tela Cheia */}
      <Dialog
        open={!!fullscreenPhoto}
        onOpenChange={(open) => {
          if (!open) setFullscreenPhoto(null)
        }}
      >
        <DialogContent className="max-w-3xl p-2 bg-black/95 text-white border-slate-800">
          <div className="relative flex flex-col items-center">
            <button
              onClick={() => setFullscreenPhoto(null)}
              className="absolute top-2 right-2 z-10 bg-black/60 text-white hover:bg-black/90 p-2 rounded-full"
            >
              <X className="h-5 w-5" />
            </button>
            {fullscreenPhoto && (
              <>
                <img
                  src={`${PB_URL}${fullscreenPhoto.url}`}
                  alt={fullscreenPhoto.legenda || 'Foto do orçamento'}
                  className="max-h-[80vh] w-auto object-contain rounded"
                />
                {fullscreenPhoto.legenda && (
                  <p className="text-xs text-slate-300 mt-2 text-center">
                    {fullscreenPhoto.legenda}
                  </p>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
