import { COMPANY_DATA, JUCA_LOGO_URL } from '@/lib/company'
import { getFileUrl } from '@/lib/pocketbase/files'
import { ServiceOrder, ServiceOrderItem, StatusHistory, ServiceAttachment } from '@/types'
import { Printer, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  aguardando_orcamento: 'Aguardando Orçamento',
  orcamento_enviado: 'Orçamento Enviado',
  in_progress: 'Em Andamento',
  paused: 'Pausada',
  waiting_parts: 'Aguardando Peças',
  completed: 'Concluída',
  closed: 'Fechada',
  orcamento_rejeitado: 'Orçamento Rejeitado',
  cancelled: 'Cancelada',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  notebook: 'Notebook',
  desktop: 'Desktop / Computador',
  monitor: 'Monitor',
  printer: 'Impressora',
  smartphone: 'Smartphone / Celular',
  tablet: 'Tablet',
  network: 'Equipamento de Rede',
  other: 'Outro Equipamento',
}

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

import { Orcamento, OrcamentoItem, OrcamentoAnexo } from '@/types'

const FORMA_PAGTO_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro em Espécie',
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto Bancário',
  outros: 'A Combinar',
}

interface PrintOrderDocumentProps {
  order: ServiceOrder
  items?: ServiceOrderItem[]
  history?: StatusHistory[]
  attachments?: ServiceAttachment[]
  orcamento?: Orcamento | null
  orcamentoItens?: OrcamentoItem[]
  orcamentoAnexos?: OrcamentoAnexo[]
}

export function PrintOrderDocument({
  order,
  items = [],
  attachments = [],
  orcamento,
  orcamentoItens = [],
  orcamentoAnexos = [],
}: PrintOrderDocumentProps) {
  const navigate = useNavigate()

  // Assinaturas unificadas: usa assinatura do orçamento se existir, fallback para a da O.S.
  const techSig = orcamento?.assinatura_tecnico
    ? getFileUrl(orcamento.id, orcamento.assinatura_tecnico, 'orcamentos')
    : order.technician_signature
      ? getFileUrl(order.id, order.technician_signature, 'service_orders')
      : null

  const custSig = orcamento?.assinatura_cliente
    ? getFileUrl(orcamento.id, orcamento.assinatura_cliente, 'orcamentos')
    : order.customer_signature
      ? getFileUrl(order.id, order.customer_signature, 'service_orders')
      : null

  const eq = order.expand?.equipment_ref
  const cust = order.expand?.customer
  const tech = order.expand?.technician

  // Coleta fotos do equipamento e atendimento sem duplicação
  const equipmentPhotos = (eq?.photos || []).map((p) =>
    getFileUrl(eq!.id, p, 'equipment', '400x400'),
  )

  const orderAttachmentPhotos = (attachments || []).map((a) => ({
    url: getFileUrl(a.id, a.file, 'service_attachments', '400x400'),
    caption: a.caption || 'Foto do Atendimento',
  }))

  const orcamentoPhotos = (orcamentoAnexos || []).map((a) => ({
    url: getFileUrl(a.id, a.caminho_arquivo, 'orcamento_anexos', '400x400'),
    caption: a.legenda || (a.tipo === 'foto_defeito' ? 'Defeito' : 'Equipamento'),
  }))

  // Cálculo financeiro unificado:
  // Se houver orçamento vinculado com itens, a discriminação financeira segue a do orçamento
  const hasOrcamento = !!orcamento
  const orcSubtotal = (orcamentoItens || []).reduce(
    (acc, it) => acc + (it.valor_unitario || 0) * (it.quantidade || 0),
    0,
  )
  const orcDescontoTotal = Number(orcamento?.desconto_total_valor) || 0
  const orcTotalGeral =
    orcamento?.total_geral !== undefined && orcamento.total_geral !== null
      ? Number(orcamento.total_geral)
      : Math.max(0, orcSubtotal - orcDescontoTotal)

  const soSubtotal = (items || []).reduce((acc, it) => acc + (Number(it.total) || 0), 0)
  const soDesconto = Number(order.desconto) || 0
  const soAcrescimo = Number(order.acrescimo) || 0
  const soTotal =
    soSubtotal > 0 || (order.total ?? 0) === 0
      ? Math.max(0, soSubtotal + soAcrescimo - soDesconto)
      : Number(order.total) || 0

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
          <span className="text-xs text-slate-500">Impressão O.S. A4 - {order.number}</span>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="gap-2 bg-blue-600 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* Documento A4 */}
      <div className="print-document mx-auto max-w-4xl bg-white p-6 text-slate-900 shadow-lg border border-slate-200 rounded-lg print:border-0 print:shadow-none print:p-0 print:rounded-none">
        {/* CABEÇALHO COM LOGOMARCA OFICIAL JUCA */}
        <div className="mb-4 flex items-center justify-between border-b-2 border-slate-900 pb-3">
          <div className="flex items-center gap-3.5">
            <div className="h-14 w-32 sm:h-16 sm:w-36 shrink-0 overflow-hidden rounded-md bg-slate-950 p-1 flex items-center justify-center border border-slate-800">
              <img
                src={JUCA_LOGO_URL}
                alt="JUCA Informática"
                className="h-full w-full object-contain"
                onError={(e) => {
                  // Fallback para SVG se houver falha de rede
                  ;(e.target as HTMLImageElement).src = '/logo.svg'
                }}
              />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                {COMPANY_DATA.nomeFantasia || 'JUCA INFORMÁTICA'}
              </h1>
              <p className="text-[11px] font-semibold text-slate-700">{COMPANY_DATA.razaoSocial}</p>
              <p className="text-[10px] text-slate-600">{COMPANY_DATA.endereco}</p>
              <p className="text-[10px] text-slate-600">
                <strong>Telefones:</strong> {COMPANY_DATA.telefones}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block rounded-md bg-slate-900 px-3 py-1 text-white">
              <span className="font-mono text-base font-black tracking-wider sm:text-lg">
                {orcamento?.numero_orcamento
                  ? `${order.number} · ${orcamento.numero_orcamento}`
                  : `OS ${order.number}`}
              </span>
            </div>
            <p className="mt-1 text-[10px] font-medium text-slate-600">
              <strong>Emissão O.S.:</strong> {fmtDate(order.created)}
            </p>
            {orcamento && (
              <p className="text-[10px] text-slate-600">
                <strong>Validade Orçamento:</strong> {orcamento.validade || 15} dias
              </p>
            )}
            {order.attendance_date && (
              <p className="text-[10px] text-slate-600">
                <strong>Atendimento:</strong> {fmtDate(order.attendance_date)}{' '}
                {order.attendance_time || ''}
              </p>
            )}
          </div>
        </div>

        {/* FAIXA DE STATUS E IDENTIFICAÇÃO RÁPIDA */}
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs">
          <div>
            <span className="text-slate-500 font-medium">Status O.S.: </span>
            <span className="font-bold text-slate-900 uppercase">
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>
          {orcamento && (
            <div>
              <span className="text-slate-500 font-medium">Status Orçamento: </span>
              <span className="font-bold text-indigo-700 uppercase">{orcamento.status}</span>
            </div>
          )}
          <div>
            <span className="text-slate-500 font-medium">Prioridade: </span>
            <span className="font-bold text-slate-900">
              {PRIORITY_LABELS[order.priority] || order.priority}
            </span>
          </div>
          <div className="min-w-0 flex-1 truncate text-right">
            <span className="text-slate-500 font-medium">Título / Atendimento: </span>
            <span className="font-bold text-slate-900">{order.title}</span>
          </div>
        </div>

        {/* DADOS DO CLIENTE E TÉCNICO */}
        <div className="mb-3.5 grid grid-cols-2 gap-3 text-[11px]">
          <div className="rounded-md border border-slate-200 p-2.5">
            <h3 className="mb-1.5 border-b border-slate-200 pb-1 text-xs font-bold text-slate-900 uppercase tracking-wide">
              Dados do Cliente
            </h3>
            <div className="space-y-0.5 leading-snug">
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
              <p>
                <strong className="text-slate-700">Telefone/Celular:</strong>{' '}
                <span className="font-medium text-slate-900">
                  {cust?.celular || cust?.phone || '—'}
                </span>
              </p>
              {cust?.cpf_cnpj && (
                <p>
                  <strong className="text-slate-700">CPF/CNPJ:</strong> {cust.cpf_cnpj}
                </p>
              )}
              {cust?.email && (
                <p>
                  <strong className="text-slate-700">E-mail:</strong> {cust.email}
                </p>
              )}
              <p>
                <strong className="text-slate-700">Endereço:</strong>{' '}
                {[
                  cust?.endereco || cust?.street,
                  cust?.number ? `Nº ${cust.number}` : '',
                  cust?.bairro ? `Bairro ${cust.bairro}` : '',
                  cust?.city ? `${cust.city}${cust?.state ? ` - ${cust.state}` : ''}` : '',
                  cust?.zip ? `CEP: ${cust.zip}` : '',
                ]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 p-2.5">
            <h3 className="mb-1.5 border-b border-slate-200 pb-1 text-xs font-bold text-slate-900 uppercase tracking-wide">
              Atendimento Técnico
            </h3>
            <div className="space-y-0.5 leading-snug">
              <p>
                <strong className="text-slate-700">Técnico Responsável:</strong>{' '}
                <span className="font-semibold text-slate-900">
                  {tech?.name || 'Não atribuído'}
                </span>
              </p>
              <p>
                <strong className="text-slate-700">Telefone do Técnico:</strong>{' '}
                {tech?.phone || '—'}
              </p>
              {order.started_at && (
                <p>
                  <strong className="text-slate-700">Início do Atendimento:</strong>{' '}
                  {fmtDate(order.started_at)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* SEÇÃO DO EQUIPAMENTO COM FOTO DE CHECK-IN E DETALHES COMPLETOS */}
        <div className="page-break-inside-avoid mb-3.5 rounded-md border border-slate-200 p-2.5 text-[11px]">
          <h3 className="mb-1.5 border-b border-slate-200 pb-1 text-xs font-bold text-slate-900 uppercase tracking-wide">
            Equipamento no Check-in
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div
              className={`${equipmentPhotos.length > 0 || orderAttachmentPhotos.length > 0 ? 'md:col-span-2' : 'md:col-span-3'} space-y-1`}
            >
              {eq ? (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div>
                    <strong className="text-slate-700">Tipo de Atendimento:</strong>{' '}
                    <span className="font-semibold text-slate-900">
                      {order.expand?.attendance_type?.name || '—'}
                    </span>
                  </div>
                  <div>
                    <strong className="text-slate-700">Equipamento:</strong>{' '}
                    <span className="font-bold text-slate-900">{eq.name}</span>
                  </div>
                  <div>
                    <strong className="text-slate-700">Tipo:</strong>{' '}
                    <span>{EQUIPMENT_TYPE_LABELS[eq.type || ''] || eq.type || '—'}</span>
                  </div>
                  <div>
                    <strong className="text-slate-700">Marca:</strong> {eq.brand || '—'}
                  </div>
                  <div>
                    <strong className="text-slate-700">Modelo:</strong> {eq.model || '—'}
                  </div>
                  <div className="col-span-2">
                    <strong className="text-slate-700">N° de Série:</strong>{' '}
                    <span className="font-mono font-semibold">{eq.serial_number || '—'}</span>
                  </div>
                  {eq.notes && (
                    <div className="col-span-2 text-slate-600">
                      <strong className="text-slate-700">Obs do Equipamento:</strong> {eq.notes}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div>
                    <strong className="text-slate-700">Tipo de Atendimento:</strong>{' '}
                    <span className="font-semibold text-slate-900">
                      {order.expand?.attendance_type?.name || '—'}
                    </span>
                  </div>
                  <div>
                    <strong className="text-slate-700">Equipamento / Modelo:</strong>{' '}
                    <span className="font-semibold text-slate-900">
                      {order.equipment || 'Não especificado'}
                    </span>
                  </div>
                </div>
              )}

              {/* Descrição do problema / Diagnóstico */}
              {order.description && (
                <div className="mt-2 rounded bg-slate-50 p-2 border border-slate-100">
                  <strong className="text-slate-800 block mb-0.5">
                    Defeito Relatado / Queixa do Cliente:
                  </strong>
                  <p className="text-slate-700 leading-relaxed">{order.description}</p>
                </div>
              )}
            </div>

            {/* Foto de identificação/check-in do equipamento */}
            {(equipmentPhotos.length > 0 || orderAttachmentPhotos.length > 0) && (
              <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-3">
                <span className="mb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Foto do Check-in
                </span>
                {equipmentPhotos.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {equipmentPhotos.slice(0, 2).map((photoUrl, idx) => (
                      <img
                        key={idx}
                        src={photoUrl}
                        alt="Foto do Equipamento"
                        className="h-24 w-28 rounded border border-slate-300 object-cover shadow-2xs"
                      />
                    ))}
                  </div>
                ) : orderAttachmentPhotos.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <img
                      src={orderAttachmentPhotos[0].url}
                      alt={orderAttachmentPhotos[0].caption}
                      className="h-24 w-28 rounded border border-slate-300 object-cover shadow-2xs"
                    />
                    <span className="mt-0.5 text-[9px] text-slate-500 truncate max-w-[120px]">
                      {orderAttachmentPhotos[0].caption}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* RELATÓRIO DO SERVIÇO EXECUTADO */}
        {order.service_report && (
          <div className="page-break-inside-avoid mb-3.5 rounded-md border border-slate-200 p-2.5 text-[11px]">
            <h3 className="mb-1 text-xs font-bold text-slate-900 uppercase tracking-wide">
              Laudo Técnico / Serviço Executado
            </h3>
            <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">
              {order.service_report}
            </p>
          </div>
        )}

        {/* ITENS, PRODUTOS, PEÇAS E SERVIÇOS (TABELA UNIFICADA COM VALORES) */}
        <div className="page-break-inside-avoid mb-3.5 rounded-md border border-slate-200 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Itens, Peças e Serviços{' '}
              {hasOrcamento ? `(Orçamento ${orcamento?.numero_orcamento})` : ''}
            </h3>
            {hasOrcamento && (
              <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                Orçamento Vinculado
              </span>
            )}
          </div>

          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 px-2 py-1.5 text-left font-bold">
                  Item / Descrição
                </th>
                <th className="border border-slate-300 px-2 py-1.5 text-center font-bold w-16">
                  Qtd
                </th>
                <th className="border border-slate-300 px-2 py-1.5 text-right font-bold w-24">
                  Vlr. Unit.
                </th>
                <th className="border border-slate-300 px-2 py-1.5 text-right font-bold w-24">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {hasOrcamento ? (
                orcamentoItens.length > 0 ? (
                  orcamentoItens.map((item, idx) => (
                    <tr key={item.id || idx} className="even:bg-slate-50/50">
                      <td className="border border-slate-300 px-2 py-1 text-slate-900">
                        <span className="font-medium">{item.descricao}</span>
                        <span className="ml-1.5 text-[9px] uppercase px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {item.tipo}
                        </span>
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-center font-mono text-slate-700">
                        {item.quantidade || 1}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-right font-mono text-slate-700">
                        R$ {fmtCurrency(item.valor_unitario)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold text-slate-900">
                        R$ {fmtCurrency(item.valor_total_item)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="border border-slate-300 px-2 py-2 text-center text-slate-400 italic"
                    >
                      Nenhum item discriminado no orçamento vinculado.
                    </td>
                  </tr>
                )
              ) : items.length > 0 ? (
                items.map((item, idx) => (
                  <tr key={item.id || idx} className="even:bg-slate-50/50">
                    <td className="border border-slate-300 px-2 py-1 text-slate-900">
                      {item.description || 'Item de serviço'}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center font-mono text-slate-700">
                      {item.quantity || 1}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-right font-mono text-slate-700">
                      R$ {fmtCurrency(item.unit_price)}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold text-slate-900">
                      R$ {fmtCurrency(item.total)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="border border-slate-300 px-2 py-2 text-center text-slate-400 italic"
                  >
                    Nenhum item ou serviço discriminado nesta ordem.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* TOTALIZAÇÃO FINANCEIRA */}
          <div className="mt-2 flex justify-between items-start">
            {hasOrcamento && orcamento ? (
              <div className="text-[10px] text-slate-600 max-w-sm space-y-0.5">
                <p>
                  <strong className="text-slate-700">Forma de Pagamento:</strong>{' '}
                  {FORMA_PAGTO_LABELS[orcamento.forma_pagamento || 'pix'] ||
                    orcamento.forma_pagamento}
                </p>
                <p>
                  <strong className="text-slate-700">Condição:</strong>{' '}
                  {(orcamento.parcelas || 1) > 1
                    ? `${orcamento.parcelas}x de R$ ${fmtCurrency(orcTotalGeral / (orcamento.parcelas || 1))}`
                    : '1x à vista'}
                </p>
                {Number(orcamento.entrada) > 0 && (
                  <p>
                    <strong className="text-slate-700">Entrada:</strong> R${' '}
                    {fmtCurrency(orcamento.entrada)}
                  </p>
                )}
                {orcamento.observacoes && (
                  <p className="italic text-slate-500 pt-1">Obs: {orcamento.observacoes}</p>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="w-64 space-y-1 text-right text-[11px]">
              {hasOrcamento ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-medium">R$ {fmtCurrency(orcSubtotal)}</span>
                  </div>
                  {orcDescontoTotal > 0 && (
                    <div className="flex justify-between text-rose-600 font-medium">
                      <span>Desconto Total:</span>
                      <span className="font-mono">- R$ {fmtCurrency(orcDescontoTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t-2 border-slate-900 pt-1 text-xs font-black text-slate-900">
                    <span>TOTAL:</span>
                    <span className="font-mono text-sm text-indigo-900">
                      R$ {fmtCurrency(orcTotalGeral)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal dos Itens:</span>
                    <span className="font-mono font-medium">R$ {fmtCurrency(soSubtotal)}</span>
                  </div>
                  {soDesconto > 0 && (
                    <div className="flex justify-between text-rose-600 font-medium">
                      <span>Desconto:</span>
                      <span className="font-mono">- R$ {fmtCurrency(soDesconto)}</span>
                    </div>
                  )}
                  {soAcrescimo > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Acréscimo:</span>
                      <span className="font-mono">+ R$ {fmtCurrency(soAcrescimo)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t-2 border-slate-900 pt-1 text-xs font-black text-slate-900">
                    <span>TOTAL GERAL:</span>
                    <span className="font-mono text-sm">R$ {fmtCurrency(soTotal)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* FOTOS ADICIONAIS DO ATENDIMENTO E ORÇAMENTO */}
        {(orderAttachmentPhotos.length > 1 || orcamentoPhotos.length > 0) && (
          <div className="page-break-inside-avoid mb-3.5 rounded-md border border-slate-200 p-2.5">
            <h3 className="mb-1.5 text-xs font-bold text-slate-900 uppercase tracking-wide">
              Registros Fotográficos (Atendimento / Orçamento)
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {orderAttachmentPhotos.slice(1).map((a, i) => (
                <div key={`att-${i}`} className="text-center">
                  <img
                    src={a.url}
                    alt={a.caption}
                    className="h-20 w-full rounded border border-slate-200 object-cover"
                  />
                  {a.caption && (
                    <p className="mt-0.5 truncate text-[9px] text-slate-500">{a.caption}</p>
                  )}
                </div>
              ))}
              {orcamentoPhotos.slice(0, 4).map((a, i) => (
                <div key={`orc-${i}`} className="text-center">
                  <img
                    src={a.url}
                    alt={a.caption}
                    className="h-20 w-full rounded border border-slate-200 object-cover"
                  />
                  {a.caption && (
                    <p className="mt-0.5 truncate text-[9px] text-slate-500">{a.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ASSINATURAS */}
        <div className="page-break-inside-avoid mt-5 grid grid-cols-2 gap-8 text-[11px]">
          <div className="text-center">
            <div className="flex h-16 items-end justify-center border-b border-slate-400 pb-1">
              {techSig ? (
                <img
                  src={techSig}
                  alt="Assinatura do Técnico"
                  className="max-h-14 max-w-full object-contain"
                />
              ) : (
                <div className="text-slate-300 italic text-[10px]">Assinatura não coletada</div>
              )}
            </div>
            <p className="mt-1 font-bold text-slate-800">
              {tech?.name ? `Técnico: ${tech.name}` : 'Técnico Responsável'}
            </p>
            <p className="text-[10px] text-slate-500">{COMPANY_DATA.nomeFantasia}</p>
          </div>

          <div className="text-center">
            <div className="flex h-16 items-end justify-center border-b border-slate-400 pb-1">
              {custSig ? (
                <img
                  src={custSig}
                  alt="Assinatura do Cliente"
                  className="max-h-14 max-w-full object-contain"
                />
              ) : (
                <div className="text-slate-300 italic text-[10px]">Assinatura não coletada</div>
              )}
            </div>
            <p className="mt-1 font-bold text-slate-800">
              {cust?.name || cust?.razao_social || 'Assinatura do Cliente'}
            </p>
            <p className="text-[10px] text-slate-500">
              Declaro o recebimento e conferência do equipamento
            </p>
          </div>
        </div>

        {/* RODAPÉ DO DOCUMENTO */}
        <div className="page-break-inside-avoid mt-5 border-t border-slate-200 pt-2 text-center text-[9px] text-slate-500">
          <p className="font-bold text-slate-700">
            {COMPANY_DATA.razaoSocial} — {COMPANY_DATA.slogan}
          </p>
          <p>
            {COMPANY_DATA.endereco} | Telefones: {COMPANY_DATA.telefones}
          </p>
        </div>
      </div>
    </div>
  )
}
