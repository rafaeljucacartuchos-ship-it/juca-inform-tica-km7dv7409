import { useState } from 'react'
import { COMPANY_DATA, JUCA_LOGO_URL } from '@/lib/company'
import { getFileUrl } from '@/lib/pocketbase/files'
import { ServiceOrder, ServiceOrderItem, StatusHistory, ServiceAttachment } from '@/types'
import { Printer, ArrowLeft, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { getCustomerPhone, getCustomerDisplayName } from '@/services/customers'
import { generateRandomToken, updateOrcamento } from '@/services/orcamentos'
import { buildOsDocumentMessage, buildWhatsAppUrl, openWhatsApp } from '@/lib/whatsapp'
import { offlinePb } from '@/lib/offline-pb'

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
  crediario: 'Crediário',
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
  hideActions?: boolean
  onOrcamentoChange?: (orc: Orcamento) => void
}

export function PrintOrderDocument({
  order,
  items = [],
  attachments = [],
  orcamento,
  orcamentoItens = [],
  orcamentoAnexos = [],
  hideActions = false,
  onOrcamentoChange,
}: PrintOrderDocumentProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false)

  // Helper síncrono para cópia imediata no gesto do clique (essencial para iOS/Safari)
  const copyToClipboardSync = (text: string): boolean => {
    try {
      const textArea = document.createElement('textarea')
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
      document.body.removeChild(textArea)
      if (successful) return true
    } catch {
      /* ignore */
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

  // Enviar link do documento unificado ao cliente via WhatsApp
  const handleEnviarAoCliente = async () => {
    const phone = getCustomerPhone(order.expand?.customer)
    if (!phone) {
      toast({
        title: 'Cliente sem WhatsApp informado',
        description: 'Cadastre o celular do cliente antes de enviar o link.',
        variant: 'destructive',
      })
      return
    }

    setSendingWhatsapp(true)
    const name = getCustomerDisplayName(order.expand?.customer)
    const equip = order.equipment || order.expand?.equipment_ref?.name || ''
    const osNum = order.number

    // 1) DISPARO SÍNCRONO NO GESTO DO TOQUE (ANTES DE QUALQUER AWAIT) para compatibilidade Safari/iOS:
    // Monta o link público imediato da O.S. (/share/:id - OrdemShare), sem exigir login do cliente,
    // contendo documento completo, fotos, assinatura digital, pesquisa de satisfação e botão imprimir.
    const techName = order.expand?.technician?.name
    const serviceRep = order.service_report

    const osDocumentUrl = `${window.location.origin}/share/${order.id}`
    const immediateMsg = buildOsDocumentMessage({
      customerName: name,
      osNumber: osNum,
      numeroOrcamento: orcamento?.numero_orcamento,
      documentUrl: osDocumentUrl,
      equipment: equip,
      technicianName: techName,
      serviceReport: serviceRep,
    })

    // Cópia síncrona imediata da URL e da mensagem no gesto do toque
    copyToClipboardSync(osDocumentUrl)
    copyToClipboardSync(immediateMsg)

    // Se o orçamento já tem token ou não existe orçamento vinculado, atualiza/gera para sincronia
    if (orcamento?.id && !orcamento.token_acesso) {
      try {
        const generated = await generateRandomToken(32)
        const updated = await updateOrcamento(orcamento.id, { token_acesso: generated })
        if (onOrcamentoChange) {
          onOrcamentoChange({ ...orcamento, token_acesso: updated.token_acesso || generated })
        }
      } catch {
        /* ignore */
      }
    }

    const finalDocUrl = osDocumentUrl
    const finalMsg = immediateMsg

    // Registra envio no histórico do cliente / pós-venda
    try {
      const custId = order.customer || order.expand?.customer?.id
      if (custId) {
        await offlinePb.create('pos_venda_messages', {
          customer: custId,
          service_order: order.id,
          tipo: 'resumo_finalizacao',
          status: 'sent',
          scheduled_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          texto_gerado: finalMsg,
          wa_me_link: buildWhatsAppUrl(phone, finalMsg),
          channel: 'whatsapp',
        })
      }
    } catch {
      /* ignore */
    } finally {
      setSendingWhatsapp(false)
    }

    openWhatsApp(phone, finalMsg)
    toast({
      title: 'Documento da O.S. enviado!',
      description: 'Documento oficial da O.S. preparado no WhatsApp do cliente.',
    })
  }

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
  const rawEquipmentPhotos = (eq?.photos || []).map((p) =>
    getFileUrl(eq!.id, p, 'equipment', '300x300'),
  )

  const orderAttachmentPhotos = (attachments || []).map((a) => ({
    url: getFileUrl(a.id, a.file, 'service_attachments', '300x300'),
    caption: a.caption || 'Foto do Atendimento',
  }))

  const orcamentoPhotos = (orcamentoAnexos || []).map((a) => ({
    url: getFileUrl(a.id, a.caminho_arquivo, 'orcamento_anexos', '300x300'),
    caption: a.legenda || (a.tipo === 'foto_defeito' ? 'Defeito' : 'Equipamento'),
  }))

  // Fotos para check-in (até 2 fotos para não estourar a altura)
  const checkInPhotos =
    rawEquipmentPhotos.length > 0
      ? rawEquipmentPhotos.slice(0, 2)
      : orderAttachmentPhotos.slice(0, 2).map((a) => a.url)

  // Registros fotográficos adicionais na grade inferior:
  // Compacta para caber em 1 única folha A4 (máximo 4 miniaturas em linha única)
  const extraPhotos: Array<{ url: string; caption?: string }> = []
  // Se sobrou fotos do equipamento
  if (rawEquipmentPhotos.length > 2) {
    rawEquipmentPhotos.slice(2).forEach((url) => {
      extraPhotos.push({ url, caption: 'Equipamento' })
    })
  }
  // Fotos de orcamento/anexos
  orcamentoPhotos.forEach((a) => {
    extraPhotos.push(a)
  })
  if (orderAttachmentPhotos.length > 2) {
    orderAttachmentPhotos.slice(2).forEach((a) => {
      extraPhotos.push(a)
    })
  }
  // Limita a 4 miniaturas em uma só linha compacta para garantir que caiba em folha única
  const displayExtraPhotos = extraPhotos.slice(0, 4)

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
    <div
      className={
        hideActions
          ? 'w-full print:bg-white print:p-0'
          : 'min-h-screen bg-slate-100/60 p-4 sm:p-6 print:bg-white print:p-0'
      }
    >
      {/* Barra de controle na tela (oculta na impressão) */}
      {!hideActions && (
        <div className="no-print mx-auto mb-4 flex max-w-4xl items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="gap-1.5 text-xs text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="hidden sm:inline text-xs text-slate-500">
              Documento A4 - {order.number}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleEnviarAoCliente}
              disabled={sendingWhatsapp}
              className="gap-1.5 border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold shadow-xs"
              title="Enviar link público do documento unificado via WhatsApp ao cliente"
            >
              <Send className="h-4 w-4 text-emerald-600" />
              <span>Enviar ao Cliente (WhatsApp)</span>
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="gap-2 bg-blue-600 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
            </Button>
          </div>
        </div>
      )}

      {/* Documento A4 (Modelo Oficial O.S. JUCA Informática - Folha Única) */}
      <div className="print-document a4-single-page mx-auto max-w-4xl bg-white p-3 sm:p-4 text-slate-900 shadow-md border border-slate-200 rounded-lg print:border-0 print:shadow-none print:p-0 print:rounded-none text-[9.5px] leading-tight">
        {/* CABEÇALHO COM LOGOMARCA OFICIAL JUCA (COMPACTADO PARA 1 FOLHA) */}
        <div className="mb-1 flex items-center justify-between border-b-2 border-slate-900 pb-1">
          <div className="flex items-center gap-2">
            <div className="h-9 w-22 sm:h-10 sm:w-26 shrink-0 overflow-hidden rounded bg-slate-950 p-1 flex items-center justify-center border border-slate-800">
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
              <h1 className="text-xs sm:text-sm font-extrabold tracking-tight text-slate-900 leading-none">
                {COMPANY_DATA.nomeFantasia || 'JUCA INFORMÁTICA'}
              </h1>
              <p className="text-[9px] font-semibold text-slate-700 leading-tight mt-0.5">
                {COMPANY_DATA.razaoSocial}
              </p>
              <p className="text-[8px] text-slate-600 leading-tight">{COMPANY_DATA.endereco}</p>
              <p className="text-[8px] text-slate-600 leading-tight">
                <strong>Telefones:</strong> {COMPANY_DATA.telefones}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block rounded bg-slate-900 px-2 py-0.5 text-white">
              <span className="font-mono text-xs sm:text-sm font-black tracking-wider">
                {orcamento?.numero_orcamento
                  ? `${order.number} · ${orcamento.numero_orcamento}`
                  : `OS ${order.number}`}
              </span>
            </div>
            <p className="mt-0.5 text-[8px] font-medium text-slate-600 leading-tight">
              <strong>Emissão O.S.:</strong> {fmtDate(order.created)}
            </p>
            {orcamento && (
              <p className="text-[8px] text-slate-600 leading-tight">
                <strong>Validade Orçamento:</strong> {orcamento.validade || 15} dias
              </p>
            )}
            {order.attendance_date && (
              <p className="text-[8px] text-slate-600 leading-tight">
                <strong>Atendimento:</strong> {fmtDate(order.attendance_date)}{' '}
                {order.attendance_time || ''}
              </p>
            )}
          </div>
        </div>

        {/* FAIXA DE STATUS E IDENTIFICAÇÃO RÁPIDA */}
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5 rounded bg-slate-50 border border-slate-200 px-2 py-0.5 text-[8.5px]">
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
        <div className="mb-1.5 grid grid-cols-2 gap-2 text-[9.5px]">
          <div className="rounded border border-slate-200 p-1.5">
            <h3 className="mb-0.5 border-b border-slate-200 pb-0.5 text-[9.5px] font-bold text-slate-900 uppercase tracking-wide">
              Dados do Cliente
            </h3>
            <div className="space-y-0.5 leading-tight">
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

          <div className="rounded border border-slate-200 p-1.5">
            <h3 className="mb-0.5 border-b border-slate-200 pb-0.5 text-[9.5px] font-bold text-slate-900 uppercase tracking-wide">
              Atendimento Técnico
            </h3>
            <div className="space-y-0.5 leading-tight">
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
        <div className="page-break-inside-avoid mb-1 rounded border border-slate-200 p-1.5 text-[9px]">
          <h3 className="mb-0.5 border-b border-slate-200 pb-0.5 text-[9px] font-bold text-slate-900 uppercase tracking-wide">
            Equipamento no Check-in
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div
              className={`${checkInPhotos.length > 0 ? 'md:col-span-2' : 'md:col-span-3'} space-y-0.5`}
            >
              {eq ? (
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
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
                  <div>
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
                <div className="space-y-0.5">
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
                <div className="mt-0.5 rounded bg-slate-50 p-1 border border-slate-100">
                  <strong className="text-slate-800 block text-[8px] uppercase font-bold">
                    Defeito Relatado / Queixa do Cliente:
                  </strong>
                  <p className="text-slate-700 leading-tight">{order.description}</p>
                </div>
              )}
            </div>

            {/* Foto de identificação/check-in do equipamento (compacto) */}
            {checkInPhotos.length > 0 && (
              <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-slate-200 pt-1 md:pt-0 md:pl-2">
                <span className="mb-0.5 text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                  Foto do Check-in
                </span>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {checkInPhotos.map((photoUrl, idx) => (
                    <img
                      key={idx}
                      src={photoUrl}
                      alt="Foto do Equipamento"
                      className="h-11 w-16 rounded border border-slate-300 object-cover shadow-2xs"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RELATÓRIO DO SERVIÇO EXECUTADO (LAUDO TÉCNICO) */}
        {order.service_report && (
          <div className="page-break-inside-avoid mb-1 rounded border border-slate-200 p-1 text-[9px]">
            <h3 className="mb-0.5 text-[9px] font-bold text-slate-900 uppercase tracking-wide">
              Laudo Técnico / Serviço Executado
            </h3>
            <p className="whitespace-pre-wrap text-slate-700 leading-tight">
              {order.service_report}
            </p>
          </div>
        )}

        {/* ITENS, PRODUTOS, PEÇAS E SERVIÇOS (TABELA COMPACTA COM VALORES) */}
        {(() => {
          const rawItems =
            hasOrcamento && orcamentoItens.length > 0
              ? orcamentoItens.map((it) => ({
                  tipo: it.tipo || 'servico',
                  descricao: it.descricao,
                  quantidade: it.quantidade || 1,
                  unitario: it.valor_unitario || 0,
                  desconto: it.desconto_item || 0,
                  total: it.valor_total_item || 0,
                }))
              : items.map((it) => ({
                  tipo: 'servico',
                  descricao: it.description,
                  quantidade: it.quantity || 1,
                  unitario: it.unit_price || 0,
                  desconto: 0,
                  total: it.total || 0,
                }))

          const displayItems = rawItems.slice(0, 6)
          const remainingItemsCount = rawItems.length - displayItems.length

          return (
            <div className="page-break-inside-avoid mb-1 rounded border border-slate-200 p-1 text-[8.5px]">
              <div className="flex items-center justify-between mb-0.5">
                <h3 className="text-[8.5px] font-bold text-slate-900 uppercase tracking-wide">
                  Itens, Peças e Serviços{' '}
                  {hasOrcamento ? `(Orçamento ${orcamento?.numero_orcamento})` : ''}
                </h3>
                {hasOrcamento && (
                  <span className="text-[7.5px] text-indigo-700 font-semibold bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200">
                    Orçamento Vinculado
                  </span>
                )}
              </div>

              <table className="w-full border-collapse text-[8.5px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="border border-slate-300 px-1.5 py-0.5 text-left font-bold">
                      Item / Descrição
                    </th>
                    <th className="border border-slate-300 px-1.5 py-0.5 text-center font-bold w-12">
                      Qtd
                    </th>
                    <th className="border border-slate-300 px-1.5 py-0.5 text-right font-bold w-20">
                      Vlr. Unit.
                    </th>
                    <th className="border border-slate-300 px-1.5 py-0.5 text-right font-bold w-20">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.length > 0 ? (
                    <>
                      {displayItems.map((item, idx) => (
                        <tr key={idx} className="even:bg-slate-50/50">
                          <td className="border border-slate-300 px-1.5 py-0.5 text-slate-900">
                            <span className="font-medium leading-tight">{item.descricao}</span>
                            <span className="ml-1 text-[7px] uppercase px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {item.tipo}
                            </span>
                          </td>
                          <td className="border border-slate-300 px-1.5 py-0.5 text-center font-mono text-slate-700">
                            {item.quantidade || 1}
                          </td>
                          <td className="border border-slate-300 px-1.5 py-0.5 text-right font-mono text-slate-700">
                            R$ {fmtCurrency(item.unitario)}
                          </td>
                          <td className="border border-slate-300 px-1.5 py-0.5 text-right font-mono font-bold text-slate-900">
                            R$ {fmtCurrency(item.total)}
                          </td>
                        </tr>
                      ))}
                      {remainingItemsCount > 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="border border-slate-300 px-1.5 py-0.5 text-center text-[7.5px] text-slate-500 italic bg-slate-50"
                          >
                            + {remainingItemsCount} outro(s) item(ns) discriminado(s) no sistema
                          </td>
                        </tr>
                      )}
                    </>
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="border border-slate-300 px-1.5 py-0.5 text-center text-slate-400 italic"
                      >
                        Nenhum item ou serviço discriminado nesta ordem.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* TOTALIZAÇÃO FINANCEIRA */}
              <div className="mt-1 flex justify-between items-start">
                {hasOrcamento && orcamento ? (
                  <div className="text-[8px] text-slate-600 max-w-sm space-y-0.5">
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
                        <strong className="text-slate-700">Entrada:</strong>
                        <span>{` R$ ${fmtCurrency(orcamento.entrada)}`}</span>
                      </p>
                    )}
                    {orcamento.observacoes && (
                      <p className="italic text-slate-500">Obs: {orcamento.observacoes}</p>
                    )}
                  </div>
                ) : (
                  <div />
                )}

                <div className="w-52 space-y-0.5 text-right text-[8.5px]">
                  {hasOrcamento ? (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span className="font-mono font-medium">{`R$ ${fmtCurrency(orcSubtotal)}`}</span>
                      </div>
                      {orcDescontoTotal > 0 && (
                        <div className="flex justify-between text-rose-600 font-medium">
                          <span>Desconto Total:</span>
                          <span className="font-mono">{`- R$ ${fmtCurrency(orcDescontoTotal)}`}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-900 pt-0.5 text-[9.5px] font-black text-slate-900">
                        <span>TOTAL:</span>
                        <span className="font-mono text-[10px] text-indigo-900 font-bold">
                          {`R$ ${fmtCurrency(orcTotalGeral)}`}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal dos Itens:</span>
                        <span className="font-mono font-medium">{`R$ ${fmtCurrency(soSubtotal)}`}</span>
                      </div>
                      {soDesconto > 0 && (
                        <div className="flex justify-between text-rose-600 font-medium">
                          <span>Desconto:</span>
                          <span className="font-mono">{`- R$ ${fmtCurrency(soDesconto)}`}</span>
                        </div>
                      )}
                      {soAcrescimo > 0 && (
                        <div className="flex justify-between text-emerald-600 font-medium">
                          <span>Acréscimo:</span>
                          <span className="font-mono">{`+ R$ ${fmtCurrency(soAcrescimo)}`}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-900 pt-0.5 text-[9.5px] font-black text-slate-900">
                        <span>TOTAL GERAL:</span>
                        <span className="font-mono text-[10px] font-bold">
                          {`R$ ${fmtCurrency(soTotal)}`}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* REGISTROS FOTOGRÁFICOS (COMPACTO - MÁX 4 EM LINHA ÚNICA) */}
        {displayExtraPhotos.length > 0 && (
          <div className="page-break-inside-avoid mb-1 rounded border border-slate-200 p-1 text-[8px]">
            <h3 className="mb-0.5 text-[8px] font-bold text-slate-900 uppercase tracking-wide">
              Registros Fotográficos (Atendimento / Orçamento)
            </h3>
            <div className="grid grid-cols-4 gap-1">
              {displayExtraPhotos.map((a, i) => (
                <div key={i} className="text-center">
                  <img
                    src={a.url}
                    alt={a.caption || 'Foto'}
                    className="h-9 w-full rounded border border-slate-200 object-cover"
                  />
                  {a.caption && (
                    <p className="mt-0.5 truncate text-[7px] text-slate-500">{a.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DECLARAÇÃO DE RECEBIMENTO DO CLIENTE (TEXTO LEGAL JUCA) */}
        <div className="page-break-inside-avoid mb-1 rounded border border-slate-300 bg-slate-50/70 p-1 text-[7.5px] leading-tight text-slate-700">
          <p className="font-bold text-slate-900 mb-0.5 text-[8px]">
            TERMO DE RECEBIMENTO E CONCORDÂNCIA:
          </p>
          <p>
            Declaro ter recebido o equipamento discriminado nesta Ordem de Serviço devidamente
            revisado, testado e em perfeitas condições de funcionamento, com os serviços descritos
            executados a contento e peças substituídas conforme acordado. Concordo com os valores e
            prazos de garantia estipulados (90 dias para serviços e peças fornecidas). A garantia
            não cobre mau uso, quedas, sobretensão ou intervenção de terceiros.
          </p>
        </div>

        {/* ASSINATURAS (COMPACTAS NO RODAPÉ DA MESMA PÁGINA) */}
        <div className="page-break-inside-avoid mt-1 grid grid-cols-2 gap-4 text-[8.5px]">
          <div className="text-center">
            <div className="flex h-8 items-end justify-center border-b border-slate-400 pb-0.5">
              {techSig ? (
                <img
                  src={techSig}
                  alt="Assinatura do Técnico"
                  className="max-h-7 max-w-[140px] object-contain"
                />
              ) : (
                <div className="text-slate-300 italic text-[7.5px]">Assinatura não coletada</div>
              )}
            </div>
            <p className="mt-0.5 font-bold text-slate-800 text-[8.5px] leading-tight">
              {tech?.name ? `Técnico: ${tech.name}` : 'Técnico Responsável'}
            </p>
            <p className="text-[7px] text-slate-500 leading-tight">{COMPANY_DATA.nomeFantasia}</p>
          </div>

          <div className="text-center">
            <div className="flex h-8 items-end justify-center border-b border-slate-400 pb-0.5">
              {custSig ? (
                <img
                  src={custSig}
                  alt="Assinatura do Cliente"
                  className="max-h-7 max-w-[140px] object-contain"
                />
              ) : (
                <div className="text-slate-300 italic text-[7.5px]">Assinatura não coletada</div>
              )}
            </div>
            <p className="mt-0.5 font-bold text-slate-800 text-[8.5px] leading-tight">
              {cust?.name || cust?.razao_social || 'Assinatura do Cliente'}
            </p>
            <p className="text-[7px] text-slate-500 leading-tight">
              Declaro o recebimento e conferência do equipamento
            </p>
          </div>
        </div>

        {/* RODAPÉ DO DOCUMENTO */}
        <div className="page-break-inside-avoid mt-1 border-t border-slate-200 pt-0.5 text-center text-[7.5px] text-slate-500">
          <p className="font-bold text-slate-700 leading-tight">
            {COMPANY_DATA.razaoSocial} — {COMPANY_DATA.slogan}
          </p>
          <p className="leading-tight">
            {COMPANY_DATA.endereco} | Telefones: {COMPANY_DATA.telefones}
          </p>
        </div>
      </div>
    </div>
  )
}
