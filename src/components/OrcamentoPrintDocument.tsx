import { COMPANY_DATA, JUCA_LOGO_URL } from '@/lib/company'
import { getFileUrl } from '@/lib/pocketbase/files'
import { Orcamento, OrcamentoItem, OrcamentoAnexo, ServiceOrder } from '@/types'
import { Printer, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

const fmtDate = (d?: string) => {
  if (!d) return '—'
  const dateOnly = d.substring(0, 10)
  const parts = dateOnly.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return d
}

const fmtCurrency = (val: number | undefined | null) => {
  const num = Number(val) || 0
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const FORMA_PAGTO_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro em Espécie',
  pix: 'PIX (Chave JUCA Informática)',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto Bancário',
  crediario: 'Crediário',
  outros: 'A Combinar',
}

interface OrcamentoPrintDocumentProps {
  orcamento: Orcamento
  items: OrcamentoItem[]
  anexos: OrcamentoAnexo[]
  mode?: 'complete' | 'os_summary'
}

export function OrcamentoPrintDocument({
  orcamento,
  items = [],
  anexos = [],
  mode = 'complete',
}: OrcamentoPrintDocumentProps) {
  const navigate = useNavigate()

  const os = orcamento.expand?.id_os
  const cust =
    os?.expand?.customer ||
    orcamento.expand?.cliente_id ||
    (orcamento.nome_cliente_livre
      ? ({
          id: '',
          name: orcamento.nome_cliente_livre,
          celular: orcamento.telefone_cliente_livre || '',
          phone: orcamento.telefone_cliente_livre || '',
        } as any)
      : undefined)
  const tech =
    os?.expand?.technician ||
    orcamento.expand?.responsavel_id ||
    orcamento.expand?.id_usuario_criador
  const equip = os?.expand?.equipment_ref
  const equipName =
    equip?.name || os?.equipment || orcamento.equipamento_independente || 'Não especificado'
  const defeitoRelatado = os?.description || orcamento.defeito_independente || ''

  // Assinaturas do orçamento
  const custSig = orcamento.assinatura_cliente
    ? getFileUrl(orcamento.id, orcamento.assinatura_cliente, 'orcamentos')
    : null
  const techSig = orcamento.assinatura_tecnico
    ? getFileUrl(orcamento.id, orcamento.assinatura_tecnico, 'orcamentos')
    : null

  // Fotos para o A4 (máximo 4 por folha conforme especificação)
  const printPhotos = anexos.slice(0, 4)

  // Totais
  const subtotal = items.reduce((acc, it) => acc + it.valor_unitario * it.quantidade, 0)
  const totalItensComDesconto = items.reduce((acc, it) => acc + (it.valor_total_item || 0), 0)
  const somaDescontoItens = Math.max(0, subtotal - totalItensComDesconto)
  const descontoTotal = Number(orcamento.desconto_total_valor) || 0
  const totalGeral = Number(orcamento.total_geral) || 0

  return (
    <div className="min-h-screen bg-slate-100/60 p-4 sm:p-6 print:bg-white print:p-0">
      {/* Barra de controle na tela (oculta na impressão) */}
      <div className="no-print mx-auto mb-4 flex max-w-4xl items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-1.5 text-xs text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">
            {mode === 'complete' ? 'Orçamento Completo' : 'Resumo da O.S.'} —{' '}
            {orcamento.numero_orcamento}
          </span>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="gap-2 bg-indigo-600 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <Printer className="h-4 w-4" /> Imprimir A4 / PDF
          </Button>
        </div>
      </div>

      {/* Folha de Impressão A4 (Modelo Exclusivo de Orçamento - Compacto Página Única) */}
      <div className="print-document a4-single-page mx-auto max-w-4xl bg-white p-4 sm:p-5 text-slate-900 shadow-md border border-slate-200 rounded-lg print:border-0 print:shadow-none print:p-0 print:rounded-none text-[10px] leading-tight">
        {/* CABEÇALHO EMPRESA COM LOGO JUCA E CONTATOS EXATOS */}
        <div className="mb-2 flex items-center justify-between border-b-2 border-slate-900 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="h-11 w-24 sm:h-12 sm:w-28 shrink-0 overflow-hidden rounded bg-slate-950 p-1 flex items-center justify-center border border-slate-800">
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
              <h1 className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base leading-none">
                {COMPANY_DATA.nomeFantasia || 'JUCA CARTUCHOS E INFORMÁTICA'}
              </h1>
              <p className="text-[10px] font-semibold text-slate-700 leading-tight mt-0.5">
                {COMPANY_DATA.razaoSocial}
              </p>
              <p className="text-[9px] text-slate-600 leading-tight">{COMPANY_DATA.endereco}</p>
              <p className="text-[9px] text-slate-600 leading-tight">
                <strong>Telefones:</strong> (67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block rounded bg-indigo-900 px-2 py-0.5 text-white">
              <span className="font-mono text-sm font-black tracking-wider sm:text-base">
                {orcamento.numero_orcamento}
              </span>
            </div>
            <p className="mt-0.5 text-[9px] font-medium text-slate-600 leading-tight">
              <strong>Emissão:</strong> {fmtDate(orcamento.created)}
            </p>
            <p className="text-[9px] text-slate-600 leading-tight">
              <strong>Validade:</strong> {orcamento.validade || 15} dias
            </p>
            <p className="text-[9px] font-semibold text-indigo-700 uppercase leading-tight">
              Status: {orcamento.status}
            </p>
          </div>
        </div>

        {/* DADOS DO CLIENTE */}
        <div className="mb-2 rounded border border-slate-200 p-2 text-[10px]">
          <h3 className="mb-0.5 border-b border-slate-200 pb-0.5 text-[10px] font-bold text-slate-900 uppercase tracking-wide">
            Dados do Cliente
          </h3>
          <div className="grid grid-cols-2 gap-2 leading-tight">
            <div>
              <p>
                <strong className="text-slate-700">Razão / Nome:</strong>{' '}
                <span className="font-semibold text-slate-900">
                  {cust?.razao_social || cust?.nome_fantasia || cust?.name || 'Não informado'}
                </span>
              </p>
              {cust?.nome_fantasia && cust?.nome_fantasia !== cust?.razao_social && (
                <p>
                  <strong className="text-slate-700">Nome Fantasia:</strong> {cust.nome_fantasia}
                </p>
              )}
              {cust?.cpf_cnpj && (
                <p>
                  <strong className="text-slate-700">CPF/CNPJ:</strong> {cust.cpf_cnpj}
                </p>
              )}
            </div>
            <div>
              <p>
                <strong className="text-slate-700">Telefone/WhatsApp:</strong>{' '}
                <span className="font-medium text-slate-900">
                  {cust?.celular || cust?.phone || '—'}
                </span>
              </p>
              <p>
                <strong className="text-slate-700">Endereço:</strong>{' '}
                {[
                  cust?.endereco || cust?.street,
                  cust?.number ? `Nº ${cust.number}` : '',
                  cust?.bairro ? `Bairro ${cust.bairro}` : '',
                  cust?.city ? `${cust.city}${cust?.state ? ` - ${cust.state}` : ''}` : '',
                ]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* RESUMO MÍNIMO DO EQUIPAMENTO / O.S. (SEM SEÇÕES TÉCNICAS PESADAS) */}
        <div className="mb-2 rounded border border-indigo-100 bg-indigo-50/30 p-1.5 text-[10px]">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-0.5 mb-1">
            <span className="text-[10px] font-bold text-indigo-950 uppercase">
              {os ? `Vínculo com O.S. ${os.number}` : 'Equipamento / Atendimento'}
            </span>
            <span className="text-[9px] text-indigo-700 font-mono">
              {os?.attendance_date
                ? `Atendimento: ${fmtDate(os.attendance_date)}`
                : `Emissão: ${fmtDate(orcamento.created)}`}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 leading-tight">
            <div>
              <strong className="text-slate-700">Equipamento:</strong>{' '}
              <span className="font-bold text-slate-900">{equipName}</span>
            </div>
            <div>
              <strong className="text-slate-700">Marca/Modelo:</strong>{' '}
              <span>{[equip?.brand, equip?.model].filter(Boolean).join(' / ') || '—'}</span>
            </div>
            <div>
              <strong className="text-slate-700">Técnico:</strong>{' '}
              <span>{tech?.name || 'Equipe JUCA'}</span>
            </div>
          </div>
        </div>
        {/* Se modo for 'complete', renderiza itens, totalizadores, fotos e pagamentos */}
        {mode === 'complete' && (
          <>
            {/* TABELA DE ITENS (COMPACTA) */}
            <div className="page-break-inside-avoid mb-2 rounded border border-slate-200 p-2">
              <h3 className="mb-1 text-[10px] font-bold text-slate-900 uppercase tracking-wide">
                Itens, Peças e Serviços do Orçamento
              </h3>
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                    <th className="px-1.5 py-1 text-left font-bold w-10">Item</th>
                    <th className="px-1.5 py-1 text-left font-bold">
                      Descrição do Produto / Serviço
                    </th>
                    <th className="px-1.5 py-1 text-center font-bold w-12">Qtd</th>
                    <th className="px-1.5 py-1 text-right font-bold w-20">Vlr. Unit.</th>
                    <th className="px-1.5 py-1 text-right font-bold w-20">Desconto</th>
                    <th className="px-1.5 py-1 text-right font-bold w-20">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.length > 0 ? (
                    items.map((it, idx) => {
                      let itemDescVal = 0
                      if (it.desconto_item && it.desconto_item > 0) {
                        const raw = it.valor_unitario * it.quantidade
                        itemDescVal =
                          it.desconto_item_tipo === 'percentual'
                            ? (raw * it.desconto_item) / 100
                            : it.desconto_item
                      }
                      return (
                        <tr key={it.id || idx} className="even:bg-slate-50/80">
                          <td className="px-1.5 py-0.5 text-slate-500 font-mono text-center">
                            {idx + 1}
                          </td>
                          <td className="px-1.5 py-0.5 text-slate-900">
                            <span className="font-semibold">{it.descricao}</span>
                            <span className="ml-1 text-[8px] uppercase px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {it.tipo}
                            </span>
                          </td>
                          <td className="px-1.5 py-0.5 text-center font-mono font-medium text-slate-800">
                            {it.quantidade}
                          </td>
                          <td className="px-1.5 py-0.5 text-right font-mono text-slate-700">
                            R$ {fmtCurrency(it.valor_unitario)}
                          </td>
                          <td className="px-1.5 py-0.5 text-right font-mono text-rose-600">
                            {itemDescVal > 0 ? `- R$ ${fmtCurrency(itemDescVal)}` : '—'}
                          </td>
                          <td className="px-1.5 py-0.5 text-right font-mono font-bold text-slate-900">
                            R$ {fmtCurrency(it.valor_total_item)}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-1.5 py-2 text-center text-slate-400 italic">
                        Nenhum item adicionado ao orçamento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* RESUMO FINANCEIRO (COMPACTO) */}
              <div className="mt-1.5 flex justify-end">
                <div className="w-64 space-y-0.5 rounded bg-slate-50 p-1.5 border border-slate-200 text-right text-[10px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Bruto:</span>
                    <span className="font-mono font-medium">R$ {fmtCurrency(subtotal)}</span>
                  </div>
                  {somaDescontoItens > 0 && (
                    <div className="flex justify-between text-rose-600 font-medium">
                      <span>Descontos por Item:</span>
                      <span className="font-mono">- R$ {fmtCurrency(somaDescontoItens)}</span>
                    </div>
                  )}
                  {descontoTotal > 0 && (
                    <div className="flex justify-between text-rose-600 font-medium">
                      <span>
                        Desconto no Total{' '}
                        {orcamento.desconto_total_tipo === 'percentual'
                          ? `(${orcamento.desconto_total_percentual}%)`
                          : ''}
                        :
                      </span>
                      <span className="font-mono">- R$ {fmtCurrency(descontoTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-900 pt-0.5 text-[11px] font-black text-slate-900">
                    <span>TOTAL GERAL:</span>
                    <span className="font-mono text-xs text-indigo-900 font-bold">
                      R$ {fmtCurrency(totalGeral)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* CONDIÇÕES DE PAGAMENTO */}
            <div className="page-break-inside-avoid mb-2 rounded border border-slate-200 p-2 text-[10px]">
              <h3 className="mb-0.5 text-[10px] font-bold text-slate-900 uppercase tracking-wide">
                Condições de Pagamento
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 leading-tight">
                <div>
                  <strong className="text-slate-700">Forma:</strong>{' '}
                  <span className="font-medium text-slate-900">
                    {FORMA_PAGTO_LABELS[orcamento.forma_pagamento || 'pix'] ||
                      orcamento.forma_pagamento}
                  </span>
                </div>
                <div>
                  <strong className="text-slate-700">Parcelamento:</strong>{' '}
                  <span>
                    {(orcamento.parcelas || 1) > 1
                      ? `${orcamento.parcelas}x de R$ ${fmtCurrency(
                          (orcamento.restante !== undefined &&
                          orcamento.restante !== null &&
                          Number(orcamento.restante) > 0
                            ? Number(orcamento.restante)
                            : totalGeral - (Number(orcamento.entrada) || 0)) /
                            (orcamento.parcelas || 1),
                        )}`
                      : '1x (à vista)'}
                  </span>
                </div>
                {Number(orcamento.entrada) > 0 && (
                  <div>
                    <strong className="text-slate-700">Entrada:</strong>{' '}
                    <span className="font-mono text-emerald-700 font-bold">
                      R$ {fmtCurrency(orcamento.entrada)}
                    </span>
                  </div>
                )}
                {Number(orcamento.restante) > 0 && (
                  <div>
                    <strong className="text-slate-700">Restante:</strong>{' '}
                    <span className="font-mono text-slate-800 font-bold">
                      R$ {fmtCurrency(orcamento.restante)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* FOTOS DO ORÇAMENTO (MÁX 4 EM LINHA COMPACTA) */}
            {printPhotos.length > 0 && (
              <div className="page-break-inside-avoid mb-2 rounded border border-slate-200 p-1.5 text-[9px]">
                <h3 className="mb-1 text-[9px] font-bold text-slate-900 uppercase tracking-wide">
                  Registros Fotográficos
                </h3>
                <div className="grid grid-cols-4 gap-1.5">
                  {printPhotos.slice(0, 4).map((anexo, i) => {
                    const url = getFileUrl(anexo.id, anexo.caminho_arquivo, 'orcamento_anexos')
                    return (
                      <div key={anexo.id || i} className="text-center">
                        <img
                          src={url}
                          alt={anexo.legenda || 'Foto'}
                          className="h-14 w-full rounded border border-slate-300 object-cover shadow-2xs"
                        />
                        <p className="mt-0.5 truncate text-[8px] text-slate-600 font-medium">
                          {anexo.legenda ||
                            (anexo.tipo === 'foto_defeito' ? 'Defeito' : 'Equipamento')}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* OBSERVAÇÕES */}
            {orcamento.observacoes && (
              <div className="page-break-inside-avoid mb-2 rounded border border-slate-200 p-1.5 text-[9px]">
                <h3 className="mb-0.5 text-[9px] font-bold text-slate-900 uppercase tracking-wide">
                  Observações e Garantia
                </h3>
                <p className="whitespace-pre-wrap text-slate-700 leading-tight">
                  {orcamento.observacoes}
                </p>
              </div>
            )}
          </>
        )}

        {/* DUAS LINHAS DE ASSINATURA LADO A LADO COM ASSINATURAS RENDERIZADAS */}
        <div className="page-break-inside-avoid mt-2 grid grid-cols-2 gap-6 text-[10px]">
          {/* Assinatura do Cliente */}
          <div className="text-center">
            <div className="flex h-11 items-end justify-center border-b border-slate-400 pb-0.5">
              {custSig ? (
                <img
                  src={custSig}
                  alt="Assinatura de Aprovação do Cliente"
                  className="max-h-10 max-w-full object-contain"
                />
              ) : (
                <div className="text-slate-300 italic text-[9px]">
                  Assinatura do Cliente não coletada
                </div>
              )}
            </div>
            <p className="mt-0.5 font-bold text-slate-900 text-[10px]">
              {cust?.razao_social || cust?.nome_fantasia || cust?.name || 'Aprovação do Cliente'}
            </p>
            <p className="text-[9px] text-slate-500">
              {orcamento.data_assinatura_cliente
                ? `Aprovado em ${fmtDate(orcamento.data_assinatura_cliente)}`
                : 'Aprovação do Cliente'}
            </p>
          </div>

          {/* Assinatura do Técnico */}
          <div className="text-center">
            <div className="flex h-11 items-end justify-center border-b border-slate-400 pb-0.5">
              {techSig ? (
                <img
                  src={techSig}
                  alt="Assinatura do Responsável Técnico"
                  className="max-h-10 max-w-full object-contain"
                />
              ) : (
                <div className="text-slate-300 italic text-[9px]">
                  Assinatura do Técnico não coletada
                </div>
              )}
            </div>
            <p className="mt-0.5 font-bold text-slate-900 text-[10px]">
              {tech?.name ? `Técnico: ${tech.name}` : 'Responsável Técnico'}
            </p>
            <p className="text-[9px] text-slate-500">JUCA Cartuchos e Informática</p>
          </div>
        </div>

        {/* RODAPÉ DO DOCUMENTO */}
        <div className="page-break-inside-avoid mt-2 border-t border-slate-200 pt-1 text-center text-[8px] text-slate-500">
          <p className="font-semibold text-slate-700">
            Documento gerado em {new Date().toLocaleDateString('pt-BR')} às{' '}
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} pelo
            sistema JUCA Informática
          </p>
          <p>
            {COMPANY_DATA.endereco} | Telefones: (67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981
          </p>
        </div>
      </div>
    </div>
  )
}
