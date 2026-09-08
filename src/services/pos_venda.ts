import pb from '@/lib/pocketbase/client'
import { PosVendaMessage, SystemSetting } from '@/types'

export const getPosVendaMessages = async (filterStr = '', sortStr = '-scheduled_at') => {
  return pb.collection('pos_venda_messages').getFullList<PosVendaMessage>({
    filter: filterStr,
    expand: 'customer,service_order,service_order.technician,service_order.equipment_ref',
    sort: sortStr,
  })
}

export const markPosVendaMessageSent = async (id: string) => {
  return pb.collection('pos_venda_messages').update<PosVendaMessage>(id, {
    status: 'sent',
    sent_at: new Date().toISOString(),
  })
}

export const dismissPosVendaMessage = async (id: string) => {
  return pb.collection('pos_venda_messages').update<PosVendaMessage>(id, {
    status: 'dismissed',
  })
}

export const createPosVendaMessage = async (data: Partial<PosVendaMessage>) => {
  return pb.collection('pos_venda_messages').create<PosVendaMessage>(data)
}

/**
 * Busca mensagens de agradecimento de proposta aprovada pendentes de envio
 * ou prontas (status = 'ready' ou 'pending', canal = 'whatsapp').
 */
export const getPendingOrcamentoAgradecimentoMessages = async () => {
  return pb.collection('pos_venda_messages').getFullList<PosVendaMessage>({
    filter:
      'status = "ready" && channel = "whatsapp" && texto_gerado ~ "Que alegria que a proposta"',
    expand: 'customer,service_order,service_order.technician,service_order.equipment_ref',
    sort: '-created',
  })
}

export const getGoogleReviewUrl = async (): Promise<string> => {
  try {
    const records = await pb.collection('settings').getFullList<SystemSetting>({
      filter: 'key = "google_review_url"',
    })
    if (records.length > 0 && records[0].value) {
      return records[0].value
    }
  } catch {
    /* fallback */
  }
  return 'https://g.page/r/CfKb0UxVRFNsEAI/review'
}

export const updateGoogleReviewUrl = async (url: string) => {
  try {
    const records = await pb.collection('settings').getFullList<SystemSetting>({
      filter: 'key = "google_review_url"',
    })
    if (records.length > 0) {
      return await pb.collection('settings').update(records[0].id, { value: url })
    } else {
      return await pb.collection('settings').create({
        key: 'google_review_url',
        value: url,
        description: 'Link público para avaliação no Google Meu Negócio',
      })
    }
  } catch {
    /* ignore */
  }
}
