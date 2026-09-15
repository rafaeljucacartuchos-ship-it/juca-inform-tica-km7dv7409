import pb from '@/lib/pocketbase/client'
import { ServiceOrder, ServiceOrderItem, StatusHistory } from '@/types'

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
