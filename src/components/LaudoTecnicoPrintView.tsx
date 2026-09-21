import { Button } from '@/components/ui/button'
import {
  Printer,
  ArrowLeft,
  FileCheck2,
  Share2,
  MessageCircle,
  Copy,
  Check,
  User as UserIcon,
  Monitor,
  Wrench,
  FileText,
} from 'lucide-react'
import { useState } from 'react'
import { JUCA_LOGO_URL, COMPANY_DATA } from '@/lib/company'
import { getFileUrl } from '@/lib/pocketbase/files'
import { formatPhone } from '@/lib/phones'
import { openWhatsApp } from '@/lib/whatsapp'
import { useToast } from '@/hooks/use-toast'
import type { LaudoTecnico } from '@/types'

interface LaudoTecnicoPrintViewProps {
  laudo: LaudoTecnico
  onBack?: () => void
  returnUrl?: string
}

export function LaudoTecnicoPrintView({ laudo, onBack }: LaudoTecnicoPrintViewProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const dataFormatada = new Date(
    laudo.data_laudo || laudo.created || Date.now(),
  ).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const clienteNome =
    laudo.cliente_nome || laudo.expand?.id_cliente?.name || 'Cliente não informado'
  const clienteDoc =
    laudo.cliente_documento || laudo.expand?.id_cliente?.cpf_cnpj || 'Não informado'
  const clienteTel = laudo.cliente_telefone || laudo.expand?.id_cliente?.phone || 'Não informado'
  const clienteEnd = laudo.cliente_endereco || 'Não informado'

  const equipNome =
    laudo.equipamento_nome || laudo.expand?.id_equipamento?.name || 'Equipamento não especificado'
  const equipFabricante = laudo.equipamento_fabricante || laudo.expand?.id_equipamento?.brand || '—'
  const equipModelo = laudo.equipamento_modelo || laudo.expand?.id_equipamento?.model || '—'
  const equipSerial = laudo.equipamento_serial || laudo.expand?.id_equipamento?.serial_number || '—'
  const equipTipo = laudo.equipamento_tipo || laudo.expand?.id_equipamento?.type || '—'

  const osNumero = laudo.expand?.id_ordem?.number
  const orcNumero = laudo.expand?.id_orcamento?.numero_orcamento
  const tecnicoNome =
    laudo.tecnico_nome || laudo.expand?.tecnico_responsavel?.name || 'Técnico Responsável'

  const handlePrint = () => {
    window.print()
  }

  const handleCopyText = () => {
    const text = [
      `*LAUDO TÉCNICO - ${laudo.numero_laudo}*`,
      `JUCA INFORMÁTICA - Solução e Tecnologia`,
      `Data: ${dataFormatada}`,
      osNumero ? `Ordem de Serviço: ${osNumero}` : null,
      orcNumero ? `Orçamento Vinculado: ${orcNumero}` : null,
      `----------------------------------------`,
      `*CLIENTE:* ${clienteNome}`,
      `Documento: ${clienteDoc}`,
      `Telefone: ${clienteTel}`,
      `----------------------------------------`,
      `*EQUIPAMENTO:* ${equipNome}`,
      `Fabricante: ${equipFabricante} | Modelo: ${equipModelo}`,
      `Nº de Série: ${equipSerial}`,
      `----------------------------------------`,
      `*PROBLEMA RELATADO:*`,
      laudo.problema_relatado || 'Não especificado',
      ``,
      `*DIAGNÓSTICO TÉCNICO:*`,
      laudo.diagnostico_tecnico || 'Não especificado',
      ``,
      laudo.testes_realizados ? `*TESTES REALIZADOS:*\n${laudo.testes_realizados}\n` : null,
      laudo.servicos_realizados ? `*SERVIÇOS REALIZADOS:*\n${laudo.servicos_realizados}\n` : null,
      laudo.pecas_substituidas ? `*PEÇAS SUBSTITUÍDAS:*\n${laudo.pecas_substituidas}\n` : null,
      laudo.conclusao_parecer ? `*PARECER / CONCLUSÃO:*\n${laudo.conclusao_parecer}\n` : null,
      laudo.recomendacoes ? `*RECOMENDAÇÕES:*\n${laudo.recomendacoes}\n` : null,
      `----------------------------------------`,
      `Técnico: ${tecnicoNome}`,
    ]
      .filter(Boolean)
      .join('\n')

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      toast({ title: 'Resumo do laudo copiado para a área de transferência!' })
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const handleWhatsApp = () => {
    const rawPhone = laudo.cliente_telefone || laudo.expand?.id_cliente?.phone || ''
    if (!rawPhone) {
      toast({
        title: 'Cliente sem telefone cadastrado',
        description: 'Copie o resumo através do botão Copiar Resumo.',
        variant: 'destructive',
      })
      return
    }

    const msg = `Olá *${clienteNome}*, segue o resumo do Laudo Técnico *${laudo.numero_laudo}* referente ao equipamento *${equipNome}* (${equipModelo}) realizado pela JUCA Informática.\n\n*Diagnóstico Técnico:*\n${laudo.diagnostico_tecnico || 'Conforme análise em bancada.'}\n\nQualquer dúvida estamos à disposição!`
    openWhatsApp(rawPhone, msg)
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
          <span className="font-bold text-sm">Laudo Técnico ({laudo.numero_laudo})</span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
              laudo.status === 'finalizado'
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                : 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
            }`}
          >
            {laudo.status === 'finalizado' ? 'Finalizado' : 'Rascunho'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyText}
            className="text-white border-slate-700 hover:bg-slate-800 text-xs gap-1.5"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Copiado!' : 'Copiar Resumo'}</span>
          </Button>

          {laudo.cliente_telefone && (
            <Button
              type="button"
              size="sm"
              onClick={handleWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 shadow-sm"
            >
              <MessageCircle className="h-4 w-4" />
              <span>WhatsApp</span>
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5"
          >
            <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENTO DA FOLHA A4 */}
      <div className="bg-white text-slate-900 p-6 sm:p-10 max-w-4xl mx-auto shadow-md rounded-lg border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 text-xs">
        {/* CABEÇALHO JUCA */}
        <div className="flex items-center justify-between border-b-2 border-indigo-950 pb-3 mb-4">
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
                {COMPANY_DATA.nomeFantasia}
              </h1>
              <p className="text-[11px] font-semibold text-slate-700">{COMPANY_DATA.razaoSocial}</p>
              <p className="text-[10px] text-slate-500">{COMPANY_DATA.endereco}</p>
              <p className="text-[10px] text-slate-500">Telefones: {COMPANY_DATA.telefones}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block bg-indigo-950 text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider">
              LAUDO TÉCNICO PERICIAL
            </div>
            <p className="text-sm font-black text-slate-900 mt-1 font-mono">{laudo.numero_laudo}</p>
            <p className="text-[10px] text-slate-600 font-semibold">Data: {dataFormatada}</p>
          </div>
        </div>

        {/* FAIXA DE VÍNCULOS (OS E ORÇAMENTO) */}
        {(osNumero || orcNumero) && (
          <div className="flex flex-wrap items-center gap-4 bg-indigo-50 border border-indigo-200 rounded p-2.5 mb-4 text-xs">
            {osNumero && (
              <div className="flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-indigo-700" />
                <span className="text-slate-600">Ordem de Serviço Vinculada:</span>
                <span className="font-bold font-mono text-indigo-900">{osNumero}</span>
              </div>
            )}
            {orcNumero && (
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-indigo-700" />
                <span className="text-slate-600">Orçamento Vinculado:</span>
                <span className="font-bold font-mono text-indigo-900">{orcNumero}</span>
              </div>
            )}
          </div>
        )}

        {/* DADOS DO CLIENTE */}
        <div className="rounded border border-slate-200 bg-slate-50/60 p-3 mb-4">
          <h2 className="text-[11px] font-bold uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2 flex items-center gap-1.5">
            <UserIcon className="h-3.5 w-3.5 text-indigo-600" />
            Dados do Cliente
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <strong className="text-slate-700">Nome / Razão Social:</strong>{' '}
              <span className="font-semibold text-slate-900">{clienteNome}</span>
            </div>
            <div>
              <strong className="text-slate-700">CPF / CNPJ:</strong>{' '}
              <span className="font-mono">{clienteDoc}</span>
            </div>
            <div>
              <strong className="text-slate-700">Telefone:</strong>{' '}
              <span>{clienteTel !== 'Não informado' ? formatPhone(clienteTel) : clienteTel}</span>
            </div>
            <div>
              <strong className="text-slate-700">Endereço:</strong> <span>{clienteEnd}</span>
            </div>
          </div>
        </div>

        {/* DADOS DO EQUIPAMENTO CADASTRADO */}
        <div className="rounded border border-slate-200 bg-slate-50/60 p-3 mb-4">
          <h2 className="text-[11px] font-bold uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2 flex items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5 text-indigo-600" />
            Dados do Equipamento Cadastrado
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <strong className="text-slate-700">Equipamento:</strong>{' '}
              <span className="font-semibold text-slate-900">{equipNome}</span>
            </div>
            <div>
              <strong className="text-slate-700">Fabricante / Marca:</strong>{' '}
              <span className="font-semibold">{equipFabricante}</span>
            </div>
            <div>
              <strong className="text-slate-700">Modelo:</strong>{' '}
              <span className="font-semibold">{equipModelo}</span>
            </div>
            <div>
              <strong className="text-slate-700">Número de Série:</strong>{' '}
              <span className="font-mono">{equipSerial}</span>
            </div>
            <div>
              <strong className="text-slate-700">Tipo:</strong>{' '}
              <span className="capitalize">{equipTipo}</span>
            </div>
            {laudo.equipamento_dados_adicionais && (
              <div className="sm:col-span-3">
                <strong className="text-slate-700">Observações do Equipamento:</strong>{' '}
                <span>{laudo.equipamento_dados_adicionais}</span>
              </div>
            )}
          </div>
        </div>

        {/* SEÇÕES TÉCNICAS DO LAUDO */}
        <div className="space-y-3.5 mb-6">
          {/* Problema Relatado */}
          <div className="border border-slate-200 rounded p-3">
            <h3 className="text-[11px] font-bold uppercase text-slate-800 border-b border-slate-100 pb-1 mb-1.5">
              1. Relato Inicial / Problema Apresentado
            </h3>
            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
              {laudo.problema_relatado || 'Nenhum relato específico informado.'}
            </p>
          </div>

          {/* Diagnóstico Técnico */}
          <div className="border border-slate-200 rounded p-3 bg-indigo-50/20">
            <h3 className="text-[11px] font-bold uppercase text-indigo-950 border-b border-indigo-100 pb-1 mb-1.5">
              2. Diagnóstico Técnico e Constatações
            </h3>
            <p className="text-slate-800 whitespace-pre-wrap leading-relaxed font-medium">
              {laudo.diagnostico_tecnico || 'Diagnóstico não preenchido.'}
            </p>
          </div>

          {/* Testes Realizados (se houver) */}
          {laudo.testes_realizados && (
            <div className="border border-slate-200 rounded p-3">
              <h3 className="text-[11px] font-bold uppercase text-slate-800 border-b border-slate-100 pb-1 mb-1.5">
                3. Testes e Procedimentos Executados
              </h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                {laudo.testes_realizados}
              </p>
            </div>
          )}

          {/* Serviços Realizados e Peças */}
          {(laudo.servicos_realizados || laudo.pecas_substituidas) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {laudo.servicos_realizados && (
                <div className="border border-slate-200 rounded p-3">
                  <h3 className="text-[11px] font-bold uppercase text-slate-800 border-b border-slate-100 pb-1 mb-1.5">
                    Serviços Realizados
                  </h3>
                  <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {laudo.servicos_realizados}
                  </p>
                </div>
              )}
              {laudo.pecas_substituidas && (
                <div className="border border-slate-200 rounded p-3">
                  <h3 className="text-[11px] font-bold uppercase text-slate-800 border-b border-slate-100 pb-1 mb-1.5">
                    Peças Substituídas / Utilizadas
                  </h3>
                  <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {laudo.pecas_substituidas}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Conclusão e Parecer Técnico */}
          <div className="border-2 border-indigo-900 rounded p-3 bg-slate-50/50">
            <h3 className="text-[11px] font-bold uppercase text-indigo-950 border-b border-indigo-200 pb-1 mb-1.5">
              Parecer Técnico Conclusivo
            </h3>
            <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
              {laudo.conclusao_parecer ||
                'Equipamento inspecionado segundo os padrões e normas técnicas aplicáveis.'}
            </p>
          </div>

          {/* Recomendações e Observações */}
          {(laudo.recomendacoes || laudo.observacoes) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {laudo.recomendacoes && (
                <div className="border border-slate-200 rounded p-3 bg-amber-50/30">
                  <h3 className="text-[11px] font-bold uppercase text-amber-950 border-b border-amber-200 pb-1 mb-1.5">
                    Recomendações ao Cliente
                  </h3>
                  <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {laudo.recomendacoes}
                  </p>
                </div>
              )}
              {laudo.observacoes && (
                <div className="border border-slate-200 rounded p-3">
                  <h3 className="text-[11px] font-bold uppercase text-slate-800 border-b border-slate-100 pb-1 mb-1.5">
                    Observações Gerais
                  </h3>
                  <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {laudo.observacoes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ASSINATURAS */}
        <div className="mt-8 pt-6 border-t-2 border-slate-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-center">
            {/* Assinatura do Técnico */}
            <div className="flex flex-col items-center">
              <div className="h-16 w-48 border-b border-slate-400 flex items-center justify-center">
                {laudo.assinatura_tecnico ? (
                  <img
                    src={getFileUrl(laudo.id, laudo.assinatura_tecnico, 'laudos_tecnicos')}
                    alt="Assinatura Técnico"
                    className="max-h-14 object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Espaço para assinatura</span>
                )}
              </div>
              <p className="font-bold text-slate-900 text-xs mt-2">{tecnicoNome}</p>
              <p className="text-[10px] text-slate-500">Técnico Responsável - JUCA Informática</p>
            </div>

            {/* Assinatura do Cliente */}
            <div className="flex flex-col items-center">
              <div className="h-16 w-48 border-b border-slate-400 flex items-center justify-center">
                {laudo.assinatura_cliente ? (
                  <img
                    src={getFileUrl(laudo.id, laudo.assinatura_cliente, 'laudos_tecnicos')}
                    alt="Assinatura Cliente"
                    className="max-h-14 object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Espaço para assinatura</span>
                )}
              </div>
              <p className="font-bold text-slate-900 text-xs mt-2">{clienteNome}</p>
              <p className="text-[10px] text-slate-500">Assinatura do Cliente / Ciente do Laudo</p>
            </div>
          </div>

          <div className="mt-8 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-2">
            Laudo emitido por JUCA INFORMÁTICA em {dataFormatada}. Documento gerado eletronicamente.
          </div>
        </div>
      </div>
    </div>
  )
}
