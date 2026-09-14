import { COMPANY_DATA, JUCA_LOGO_URL } from '@/lib/company'
import { PropostaData } from '@/services/proposta_publica'

const PB_URL = import.meta.env.VITE_POCKETBASE_URL || ''

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

interface PropostaPrintDocumentProps {
  data: PropostaData
  localSignatureUrl?: string | null
}

/**
 * PropostaPrintDocument
 * Componente A4 de impressão para a página pública da proposta.
 * Oculto na tela (hidden), renderizado apenas durante impressão (@media print -> block).
 * Reproduz o documento unificado A4 (Orçamento + O.S.) oficial da JUCA Informática,
 * sem duplicação de dados, com cabeçalho oficial, dados do cliente, resumo da O.S.,
 * tabela de itens/serviços, totais, condições de pagamento, fotos (até 4) e assinaturas.
 */
export function PropostaPrintDocument({ data, localSignatureUrl }: PropostaPrintDocumentProps) {
  const os = data.os
  const cust = data.customer
  const tech = data.technician
  const equip = data.equipment

  const equipName = equip?.name || os?.equipment || 'Equipamento não especificado'
  const equipBrandModel = [equip?.brand, equip?.model].filter(Boolean).join(' / ')

  // Assinaturas: prioriza assinatura local acabada de assinar, senão URL da proposta salva
  const custSig =
    localSignatureUrl ||
    (data.assinatura_cliente_url ? `${PB_URL}${data.assinatura_cliente_url}` : null)
  const techSig = data.assinatura_tecnico_url ? `${PB_URL}${data.assinatura_tecnico_url}` : null

  // Fotos para A4 (máximo 4 para caber na folha)
  const printPhotos = (data.anexos || []).slice(0, 4)

  // Totais
  const items = data.items || []
  const subtotal =
    data.subtotal ||
    items.reduce((acc, it) => acc + (it.valor_unitario || 0) * (it.quantidade || 0), 0)
  const totalGeral = Number(data.total_geral) || 0
  const descontoTotal = Number(data.desconto_total_valor) || 0

  const numParcelas = Math.max(1, data.parcelas || 1)
  const valorParcela = totalGeral / numParcelas

  return (
    <div className="hidden print:block print:w-full print:bg-white print:text-slate-900 print:text-[9.5px] print:leading-tight">
      <div className="print-document a4-single-page mx-auto max-w-4xl bg-white p-0 text-slate-900">
        {/* CABEÇALHO EMPRESA COM LOGO JUCA E CONTATOS EXATOS */}
        <div className="mb-1.5 flex items-center justify-between border-b-2 border-slate-900 pb-1.5">
          <div className="flex items-center gap-2">
            <div className="h-10 w-24 sm:h-11 sm:w-28 shrink-0 overflow-hidden rounded bg-slate-950 p-1 flex items-center justify-center border border-slate-800">
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
              <p className="text-[9.5px] font-semibold text-slate-700 leading-tight mt-0.5">
                {COMPANY_DATA.razaoSocial}
              </p>
              <p className="text-[8.5px] text-slate-600 leading-tight">{COMPANY_DATA.endereco}</p>
              <p className="text-[8.5px] text-slate-600 leading-tight">
                <strong>Telefones:</strong> (67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block rounded bg-indigo-900 px-2 py-0.5 text-white">
              <span className="font-mono text-sm font-black tracking-wider sm:text-base">
                {data.numero_orcamento}
              </span>
            </div>
            {os?.number && (
              <p className="mt-0.5 text-[9px] font-bold text-slate-800 leading-tight">
                O.S. Vinculada #{os.number}
              </p>
            )}
            <p className="text-[8.5px] font-medium text-slate-600 leading-tight">
              <strong>Emissão:</strong> {fmtDate(data.created)}
            </p>
            <p className="text-[8.5px] text-slate-600 leading-tight">
              <strong>Validade:</strong> {data.validade || 15} dias
            </p>
            <p className="text-[8.5px] font-semibold text-indigo-700 uppercase leading-tight">
              Status: {data.status}
            </p>
          </div>
        </div>

        {/* DADOS DO CLIENTE */}
        <div className="mb-1.5 rounded border border-slate-200 p-1.5 text-[9.5px]">
          <h3 className="mb-0.5 border-b border-slate-200 pb-0.5 text-[9.5px] font-bold text-slate-900 uppercase tracking-wide">
            Dados do Cliente
          </h3>
          <div className="grid grid-cols-2 gap-2 leading-tight">
            <div>
              <p>
                <strong className="text-slate-700">Razão / Nome:</strong>{' '}
                <span className="font-semibold text-slate-900">{cust?.name || 'Cliente'}</span>
              </p>
              {cust?.cpf_cnpj && (
                <p>
                  <strong className="text-slate-700">CPF/CNPJ:</strong> {cust.cpf_cnpj}
                </p>
              )}
            </div>
            <div>
              <p>
                <strong className="text-slate-700">Telefone/WhatsApp:</strong>{' '}
                <span className="font-medium text-slate-900">{cust?.phone || '—'}</span>
              </p>
              <p>
                <strong className="text-slate-700">Endereço:</strong>{' '}
                {[
                  cust?.street,
                  cust?.number ? `Nº ${cust.number}` : '',
                  cust?.city ? `${cust.city}${cust?.state ? ` - ${cust.state}` : ''}` : '',
                ]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* RESUMO MÍNIMO DO EQUIPAMENTO (MODELO ORÇAMENTO ENXUTO) */}
        <div className="mb-1.5 rounded border border-indigo-100 bg-indigo-50/30 p-1 text-[9.5px]">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-0.5 mb-0.5">
            <span className="text-[9.5px] font-bold text-indigo-950 uppercase">
              {os?.number ? `Equipamento Vinculado (O.S. ${os.number})` : 'Equipamento'}
            </span>
            <span className="text-[8.5px] text-indigo-700 font-mono">
              Responsável: {tech?.name || 'Equipe JUCA'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 leading-tight">
            <div>
              <strong className="text-slate-700">Equipamento:</strong>{' '}
              <span className="font-bold text-slate-900">{equipName}</span>
            </div>
            <div>
              <strong className="text-slate-700">Marca / Modelo:</strong>{' '}
              <span>{equipBrandModel || '—'}</span>
            </div>
            <div>
              <strong className="text-slate-700">Entrada:</strong>{' '}
              <span>
                {os?.attendance_date ? fmtDate(os.attendance_date) : fmtDate(data.created)}
              </span>
            </div>
          </div>
        </div>

        {/* SEÇÕES SEPARADAS: PRODUTOS E SERVIÇOS */}
        <div className="page-break-inside-avoid mb-2 space-y-2">
          {/* SEÇÃO PRODUTOS */}
          {(() => {
            const prods = items.filter((it) => it.tipo !== 'servico')
            const subProds = prods.reduce(
              (sum, it) => sum + (Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 0),
              0,
            )
            return (
              <div className="rounded border border-indigo-200 bg-white p-2">
                <div className="flex items-center justify-between mb-1 pb-1 border-b border-indigo-100">
                  <h3 className="text-[10px] font-bold text-indigo-950 uppercase tracking-wide flex items-center gap-1">
                    <span>Produtos & Peças</span>
                    <span className="text-[8.5px] font-normal text-indigo-700">
                      ({prods.length} {prods.length === 1 ? 'item' : 'itens'})
                    </span>
                  </h3>
                  <span className="text-[9.5px] font-mono tabular-nums font-bold text-indigo-900">
                    Subtotal Produtos: R$ {fmtCurrency(subProds)}
                  </span>
                </div>
                <table className="w-full border-collapse text-[9.5px]">
                  <thead>
                    <tr className="bg-indigo-50/60 text-slate-700 border-b border-indigo-100">
                      <th className="px-1.5 py-0.5 text-left font-bold w-8">Item</th>
                      <th className="px-1.5 py-0.5 text-left font-bold">Descrição do Produto</th>
                      <th className="px-1.5 py-0.5 text-center font-bold w-10">Qtd</th>
                      <th className="px-1.5 py-0.5 text-right font-bold w-16">Vlr. Unit.</th>
                      <th className="px-1.5 py-0.5 text-right font-bold w-16">Desconto</th>
                      <th className="px-1.5 py-0.5 text-right font-bold w-16">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prods.length > 0 ? (
                      prods.map((it, idx) => {
                        let itemDescVal = 0
                        if (it.desconto_item && it.desconto_item > 0) {
                          const raw = it.valor_unitario * it.quantidade
                          itemDescVal =
                            it.desconto_item_tipo === 'percentual'
                              ? (raw * it.desconto_item) / 100
                              : it.desconto_item
                        }
                        return (
                          <tr key={it.id || idx} className="even:bg-slate-50/50">
                            <td className="px-1.5 py-0.5 text-slate-500 font-mono text-center">
                              {idx + 1}
                            </td>
                            <td className="px-1.5 py-0.5 text-slate-900 font-medium">
                              {it.descricao}
                            </td>
                            <td className="px-1.5 py-0.5 text-center font-mono text-slate-800">
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
                        <td colSpan={6} className="px-1.5 py-1 text-center text-slate-400 italic">
                          Nenhum produto cadastrado nesta proposta.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )
          })()}

          {/* SEÇÃO SERVIÇOS */}
          {(() => {
            const servs = items.filter((it) => it.tipo === 'servico')
            const subServs = servs.reduce(
              (sum, it) => sum + (Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 0),
              0,
            )
            return (
              <div className="rounded border border-emerald-200 bg-white p-2">
                <div className="flex items-center justify-between mb-1 pb-1 border-b border-emerald-100">
                  <h3 className="text-[10px] font-bold text-emerald-950 uppercase tracking-wide flex items-center gap-1">
                    <span>Serviços & Mão de Obra</span>
                    <span className="text-[8.5px] font-normal text-emerald-700">
                      ({servs.length} {servs.length === 1 ? 'serviço' : 'serviços'})
                    </span>
                  </h3>
                  <span className="text-[9.5px] font-mono tabular-nums font-bold text-emerald-900">
                    Subtotal Serviços: R$ {fmtCurrency(subServs)}
                  </span>
                </div>
                <table className="w-full border-collapse text-[9.5px]">
                  <thead>
                    <tr className="bg-emerald-50/60 text-slate-700 border-b border-emerald-100">
                      <th className="px-1.5 py-0.5 text-left font-bold w-8">Item</th>
                      <th className="px-1.5 py-0.5 text-left font-bold">Descrição do Serviço</th>
                      <th className="px-1.5 py-0.5 text-center font-bold w-10">Qtd</th>
                      <th className="px-1.5 py-0.5 text-right font-bold w-16">Vlr. Unit.</th>
                      <th className="px-1.5 py-0.5 text-right font-bold w-16">Desconto</th>
                      <th className="px-1.5 py-0.5 text-right font-bold w-16">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {servs.length > 0 ? (
                      servs.map((it, idx) => {
                        let itemDescVal = 0
                        if (it.desconto_item && it.desconto_item > 0) {
                          const raw = it.valor_unitario * it.quantidade
                          itemDescVal =
                            it.desconto_item_tipo === 'percentual'
                              ? (raw * it.desconto_item) / 100
                              : it.desconto_item
                        }
                        return (
                          <tr key={it.id || idx} className="even:bg-slate-50/50">
                            <td className="px-1.5 py-0.5 text-slate-500 font-mono text-center">
                              {idx + 1}
                            </td>
                            <td className="px-1.5 py-0.5 text-slate-900 font-medium">
                              {it.descricao}
                            </td>
                            <td className="px-1.5 py-0.5 text-center font-mono text-slate-800">
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
                        <td colSpan={6} className="px-1.5 py-1 text-center text-slate-400 italic">
                          Nenhum serviço incluído nesta proposta.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )
          })()}

          {/* RESUMO FINANCEIRO (PRODUTOS + SERVIÇOS - DESCONTOS = TOTAL GERAL) */}
          {(() => {
            const subProds = items
              .filter((it) => it.tipo !== 'servico')
              .reduce(
                (sum, it) => sum + (Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 0),
                0,
              )
            const subServs = items
              .filter((it) => it.tipo === 'servico')
              .reduce(
                (sum, it) => sum + (Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 0),
                0,
              )
            return (
              <div className="mt-1 flex justify-end">
                <div className="w-72 space-y-0.5 rounded bg-slate-50 p-2 border border-slate-300 text-right text-[10px]">
                  <div className="flex justify-between text-indigo-900 font-semibold">
                    <span>Subtotal Produtos:</span>
                    <span className="font-mono tabular-nums">R$ {fmtCurrency(subProds)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-900 font-semibold">
                    <span>Subtotal Serviços:</span>
                    <span className="font-mono tabular-nums">R$ {fmtCurrency(subServs)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-0.5 border-t border-slate-200">
                    <span>Subtotal Bruto:</span>
                    <span className="font-mono font-medium">R$ {fmtCurrency(subtotal)}</span>
                  </div>
                  {descontoTotal > 0 && (
                    <div className="flex justify-between text-rose-600 font-medium">
                      <span>
                        Desconto Concedido{' '}
                        {data.desconto_total_tipo === 'percentual'
                          ? `(${data.desconto_total_percentual}%)`
                          : ''}
                        :
                      </span>
                      <span className="font-mono">- R$ {fmtCurrency(descontoTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t-2 border-slate-900 pt-1 text-[11px] font-black text-slate-900">
                    <span>TOTAL GERAL:</span>
                    <span className="font-mono text-xs text-indigo-900 font-bold tabular-nums">
                      R$ {fmtCurrency(totalGeral)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* CONDIÇÕES DE PAGAMENTO */}
        <div className="page-break-inside-avoid mb-2 rounded border border-slate-200 p-2 text-[10px]">
          <h3 className="mb-0.5 text-[10px] font-bold text-slate-900 uppercase tracking-wide">
            Condições de Pagamento
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 leading-tight">
            <div>
              <strong className="text-slate-700">Forma Escolhida:</strong>{' '}
              <span className="font-medium text-slate-900">
                {FORMA_PAGTO_LABELS[data.forma_pagamento || 'pix'] || data.forma_pagamento || 'PIX'}
              </span>
            </div>
            <div>
              <strong className="text-slate-700">Parcelamento:</strong>{' '}
              <span>
                {numParcelas > 1
                  ? `${numParcelas}x de R$ ${fmtCurrency(valorParcela)}`
                  : '1x (à vista)'}
              </span>
            </div>
            {Number(data.entrada) > 0 && (
              <div>
                <strong className="text-slate-700">Entrada:</strong>{' '}
                <span className="font-mono text-emerald-700 font-bold">
                  R$ {fmtCurrency(data.entrada)}
                </span>
              </div>
            )}
            {Number(data.restante) > 0 && (
              <div>
                <strong className="text-slate-700">Restante:</strong>{' '}
                <span className="font-mono text-slate-800 font-bold">
                  R$ {fmtCurrency(data.restante)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* FOTOS DO ORÇAMENTO (MÁX 4 EM LINHA ÚNICA) */}
        {printPhotos.length > 0 && (
          <div className="page-break-inside-avoid mb-2 rounded border border-slate-200 p-1.5 text-[9px]">
            <h3 className="mb-1 text-[9px] font-bold text-slate-900 uppercase tracking-wide">
              Registros Fotográficos
            </h3>
            <div className="grid grid-cols-4 gap-1.5">
              {printPhotos.slice(0, 4).map((anexo, i) => {
                const photoUrl = `${PB_URL}${anexo.url}`
                return (
                  <div key={anexo.id || i} className="text-center">
                    <img
                      src={photoUrl}
                      alt={anexo.legenda || 'Foto do orçamento'}
                      className="h-14 w-full rounded border border-slate-300 object-cover shadow-2xs"
                    />
                    <p className="mt-0.5 truncate text-[8px] text-slate-600 font-medium">
                      {anexo.legenda || (anexo.tipo === 'foto_defeito' ? 'Defeito' : 'Equipamento')}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* OBSERVAÇÕES */}
        {data.observacoes && (
          <div className="page-break-inside-avoid mb-2 rounded border border-slate-200 p-1.5 text-[9px]">
            <h3 className="mb-0.5 text-[9px] font-bold text-slate-900 uppercase tracking-wide">
              Observações e Garantia
            </h3>
            <p className="whitespace-pre-wrap text-slate-700 leading-tight">{data.observacoes}</p>
          </div>
        )}

        {/* DUAS LINHAS DE ASSINATURA LADO A LADO */}
        <div className="page-break-inside-avoid mt-1 grid grid-cols-2 gap-4 text-[9px]">
          {/* Assinatura do Cliente */}
          <div className="text-center">
            <div className="flex h-9 items-end justify-center border-b border-slate-400 pb-0.5">
              {custSig ? (
                <img
                  src={custSig}
                  alt="Assinatura de Aprovação do Cliente"
                  className="max-h-8 max-w-[150px] object-contain"
                />
              ) : (
                <div className="text-slate-300 italic text-[8px]">
                  Assinatura do Cliente não coletada
                </div>
              )}
            </div>
            <p className="mt-0.5 font-bold text-slate-900 text-[9px] leading-tight">
              {cust?.name || 'Aprovação do Cliente'}
            </p>
            <p className="text-[7.5px] text-slate-500 leading-tight">
              {data.data_assinatura_cliente
                ? `Aprovado em ${fmtDate(data.data_assinatura_cliente)}`
                : custSig
                  ? 'Aprovado digitalmente'
                  : 'Aprovação do Cliente'}
            </p>
          </div>

          {/* Assinatura do Técnico */}
          <div className="text-center">
            <div className="flex h-9 items-end justify-center border-b border-slate-400 pb-0.5">
              {techSig ? (
                <img
                  src={techSig}
                  alt="Assinatura do Responsável Técnico"
                  className="max-h-8 max-w-[150px] object-contain"
                />
              ) : (
                <div className="text-slate-300 italic text-[8px]">
                  Assinatura do Técnico não coletada
                </div>
              )}
            </div>
            <p className="mt-0.5 font-bold text-slate-900 text-[9px] leading-tight">
              {tech?.name ? `Técnico: ${tech.name}` : 'Responsável Técnico'}
            </p>
            <p className="text-[7.5px] text-slate-500 leading-tight">
              JUCA Cartuchos e Informática
            </p>
          </div>
        </div>

        {/* RODAPÉ DO DOCUMENTO */}
        <div className="page-break-inside-avoid mt-1 border-t border-slate-200 pt-0.5 text-center text-[7.5px] text-slate-500">
          <p className="font-semibold text-slate-700 leading-tight">
            Documento gerado em {new Date().toLocaleDateString('pt-BR')} às{' '}
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} pelo
            sistema JUCA Informática
          </p>
          <p className="leading-tight">
            {COMPANY_DATA.endereco} | Telefones: (67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981
          </p>
        </div>
      </div>
    </div>
  )
}
