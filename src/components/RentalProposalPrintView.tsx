import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Printer,
  FileSignature,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Share2,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { JUCA_LOGO_URL } from '@/lib/company'
import { RENTAL_LOCADORA_FIXA, formatBRL, formatCPP } from '@/lib/rental-contract-template'
import { buildRentalProposalClosingMessage, openWhatsApp } from '@/lib/whatsapp'
import { sanitizePhone } from '@/lib/phones'
import { ensureRentalQuoteToken } from '@/services/rental'
import type { RentalQuote, RentalMachineCalculation } from '@/types'

interface RentalProposalPrintViewProps {
  quote: RentalQuote
  onGenerateContract?: (machine: RentalMachineCalculation) => void
  onBack?: () => void
  isPublicView?: boolean
}

export function RentalProposalPrintView({
  quote,
  onGenerateContract,
  onBack,
  isPublicView = false,
}: RentalProposalPrintViewProps) {
  const machines = quote.maquinas_comparadas || quote.resultados?.machines || []
  const clienteNome = quote.cliente_nome_livre || quote.expand?.cliente_id?.name || 'Cliente'
  const clienteDoc = quote.cliente_documento || quote.expand?.cliente_id?.cpf_cnpj || '—'
  const clienteTel = quote.cliente_telefone || quote.expand?.cliente_id?.phone || '—'
  const clienteEnd = quote.cliente_endereco || '—'

  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const dataFormatada = new Date(quote.created || Date.now()).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const rawPhone = quote.cliente_telefone || quote.expand?.cliente_id?.phone || ''
  const sanitizedPhone = sanitizePhone(rawPhone)

  // Obtém o link público da proposta ({origin}/proposta-locacao/{id}?token={token})
  const getProposalPublicUrl = async (): Promise<string> => {
    const origin =
      typeof window !== 'undefined' && window.location.origin ? window.location.origin : ''
    const token = await ensureRentalQuoteToken(quote)
    return `${origin}/proposta-locacao/${quote.id}?token=${encodeURIComponent(token)}`
  }

  // Gera a mensagem curta e direta focada em fechar
  const getShortClosingMessage = async (): Promise<string> => {
    const proposalUrl = await getProposalPublicUrl()
    const mainMachine = machines[0]
    const equipNome =
      machines.length > 1
        ? `${mainMachine?.machineName || 'Multifuncional'} (+1 opção)`
        : mainMachine?.machineName || 'Multifuncional'
    const valorMensal = mainMachine?.franquiaSugerida || 0

    return buildRentalProposalClosingMessage({
      customerName: clienteNome,
      propostaUrl: proposalUrl,
      equipamento: equipNome,
      franquiaPaginas: quote.franquia_paginas || 1000,
      valorMensal,
    })
  }

  // Helper síncrono para cópia imediata no clique (iOS / Safari)
  const copyToClipboardSync = (text: string): boolean => {
    let textArea: HTMLTextAreaElement | null = null
    try {
      textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      textArea.style.top = '0'
      textArea.style.opacity = '0'
      textArea.setAttribute('readonly', '')
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      if (successful) return true
    } catch {
      /* ignore */
    } finally {
      if (textArea && textArea.parentNode) {
        try {
          textArea.parentNode.removeChild(textArea)
        } catch {
          // ignore
        }
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {})
        return true
      }
    } catch {
      /* ignore */
    }

    return false
  }

  // Compartilhamento via Web Share API com link do documento + fallback para cópia
  const handleShare = async () => {
    setSharing(true)
    try {
      const closingMessage = await getShortClosingMessage()
      const proposalUrl = await getProposalPublicUrl()
      const shareTitle = `Proposta de Locação - ${clienteNome} - JUCA Informática`

      const shareData = {
        title: shareTitle,
        text: closingMessage,
        url: proposalUrl,
      }

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData)
          toast({
            title: 'Proposta compartilhada com sucesso!',
            description: 'Link do documento e mensagem de fechamento enviados.',
          })
          return
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            return
          }
        }
      }

      // Fallback: cópia direta da mensagem curta com link para o clipboard
      const copiedOk = copyToClipboardSync(closingMessage)
      if (copiedOk) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
        toast({
          title: 'Link e mensagem copiados!',
          description: 'Mensagem com link direto para o cliente fechar a proposta copiada.',
        })
      } else {
        toast({
          title: 'Link da proposta pronto',
          description: closingMessage.slice(0, 100) + '...',
        })
      }
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao gerar link da proposta',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setSharing(false)
    }
  }

  // Envio direto via WhatsApp wa.me com a mensagem curta de fechamento contendo o link
  const handleWhatsApp = async () => {
    if (!sanitizedPhone) {
      toast({
        title: 'Cliente sem telefone cadastrado',
        description: 'Copie a proposta através do botão Compartilhar.',
        variant: 'destructive',
      })
      return
    }

    setSharing(true)
    try {
      const closingMessage = await getShortClosingMessage()
      copyToClipboardSync(closingMessage)
      openWhatsApp(sanitizedPhone, closingMessage)
      toast({
        title: 'WhatsApp aberto!',
        description: 'Mensagem com o link do documento da proposta enviada para o WhatsApp.',
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao preparar mensagem',
        variant: 'destructive',
      })
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* BARRA DE AÇÕES (PRINT: HIDDEN) */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 text-white rounded-lg shadow print:hidden">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBack}
              className="text-white border-slate-700 hover:bg-slate-800 text-xs gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
          )}
          <span className="font-bold text-sm">
            Proposta de Locação ({quote.titulo || 'Impressoras Corporativas'})
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* BOTÃO COMPARTILHAR PROPOSTA */}
          <Button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold gap-1.5 border border-slate-700 shadow-sm"
            title="Compartilhar proposta com link do documento e mensagem de fechamento"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Share2 className="h-4 w-4 text-indigo-400" />
            )}
            <span>{copied ? 'Copiado!' : 'Compartilhar Proposta'}</span>
          </Button>

          {/* BOTÃO WHATSAPP SE CLIENTE TIVER TELEFONE */}
          {sanitizedPhone && (
            <Button
              type="button"
              onClick={handleWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 shadow-sm"
              title={`Enviar proposta diretamente no WhatsApp (${clienteTel})`}
            >
              <MessageCircle className="h-4 w-4" />
              <span>WhatsApp</span>
            </Button>
          )}

          {/* BOTÃO IMPRIMIR / PDF */}
          <Button
            type="button"
            onClick={() => window.print()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5"
          >
            <Printer className="h-4 w-4" /> Imprimir Proposta / Salvar PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENTO DA PROPOSTA (FORMATO FOLHA A4 / APRESENTÁVEL) */}
      <div className="bg-white text-slate-900 p-6 sm:p-10 max-w-4xl mx-auto shadow-md rounded-lg border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 text-xs">
        {/* CABEÇALHO COM LOGO JUCA INFORMÁTICA */}
        <div className="flex items-center justify-between border-b-2 border-indigo-900 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-24 shrink-0 overflow-hidden rounded bg-slate-950 p-1 flex items-center justify-center border border-slate-800">
              <img
                src={JUCA_LOGO_URL}
                alt="JUCA Informática"
                className="h-full w-full object-contain"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = '/logo.svg'
                }}
              />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 uppercase">
                {RENTAL_LOCADORA_FIXA.nomeFantasia}
              </h1>
              <p className="text-[11px] font-semibold text-slate-700">
                {RENTAL_LOCADORA_FIXA.razaoSocial}
              </p>
              <p className="text-[10px] text-slate-500">
                CNPJ: {RENTAL_LOCADORA_FIXA.cnpj} • Telefone: {RENTAL_LOCADORA_FIXA.telefone}
              </p>
              <p className="text-[10px] text-slate-500">{RENTAL_LOCADORA_FIXA.endereco}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block bg-indigo-900 text-white px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider">
              PROPOSTA DE LOCAÇÃO
            </div>
            <p className="text-[10px] text-slate-600 mt-1 font-semibold">Data: {dataFormatada}</p>
            <p className="text-[10px] text-slate-500">Validade: 15 dias</p>
          </div>
        </div>

        {/* DADOS DO CLIENTE */}
        <div className="rounded border border-slate-200 bg-slate-50/60 p-3 mb-4">
          <h2 className="text-[11px] font-bold uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">
            Dados do Cliente / Solicitante
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <strong className="text-slate-700">Razão Social / Nome:</strong>{' '}
              <span className="font-semibold text-slate-900">{clienteNome}</span>
            </div>
            <div>
              <strong className="text-slate-700">CPF / CNPJ:</strong>{' '}
              <span className="font-mono">{clienteDoc}</span>
            </div>
            <div>
              <strong className="text-slate-700">Telefone / Contato:</strong>{' '}
              <span>{clienteTel}</span>
            </div>
            <div>
              <strong className="text-slate-700">Endereço de Instalação:</strong>{' '}
              <span className="truncate">{clienteEnd}</span>
            </div>
          </div>
        </div>

        {/* EQUIPAMENTOS COM ESPECIFICAÇÕES E VALORES */}
        <div className="space-y-4 mb-4">
          <h2 className="text-xs font-bold uppercase text-indigo-950 flex items-center justify-between border-b-2 border-indigo-900/40 pb-1">
            <span>Opções de Equipamentos e Planos de Locação</span>
            <span className="text-[10px] font-normal text-slate-500">
              Franquia Base: {(quote.franquia_paginas || 0).toLocaleString('pt-BR')} páginas/mês
            </span>
          </h2>

          <div
            className={`grid gap-4 ${
              machines.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {machines.map((m, idx) => {
              const isBest =
                quote.resultados?.melhorOpcaoIndex !== undefined &&
                quote.resultados?.melhorOpcaoIndex === idx
              return (
                <div
                  key={idx}
                  className={`rounded-lg border-2 p-4 flex flex-col justify-between transition-all ${
                    isBest
                      ? 'border-indigo-600 bg-indigo-50/30 shadow-sm'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                          Opção {idx + 1}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">
                          {m.machineName}
                        </h3>
                        {m.serial && (
                          <p className="text-[10px] text-slate-500 font-mono">Serial: {m.serial}</p>
                        )}
                      </div>
                      {isBest && (
                        <span className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase">
                          Melhor Custo-Benefício
                        </span>
                      )}
                    </div>

                    {/* QUADRO DE VALORES EM DESTAQUE */}
                    <div className="bg-slate-100/90 rounded p-3 space-y-1.5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-700 font-medium text-xs">
                          Valor Mensal (Franquia):
                        </span>
                        <span className="text-base font-black font-mono text-indigo-950 tabular-nums">
                          {formatBRL(m.franquiaSugerida)} / mês
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] pt-1 border-t border-slate-200">
                        <span className="text-slate-600">Franquia contratada:</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {(quote.franquia_paginas || 0).toLocaleString('pt-BR')} páginas/mês
                        </span>
                      </div>
                      {(quote.software_printway_mensal ||
                        (quote.resultados as any)?.software_printway_mensal) && (
                        <div className="flex justify-between items-baseline text-[11px]">
                          <span className="text-slate-600">Software Printway (mensal):</span>
                          <span className="font-bold text-indigo-900 font-mono">
                            {formatBRL(
                              quote.software_printway_mensal ||
                                (quote.resultados as any)?.software_printway_mensal ||
                                0,
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-baseline text-[11px]">
                        <span className="text-slate-600">
                          Página Excedente (CPP Venda Homologado):
                        </span>
                        <span className="font-bold text-rose-700 font-mono tabular-nums">
                          {formatCPP(m.excedenteSugerido)} / página
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] pt-1 border-t border-slate-200 text-slate-500">
                        <span>Custo Total do Contrato (TCO {quote.contrato_meses || 12}m):</span>
                        <span className="font-mono font-semibold text-slate-700">
                          {formatBRL(m.tco)}
                        </span>
                      </div>
                    </div>

                    {/* DISCRIMINAÇÃO DOS SUPRIMENTOS VINCULADOS COM CPP POR ITEM (Seção 10.3 / 11) */}
                    {m.supplies && m.supplies.length > 0 && (
                      <div className="bg-white rounded border border-slate-200 p-2.5 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase text-slate-700 block">
                          Suprimentos & Manutenção Homologados (Até 5 Slots):
                        </span>
                        <div className="divide-y divide-slate-100 text-[10px]">
                          {m.supplies.map((sup: any, sIdx: number) => (
                            <div key={sIdx} className="py-1 flex justify-between items-center">
                              <div>
                                <strong className="text-slate-800">{sup.nome}</strong>{' '}
                                {sup.tipo && (
                                  <span className="text-slate-500 capitalize">({sup.tipo})</span>
                                )}
                              </div>
                              <div className="text-right font-mono text-indigo-900 font-semibold">
                                CPP: R${' '}
                                {Number(sup.cpp || 0).toLocaleString('pt-BR', {
                                  minimumFractionDigits: 6,
                                  maximumFractionDigits: 6,
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ESPECIFICAÇÕES TÉCNICAS */}
                    <div className="space-y-1 text-[11px] text-slate-600">
                      <p>
                        <strong>Scanner / Digitalização:</strong>{' '}
                        {m.scanner
                          ? `Incluso (${m.scannerDados || 'Digitalização em rede'})`
                          : 'Não incluso'}
                      </p>
                      <p>
                        <strong>Prazo de vigência:</strong> {quote.contrato_meses || 12} meses
                      </p>
                    </div>
                  </div>

                  {/* BOTÃO GERAR CONTRATO (PRINT: HIDDEN) */}
                  {onGenerateContract && (
                    <div className="pt-3 mt-3 border-t border-slate-200 print:hidden">
                      <Button
                        type="button"
                        onClick={() => onGenerateContract(m)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow"
                      >
                        <FileSignature className="h-3.5 w-3.5" />
                        <span>Gerar Contrato com Esta Máquina</span>
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* CARD DE COMPARAÇÃO / BREAK-EVEN CASO 2 MÁQUINAS */}
          {machines.length === 2 && quote.resultados && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <span>Comparativo & Análise de Ponto de Equilíbrio (Break-Even)</span>
              </div>
              {quote.resultados.breakEvenPaginas ? (
                <p className="text-slate-700">
                  <strong>Ponto de Equilíbrio (Break-even):</strong>{' '}
                  <span className="font-mono font-bold text-indigo-900">
                    {quote.resultados.breakEvenPaginas.toLocaleString('pt-BR')} páginas/mês
                  </span>
                  . Acima deste volume, a máquina com menor CPP compensa a locação.
                </p>
              ) : null}
              {quote.resultados.vantagemDescricao && (
                <p className="text-slate-800 font-semibold">{quote.resultados.vantagemDescricao}</p>
              )}
            </div>
          )}
        </div>

        {/* O QUE ESTÁ INCLUSO NO PLANO */}
        <div className="rounded border border-emerald-200 bg-emerald-50/40 p-3 mb-4">
          <h3 className="text-xs font-bold uppercase text-emerald-950 flex items-center gap-1.5 mb-2">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            O que está incluso no Plano de Locação JUCA INFORMÁTICA
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-800">
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-700 font-bold">✓</span>
              <span>
                <strong>Consumíveis e Peças:</strong> Toners, cartuchos, fotocondutores (cilindros),
                fusores e roletes inclusos sem custo extra.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-700 font-bold">✓</span>
              <span>
                <strong>Assistência Técnica Completa:</strong> Manutenção preventiva periódica e
                corretiva prioritária com técnicos especializados.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-700 font-bold">✓</span>
              <span>
                <strong>Equipamento Reserva:</strong> Substituição rápida em caso de manutenção
                complexa garantindo continuidade do seu negócio.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-700 font-bold">✓</span>
              <span>
                <strong>Software de Gerenciamento Printway:</strong> Monitoramento remoto de
                contadores, alertas preditivos de suprimentos e relatórios automatizados de
                volumetria.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-700 font-bold">✓</span>
              <span>
                <strong>Leitura Mensal Transparente:</strong> Conferência periódica do medidor no 1º
                dia útil de cada mês com relatório claro auditável.
              </span>
            </li>
          </ul>
        </div>

        {/* CONDIÇÕES COMERCIAIS */}
        <div className="rounded border border-slate-200 bg-slate-50 p-3 mb-6 text-xs text-slate-700 space-y-1">
          <h3 className="font-bold text-slate-900 uppercase text-[11px] mb-1">
            Condições Comerciais e Financeiras
          </h3>
          <p>
            • <strong>Vencimento:</strong> Mensalidade com vencimento até o 10º (décimo) dia do mês
            subsequente ao faturamento.
          </p>
          <p>
            • <strong>Formas de Pagamento:</strong> Pagamento direto no escritório da JUCA
            INFORMÁTICA ou via transferência bancária / PIX / boleto.
          </p>
          <p>
            • <strong>Papel:</strong> O fornecimento de papel sulfite/mídia é de responsabilidade do
            cliente locatário.
          </p>
          <p>
            • <strong>Instalação e Suporte:</strong> Instalação nos computadores da rede inclusa no
            início da operação.
          </p>
        </div>

        {/* ASSINATURA DE ACEITE */}
        <div className="mt-8 pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs page-break-inside-avoid">
          <div>
            <div className="border-t border-slate-900 pt-1 font-bold text-slate-900">
              {RENTAL_LOCADORA_FIXA.nomeFantasia}
            </div>
            <p className="text-[10px] text-slate-500">Depto. Comercial / Locações</p>
          </div>
          <div>
            <div className="border-t border-slate-900 pt-1 font-bold text-slate-900">
              {clienteNome}
            </div>
            <p className="text-[10px] text-slate-500">De acordo do Cliente / Assinatura</p>
          </div>
        </div>
      </div>
    </div>
  )
}
