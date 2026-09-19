import pb from '@/lib/pocketbase/client'
import {
  Customer,
  Orcamento,
  Payment,
  PaymentMethod,
  ServiceOrder,
  ServiceOrderItem,
  StatusHistory,
} from '@/types'

export const getServiceOrders = (filterStr = '', sortStr = '-created') =>
  pb.collection('service_orders').getFullList<ServiceOrder>({
    filter: filterStr,
    expand: 'customer,technician,appointment,equipment_ref,attendance_type',
    sort: sortStr,
  })

export const getServiceOrder = (id: string) =>
  pb.collection('service_orders').getOne<ServiceOrder>(id, {
    expand: 'customer,technician,appointment,equipment_ref,attendance_type',
  })

export const createServiceOrder = (data: Partial<ServiceOrder>) =>
  pb.collection('service_orders').create<ServiceOrder>(data, {
    expand: 'customer,technician,equipment_ref,attendance_type',
  })

export const updateServiceOrder = (id: string, data: Partial<ServiceOrder>) =>
  pb.collection('service_orders').update<ServiceOrder>(id, data, {
    expand: 'customer,technician,equipment_ref,attendance_type',
  })

export const getOrderItems = (orderId: string) =>
  pb.collection('service_order_items').getFullList<ServiceOrderItem>({
    filter: `service_order = "${orderId}"`,
    expand: 'service,product',
    sort: 'created',
  })

export const getAllOrderItems = () =>
  pb.collection('service_order_items').getFullList<ServiceOrderItem>({
    expand: 'service,product',
    sort: 'created',
  })

export const createOrderItem = async (data: Partial<ServiceOrderItem>) => {
  const item = await pb.collection('service_order_items').create<ServiceOrderItem>(data)
  if (data.service_order) {
    try {
      await syncServiceOrderTotal(data.service_order)
    } catch {
      /* best effort */
    }
  }
  return item
}

export const updateOrderItem = async (id: string, data: Partial<ServiceOrderItem>) => {
  const item = await pb.collection('service_order_items').update<ServiceOrderItem>(id, data)
  const orderId = data.service_order || item.service_order
  if (orderId) {
    try {
      await syncServiceOrderTotal(orderId)
    } catch {
      /* best effort */
    }
  }
  return item
}

export const deleteOrderItem = async (id: string, orderId?: string) => {
  let targetOrderId = orderId
  if (!targetOrderId) {
    try {
      const item = await pb.collection('service_order_items').getOne<ServiceOrderItem>(id, {
        fields: 'id,service_order',
      })
      targetOrderId = item.service_order
    } catch {
      /* ignore */
    }
  }
  const result = await pb.collection('service_order_items').delete(id)
  if (targetOrderId) {
    try {
      await syncServiceOrderTotal(targetOrderId)
    } catch {
      /* best effort */
    }
  }
  return result
}

export const deleteServiceOrder = async (id: string) => {
  // Remove itens associados em cascata antes de deletar a OS para manter integridade
  try {
    const items = await pb.collection('service_order_items').getFullList({
      filter: `service_order = "${id}"`,
    })
    await Promise.allSettled(items.map((it) => pb.collection('service_order_items').delete(it.id)))
  } catch {
    /* ignore */
  }

  // Remove histórico de status em cascata
  try {
    const history = await pb.collection('status_history').getFullList({
      filter: `service_order = "${id}"`,
    })
    await Promise.allSettled(history.map((h) => pb.collection('status_history').delete(h.id)))
  } catch {
    /* ignore */
  }

  // Se houver pagamentos associados
  try {
    const pays = await pb.collection('payments').getFullList({
      filter: `service_order = "${id}"`,
    })
    await Promise.allSettled(pays.map((p) => pb.collection('payments').delete(p.id)))
  } catch {
    /* ignore */
  }

  // Se houver anexos/fotos associados
  try {
    const attachments = await pb.collection('service_attachments').getFullList({
      filter: `service_order = "${id}"`,
    })
    await Promise.allSettled(
      attachments.map((att) => pb.collection('service_attachments').delete(att.id)),
    )
  } catch {
    /* ignore */
  }

  // Se houver avaliações associadas
  try {
    const evals = await pb.collection('evaluations').getFullList({
      filter: `service_order = "${id}"`,
    })
    await Promise.allSettled(evals.map((ev) => pb.collection('evaluations').delete(ev.id)))
  } catch {
    /* ignore */
  }

  // Se houver mensagens de pós-venda da OS associadas
  try {
    const posMessages = await pb.collection('pos_venda_messages').getFullList({
      filter: `service_order = "${id}"`,
    })
    await Promise.allSettled(
      posMessages.map((pm) => pb.collection('pos_venda_messages').delete(pm.id)),
    )
  } catch {
    /* ignore */
  }

  // Deleta o registro principal da ordem de serviço
  return pb.collection('service_orders').delete(id)
}

export const getStatusHistory = (orderId: string) =>
  pb.collection('status_history').getFullList<StatusHistory>({
    filter: `service_order = "${orderId}"`,
    expand: 'changed_by',
    sort: '-created',
  })

export const addStatusHistory = (data: Partial<StatusHistory>) =>
  pb.collection('status_history').create<StatusHistory>(data)

export const uploadSignature = async (
  id: string,
  field: 'technician_signature' | 'customer_signature',
  signature: string,
) => {
  // Fluxo autenticado (técnico): continua usando multipart/form-data via SDK
  // do PocketBase, que funciona normalmente no app logado. Convertemos o
  // data URL de volta para um File PNG com MIME definido explicitamente.
  const res = await fetch(signature)
  const blob = await res.blob()
  const file = new File([blob], 'signature.png', { type: 'image/png' })
  const formData = new FormData()
  formData.append(field, file, 'signature.png')
  return pb.collection('service_orders').update<ServiceOrder>(id, formData, {
    expand: 'customer,technician',
  })
}

/**
 * Sincroniza e recalcula o campo `total` de uma service_order com base na hierarquia:
 * (a) Orçamento vinculado (id_os = orderId) com status aprovado ou faturado → total = total_geral dele;
 * (b) Senão qualquer orçamento vinculado com total_geral > 0 → usar total_geral dele;
 * (c) Senão soma dos itens de service_order_items (quantity * unit_price, menos desconto + acréscimo da OS quando houver).
 * Grava em service_orders.total via update e retorna o total atualizado.
 */
/**
 * Copia de forma idempotente todos os itens de um orçamento (orcamento_itens)
 * para a tabela de itens da O.S. (service_order_items).
 *
 * Mapeamento:
 * - descricao -> description
 * - quantidade -> quantity
 * - valor_unitario -> unit_price
 * - valor_total_item -> total
 * - id_produto -> product (quando houver id_produto e/ou tipo for produto)
 * - service_order -> targetOsId
 *
 * Idempotência:
 * Compara se já existe um item com mesmo targetOsId, mesma descrição, quantidade
 * e unit_price (e mesmo product se houver). Não cria itens repetidos.
 *
 * Retorna contadores de itens inseridos e já existentes.
 */
export async function copyOrcamentoItensToServiceOrder(
  orcamentoId: string,
  targetOsId: string,
): Promise<{ inserted: number; existing: number; total: number; alreadyExisting: number }> {
  const result = await migrateOrcamentoToServiceOrder(orcamentoId, targetOsId)
  return {
    inserted: result.itemsInserted,
    existing: result.itemsExisting,
    alreadyExisting: result.itemsExisting,
    total: result.itemsTotal,
  }
}

/**
 * Migra COMPLETO todos os dados do orçamento para a Ordem de Serviço (v0.0.244):
 * - Itens (produtos/serviços) -> service_order_items (idempotente)
 * - Desconto (desconto_total_valor ou calculado a partir do percentual)
 * - Observações / Condições comerciais -> concatenado em notes sem sobrescrever
 * - Forma de pagamento -> payments (registro pendente/previsto) se a OS ainda não tiver
 * - Dados do cliente -> complementa customer se a OS não tiver cliente ou campos vazios
 * - Equipamento e defeito independentes -> complementa se vazios na OS
 * - Sincronização do total da OS
 */
export async function migrateOrcamentoToServiceOrder(
  orcamentoId: string,
  targetOsId: string,
): Promise<{
  itemsInserted: number
  itemsExisting: number
  itemsTotal: number
  alreadyExisting: number
  discountCopied: boolean
  notesAppended: boolean
  customerUpdated: boolean
  paymentCreated: boolean
}> {
  const summary = {
    itemsInserted: 0,
    itemsExisting: 0,
    itemsTotal: 0,
    alreadyExisting: 0,
    discountCopied: false,
    notesAppended: false,
    customerUpdated: false,
    paymentCreated: false,
  }

  if (!orcamentoId || !targetOsId) {
    return summary
  }

  // 1. Carrega orçamento e O.S.
  const [orcamento, order] = await Promise.all([
    pb
      .collection('orcamentos')
      .getOne<Orcamento>(orcamentoId)
      .catch(() => null),
    pb
      .collection('service_orders')
      .getOne<ServiceOrder>(targetOsId)
      .catch(() => null),
  ])

  if (!orcamento || !order) {
    return summary
  }

  // 2. MIGRAÇÃO DE ITENS (idempotente)
  const orcItens = await pb.collection('orcamento_itens').getFullList<{
    id: string
    id_orcamento: string
    tipo: 'produto' | 'servico'
    id_produto?: string
    descricao: string
    quantidade: number
    valor_unitario: number
    desconto_item?: number
    desconto_item_tipo?: 'percentual' | 'valor'
    valor_total_item: number
  }>({
    filter: `id_orcamento = "${orcamentoId}"`,
    sort: 'created',
  })

  summary.itemsTotal = orcItens.length

  const existingOsItems = await pb.collection('service_order_items').getFullList<ServiceOrderItem>({
    filter: `service_order = "${targetOsId}"`,
  })

  const buildKey = (desc: string, qty: number, unit: number, prod?: string) =>
    `${(desc || '').trim().toLowerCase()}|${Number(qty) || 1}|${Number(unit).toFixed(2)}|${prod || ''}`

  const registeredKeys = new Set(
    existingOsItems.map((it) => buildKey(it.description, it.quantity, it.unit_price, it.product)),
  )

  for (const item of orcItens) {
    const prodId = item.id_produto ? String(item.id_produto).trim() : undefined
    const key = buildKey(item.descricao, item.quantidade, item.valor_unitario, prodId)

    if (registeredKeys.has(key)) {
      summary.itemsExisting++
      continue
    }

    const payload: Partial<ServiceOrderItem> = {
      service_order: targetOsId,
      description: item.descricao,
      quantity: Number(item.quantidade) || 1,
      unit_price: Number(item.valor_unitario) || 0,
      total:
        Number(item.valor_total_item) ||
        (Number(item.quantidade) || 1) * (Number(item.valor_unitario) || 0),
      ...(prodId ? { product: prodId } : {}),
    }

    try {
      await pb.collection('service_order_items').create(payload)
      registeredKeys.add(key)
      summary.itemsInserted++
    } catch (err) {
      console.error('[migrateOrcamentoToServiceOrder] Falha ao criar item da O.S.:', err, payload)
    }
  }

  summary.alreadyExisting = summary.itemsExisting

  // 3. ATUALIZAÇÕES DIRETAS NA SERVICE_ORDER (Desconto, Notas/Observações, Cliente, Equipamento)
  const osUpdates: Partial<ServiceOrder> = {}

  // (a) Desconto do orçamento
  let descValor = Number(orcamento.desconto_total_valor) || 0
  if (
    !descValor &&
    orcamento.desconto_total_tipo === 'percentual' &&
    Number(orcamento.desconto_total_percentual) > 0
  ) {
    const sub = Number(orcamento.subtotal) || 0
    descValor = (sub * Number(orcamento.desconto_total_percentual)) / 100
  }
  if (descValor > 0 && (Number(order.desconto) || 0) === 0) {
    osUpdates.desconto = descValor
    summary.discountCopied = true
  }

  // (b) Observações / Condições do orçamento -> concatenar em order.notes com idempotência
  const orcObs = (orcamento.observacoes || '').trim()
  const orcTag = `Do orçamento ${orcamento.numero_orcamento}:`
  if (orcObs) {
    const currentNotes = (order.notes || '').trim()
    if (!currentNotes.includes(orcTag)) {
      const block = `${orcTag}\n${orcObs}`
      osUpdates.notes = currentNotes ? `${currentNotes}\n\n${block}` : block
      summary.notesAppended = true
    }
  }

  // (c) Cliente da O.S. (NÃO sobrescrever se já existir!)
  if (!order.customer && orcamento.cliente_id) {
    osUpdates.customer = orcamento.cliente_id
    summary.customerUpdated = true
  }

  // (d) Equipamento e defeito se a O.S. estiver vazia
  if (!order.equipment && orcamento.equipamento_independente) {
    osUpdates.equipment = orcamento.equipamento_independente
  }
  if (!order.description && orcamento.defeito_independente) {
    osUpdates.description = orcamento.defeito_independente
  }

  // Aplica updates na O.S. se houver alterações
  if (Object.keys(osUpdates).length > 0) {
    try {
      await pb.collection('service_orders').update(targetOsId, osUpdates)
    } catch (err) {
      console.error(
        '[migrateOrcamentoToServiceOrder] Falha ao atualizar dados da O.S.:',
        err,
        osUpdates,
      )
    }
  }

  // (e) Se a O.S. já tem cliente ou herdou cliente_id do orçamento, complementa campos em branco do cliente
  const effectiveCustomerId = order.customer || orcamento.cliente_id
  if (effectiveCustomerId) {
    try {
      const cust = await pb
        .collection('customers')
        .getOne<Customer>(effectiveCustomerId)
        .catch(() => null)
      if (cust) {
        const custUpdates: Partial<Customer> = {}
        if (!cust.phone && !cust.celular && orcamento.telefone_cliente_livre) {
          custUpdates.phone = orcamento.telefone_cliente_livre
          custUpdates.celular = orcamento.telefone_cliente_livre
        }
        if (
          !cust.name &&
          !cust.razao_social &&
          !cust.nome_fantasia &&
          orcamento.nome_cliente_livre
        ) {
          custUpdates.name = orcamento.nome_cliente_livre
        }
        if (Object.keys(custUpdates).length > 0) {
          await pb
            .collection('customers')
            .update(cust.id, custUpdates)
            .catch(() => null)
          summary.customerUpdated = true
        }
      }
    } catch {
      /* best effort */
    }
  }

  // (f) Forma de pagamento do orçamento: se existir e a OS não tiver pagamentos registrados
  if (orcamento.forma_pagamento) {
    try {
      const existingPayments = await pb.collection('payments').getFullList<Payment>({
        filter: `service_order = "${targetOsId}"`,
      })
      const paymentTag = `Referente ao Orçamento ${orcamento.numero_orcamento}`
      const alreadyHasPayment = existingPayments.some((p) => (p.notes || '').includes(paymentTag))

      if (existingPayments.length === 0 && !alreadyHasPayment) {
        const methodMap: Record<string, PaymentMethod> = {
          dinheiro: 'cash',
          pix: 'pix',
          cartao_credito: 'credit_card',
          cartao_debito: 'debit_card',
          boleto: 'transfer',
          crediario: 'transfer',
          outros: 'transfer',
        }
        const method = methodMap[orcamento.forma_pagamento] || 'pix'
        const totalAmount = Number(orcamento.total_geral) || 0

        const isPaid = orcamento.status_pagamento === 'pago' || orcamento.status === 'faturado'
        await pb.collection('payments').create({
          service_order: targetOsId,
          amount: totalAmount,
          method,
          status: isPaid ? 'paid' : 'pending',
          paid_at: isPaid ? new Date().toISOString() : null,
          notes: `${paymentTag} (${orcamento.parcelas || 1}x ${orcamento.forma_pagamento})`,
        })
        summary.paymentCreated = true
      }
    } catch (err) {
      console.warn(
        '[migrateOrcamentoToServiceOrder] Erro ao registrar forma de pagamento na OS:',
        err,
      )
    }
  }

  // 4. Sincroniza o total da O.S. após todas as alterações
  try {
    await syncServiceOrderTotal(targetOsId)
  } catch {
    /* best effort */
  }

  return summary
}

export async function syncServiceOrderTotal(orderId: string): Promise<number> {
  if (!orderId) return 0

  let computedTotal = 0

  try {
    // 1. Busca orçamentos vinculados ordenados pelo mais recente
    const orcamentosVinculados = await pb.collection('orcamentos').getFullList<{
      id: string
      status: string
      total_geral: number
      created: string
    }>({
      filter: `id_os = "${orderId}"`,
      sort: '-created',
    })

    // (a) Orçamento aprovado ou faturado
    const orcAprovadoOuFaturado = orcamentosVinculados.find(
      (o) => (o.status === 'aprovado' || o.status === 'faturado') && Number(o.total_geral) >= 0,
    )

    if (orcAprovadoOuFaturado) {
      computedTotal = Number(orcAprovadoOuFaturado.total_geral) || 0
    } else {
      // (b) Qualquer orçamento vinculado com total_geral > 0
      const orcComValor = orcamentosVinculados.find((o) => Number(o.total_geral) > 0)
      if (orcComValor) {
        computedTotal = Number(orcComValor.total_geral) || 0
      } else {
        // (c) Soma de service_order_items
        const [items, order] = await Promise.all([
          pb.collection('service_order_items').getFullList<ServiceOrderItem>({
            filter: `service_order = "${orderId}"`,
          }),
          pb.collection('service_orders').getOne<ServiceOrder>(orderId),
        ])

        const subtotal = items.reduce((sum, item) => {
          const qty = Number(item.quantity) || 0
          const unit = Number(item.unit_price) || 0
          const itemTotal = typeof item.total === 'number' ? item.total : qty * unit
          return sum + itemTotal
        }, 0)

        const desc = Number(order.desconto) || 0
        const acresc = Number(order.acrescimo) || 0
        computedTotal = Math.max(0, subtotal - desc + acresc)
      }
    }

    // Grava no PocketBase
    await pb.collection('service_orders').update(orderId, {
      total: computedTotal,
    })

    return computedTotal
  } catch (err) {
    console.error(`[syncServiceOrderTotal] Erro ao sincronizar total da OS ${orderId}:`, err)
    return computedTotal
  }
}
