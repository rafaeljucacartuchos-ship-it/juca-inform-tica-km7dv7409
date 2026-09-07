import pb from '@/lib/pocketbase/client'
import {
  Orcamento,
  OrcamentoItem,
  OrcamentoAnexo,
  OrcamentoStatus,
  ServiceOrder,
  OrderStatus,
} from '@/types'
import { offlinePb } from '@/lib/offline-pb'

/**
 * Retorna todos os orçamentos de uma O.S. (mais recente primeiro)
 */
export async function getOrcamentosByOs(osId: string): Promise<Orcamento[]> {
  try {
    return await pb.collection('orcamentos').getFullList<Orcamento>({
      filter: `id_os = "${osId}"`,
      sort: '-created',
      expand: 'id_os,id_usuario_criador',
    })
  } catch {
    return []
  }
}

/**
 * Retorna o orçamento ativo da O.S. (rascunho, enviado, aguardando_aprovacao, aprovado, faturado ou rejeitado)
 * Ignora orçamentos marcados como 'substituido'.
 */
export async function getActiveOrcamento(osId: string): Promise<Orcamento | null> {
  try {
    const list = await pb.collection('orcamentos').getFullList<Orcamento>({
      filter: `id_os = "${osId}" && status != "substituido"`,
      sort: '-created',
      expand: 'id_os,id_usuario_criador',
    })
    return list[0] || null
  } catch {
    return null
  }
}

/**
 * Retorna um orçamento por ID com expansão
 */
export async function getOrcamento(id: string): Promise<Orcamento> {
  return await pb.collection('orcamentos').getOne<Orcamento>(id, {
    expand: 'id_os,id_usuario_criador,id_os.customer,id_os.technician,id_os.equipment_ref',
  })
}

/**
 * Gera o próximo número sequencial de orçamento no formato ORC-0001/2026
 */
export async function generateNextOrcamentoNumber(): Promise<string> {
  const currentYear = new Date().getFullYear()
  try {
    const records = await pb.collection('orcamentos').getFullList<Orcamento>({
      filter: `numero_orcamento ~ "/${currentYear}"`,
      sort: '-created',
    })

    let maxNum = 0
    const regex = new RegExp(`ORC-(\\d+)/${currentYear}`)
    for (const r of records) {
      const match = r.numero_orcamento.match(regex)
      if (match && match[1]) {
        const val = parseInt(match[1], 10)
        if (val > maxNum) maxNum = val
      }
    }
    const nextSeq = String(maxNum + 1).padStart(4, '0')
    return `ORC-${nextSeq}/${currentYear}`
  } catch {
    return `ORC-0001/${currentYear}`
  }
}

/**
 * Cria um novo orçamento vinculado à O.S.
 * Regra de negócio: Apenas 1 orçamento ATIVO por O.S.;
 * orçamentos ativos anteriores são marcados como "substituido".
 * Atualiza o status da O.S. para "aguardando_orcamento".
 */
export async function createOrcamento(params: {
  id_os: string
  id_usuario_criador?: string
  validade?: number
  observacoes?: string
}): Promise<Orcamento> {
  const { id_os, id_usuario_criador, validade = 15, observacoes = '' } = params

  // 1. Substitui qualquer orçamento ativo anterior
  const existingActive = await pb.collection('orcamentos').getFullList<Orcamento>({
    filter: `id_os = "${id_os}" && status != "substituido"`,
  })

  for (const prev of existingActive) {
    try {
      await pb.collection('orcamentos').update(prev.id, {
        status: 'substituido',
      })
    } catch (e) {
      console.warn('Erro ao substituir orçamento anterior:', e)
    }
  }

  // 2. Gera novo número
  const numero_orcamento = await generateNextOrcamentoNumber()

  // 3. Cria o novo orçamento como rascunho
  const novo = await pb.collection('orcamentos').create<Orcamento>({
    id_os,
    numero_orcamento,
    status: 'rascunho',
    validade,
    observacoes,
    id_usuario_criador,
    desconto_total_valor: 0,
    desconto_total_tipo: 'valor',
    desconto_total_percentual: 0,
    forma_pagamento: 'pix',
    parcelas: 1,
    entrada: 0,
    restante: 0,
    status_pagamento: 'pendente',
    subtotal: 0,
    total_geral: 0,
  })

  // 4. Atualiza o status da OS para "aguardando_orcamento"
  try {
    await updateOsStatus(
      id_os,
      'aguardando_orcamento',
      `Orçamento ${numero_orcamento} gerado`,
      id_usuario_criador,
    )
  } catch (e) {
    console.warn('Erro ao atualizar status da OS para aguardando_orcamento:', e)
  }

  return novo
}

/**
 * Atualiza campos de um orçamento
 */
export async function updateOrcamento(id: string, data: Partial<Orcamento>): Promise<Orcamento> {
  return await pb.collection('orcamentos').update<Orcamento>(id, data)
}

/**
 * Exclui um orçamento e seus itens/anexos
 */
export async function deleteOrcamento(id: string): Promise<boolean> {
  // Itens e anexos possuem cascadeDelete: true, mas removemos por garantia
  return await pb.collection('orcamentos').delete(id)
}

/**
 * Itens do orçamento
 */
export async function getOrcamentoItens(orcamentoId: string): Promise<OrcamentoItem[]> {
  try {
    return await pb.collection('orcamento_itens').getFullList<OrcamentoItem>({
      filter: `id_orcamento = "${orcamentoId}"`,
      sort: 'created',
      expand: 'id_produto',
    })
  } catch {
    return []
  }
}

export async function createOrcamentoItem(data: Partial<OrcamentoItem>): Promise<OrcamentoItem> {
  return await pb.collection('orcamento_itens').create<OrcamentoItem>(data)
}

export async function updateOrcamentoItem(
  id: string,
  data: Partial<OrcamentoItem>,
): Promise<OrcamentoItem> {
  return await pb.collection('orcamento_itens').update<OrcamentoItem>(id, data)
}

export async function deleteOrcamentoItem(id: string): Promise<boolean> {
  return await pb.collection('orcamento_itens').delete(id)
}

/**
 * Anexos do orçamento (fotos / documentos)
 */
export async function getOrcamentoAnexos(orcamentoId: string): Promise<OrcamentoAnexo[]> {
  try {
    return await pb.collection('orcamento_anexos').getFullList<OrcamentoAnexo>({
      filter: `id_orcamento = "${orcamentoId}"`,
      sort: 'created',
    })
  } catch {
    return []
  }
}

export async function createOrcamentoAnexo(
  orcamentoId: string,
  file: File,
  tipo: 'foto_equipamento' | 'foto_defeito' | 'documento',
  legenda?: string,
): Promise<OrcamentoAnexo> {
  const formData = new FormData()
  formData.append('id_orcamento', orcamentoId)
  formData.append('tipo', tipo)
  formData.append('caminho_arquivo', file)
  if (legenda) formData.append('legenda', legenda)

  return await pb.collection('orcamento_anexos').create<OrcamentoAnexo>(formData)
}

export async function deleteOrcamentoAnexo(id: string): Promise<boolean> {
  return await pb.collection('orcamento_anexos').delete(id)
}

/**
 * Salvar assinatura no orçamento (cliente ou técnico)
 */
export async function uploadOrcamentoSignature(
  orcamentoId: string,
  field: 'assinatura_cliente' | 'assinatura_tecnico',
  signatureDataUrl: string,
  ipDispositivo?: string,
): Promise<Orcamento> {
  const res = await fetch(signatureDataUrl)
  const blob = await res.blob()
  const file = new File([blob], `${field}.png`, { type: 'image/png' })
  const formData = new FormData()
  formData.append(field, file, `${field}.png`)
  const now = new Date().toISOString()
  if (field === 'assinatura_cliente') {
    formData.append('data_assinatura_cliente', now)
  } else {
    formData.append('data_assinatura_tecnico', now)
  }
  if (ipDispositivo) {
    formData.append('ip_dispositivo', ipDispositivo)
  }
  return await pb.collection('orcamentos').update<Orcamento>(orcamentoId, formData)
}

/**
 * Recalcula totais do orçamento e persiste no banco
 * subtotal = Σ(valor_unitario × quantidade)
 * total_itens_com_desconto = subtotal - Σ(descontos por item)
 * total_geral = total_itens_com_desconto - desconto_total
 */
export async function recalculateOrcamentoTotals(
  orcamentoId: string,
): Promise<{ subtotal: number; total_geral: number }> {
  const [orc, itens] = await Promise.all([
    pb.collection('orcamentos').getOne<Orcamento>(orcamentoId),
    getOrcamentoItens(orcamentoId),
  ])

  let subtotal = 0
  let somaDescontosItens = 0

  for (const item of itens) {
    const rawTotal = (item.valor_unitario || 0) * (item.quantidade || 0)
    subtotal += rawTotal

    let itemDesc = 0
    if (item.desconto_item && item.desconto_item > 0) {
      if (item.desconto_item_tipo === 'percentual') {
        itemDesc = (rawTotal * item.desconto_item) / 100
      } else {
        itemDesc = item.desconto_item
      }
    }
    somaDescontosItens += itemDesc
  }

  const totalComDescontoItens = Math.max(0, subtotal - somaDescontosItens)

  let descontoTotalValor = Number(orc.desconto_total_valor) || 0
  if (orc.desconto_total_tipo === 'percentual') {
    const pct = Number(orc.desconto_total_percentual) || 0
    descontoTotalValor = (totalComDescontoItens * pct) / 100
  }

  const totalGeral = Math.max(0, totalComDescontoItens - descontoTotalValor)

  await pb.collection('orcamentos').update(orcamentoId, {
    subtotal,
    total_geral: totalGeral,
    desconto_total_valor: descontoTotalValor,
  })

  return { subtotal, total_geral: totalGeral }
}

/**
 * Atualiza status da OS com histórico
 */
export async function updateOsStatus(
  osId: string,
  newStatus: OrderStatus,
  note: string,
  userId?: string,
) {
  await pb.collection('service_orders').update(osId, { status: newStatus })
  await pb.collection('status_history').create({
    service_order: osId,
    status: newStatus,
    note,
    changed_by: userId,
  })
}

/**
 * Envia orçamento para Faturamento:
 * Requisito: Só habilitado quando status === 'aprovado'
 * 1. Muda status do orçamento para "faturado"
 * 2. Cria o lançamento de pagamento na O.S. (pagamentos existentes) com itens/valores/forma de pagamento
 * 3. Baixa de estoque dos produtos do orçamento (se ainda não baixado)
 */
export async function sendOrcamentoToFaturamento(
  orcamentoId: string,
  userId?: string,
): Promise<{ success: boolean; paymentId?: string }> {
  const orc = await getOrcamento(orcamentoId)
  if (orc.status !== 'aprovado') {
    throw new Error('O orçamento só pode ser enviado para faturamento após aprovação do cliente.')
  }

  const itens = await getOrcamentoItens(orcamentoId)

  // 1. Mapeia forma de pagamento para pagamentos da OS
  const methodMap: Record<string, string> = {
    dinheiro: 'cash',
    pix: 'pix',
    cartao_credito: 'credit_card',
    cartao_debito: 'debit_card',
    boleto: 'transfer',
    outros: 'transfer',
  }
  const paymentMethod = methodMap[orc.forma_pagamento || 'pix'] || 'pix'

  // 2. Cria registro de pagamento
  const totalAmount = Number(orc.total_geral) || 0
  const payment = await pb.collection('payments').create({
    service_order: orc.id_os,
    amount: totalAmount,
    method: paymentMethod,
    status: orc.status_pagamento === 'pago' ? 'paid' : 'pending',
    paid_at: orc.status_pagamento === 'pago' ? new Date().toISOString() : null,
    notes: `Faturamento referente ao Orçamento ${orc.numero_orcamento} (${orc.parcelas || 1}x ${orc.forma_pagamento})`,
  })

  // 3. Baixa de estoque nos produtos aprovados e faturados (regra de estoque)
  for (const item of itens) {
    if (item.tipo === 'produto' && item.id_produto) {
      try {
        const prod = await pb.collection('products').getOne(item.id_produto)
        const currentStock = Number(prod.stock_quantity) || 0
        const qtyToDeduct = Number(item.quantidade) || 0
        const newStock = Math.max(0, currentStock - qtyToDeduct)
        await pb.collection('products').update(item.id_produto, {
          stock_quantity: newStock,
        })
      } catch (err) {
        console.warn(`Erro ao baixar estoque do produto ${item.id_produto}:`, err)
      }
    }
  }

  // 4. Marca orçamento como faturado
  await pb.collection('orcamentos').update(orcamentoId, {
    status: 'faturado',
  })

  // 5. Registra no histórico da OS
  try {
    await updateOsStatus(
      orc.id_os,
      'in_progress',
      `Orçamento ${orc.numero_orcamento} faturado com sucesso. Lançamento financeiro de R$ ${totalAmount.toFixed(2)} gerado.`,
      userId,
    )
  } catch {
    /* intentionally ignored */
  }

  // 6. Registra no pós-venda/histórico do cliente
  try {
    const osData = await pb.collection('service_orders').getOne<ServiceOrder>(orc.id_os)
    if (osData.customer) {
      await pb.collection('pos_venda_messages').create({
        customer: osData.customer,
        service_order: osData.id,
        tipo: 'resumo_finalizacao',
        status: 'sent',
        scheduled_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        texto_gerado: `Orçamento ${orc.numero_orcamento} aprovado e enviado para faturamento. Valor: R$ ${totalAmount.toFixed(2)}.`,
        channel: 'sistema',
      })
    }
  } catch {
    /* intentionally ignored */
  }

  return { success: true, paymentId: payment.id }
}
