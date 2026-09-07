import pb from '@/lib/pocketbase/client'
import { Campaign, CampanhaMessage } from '@/types'

export async function getCampaigns(filter = '', sort = '-created'): Promise<Campaign[]> {
  const records = await pb.collection('campaigns').getFullList({
    filter: filter || undefined,
    sort,
  })
  return records as unknown as Campaign[]
}

export async function getCampaign(id: string): Promise<Campaign> {
  const record = await pb.collection('campaigns').getOne(id)
  return record as unknown as Campaign
}

export async function createCampaign(
  formDataOrObj: FormData | Partial<Campaign>,
): Promise<Campaign> {
  const record = await pb.collection('campaigns').create(formDataOrObj)
  return record as unknown as Campaign
}

export async function updateCampaign(
  id: string,
  formDataOrObj: FormData | Partial<Campaign>,
): Promise<Campaign> {
  const record = await pb.collection('campaigns').update(id, formDataOrObj)
  return record as unknown as Campaign
}

export async function deleteCampaign(id: string): Promise<boolean> {
  return await pb.collection('campaigns').delete(id)
}

export async function getCampanhaMessages(campaignId?: string): Promise<CampanhaMessage[]> {
  const filter = campaignId ? `campaign = "${campaignId}"` : ''
  const records = await pb.collection('campanha_messages').getFullList({
    filter: filter || undefined,
    sort: '-created',
    expand: 'customer,campaign',
  })
  return records as unknown as CampanhaMessage[]
}

export async function logCampanhaMessageSent(
  campaignId: string,
  customerId: string,
  textoGerado: string,
  waMeLink: string,
): Promise<CampanhaMessage> {
  // Cria ou atualiza o registro de envio
  try {
    const existing = await pb
      .collection('campanha_messages')
      .getFirstListItem(`campaign = "${campaignId}" && customer = "${customerId}"`)
    const updated = await pb.collection('campanha_messages').update(existing.id, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      texto_gerado: textoGerado,
      wa_me_link: waMeLink,
    })
    return updated as unknown as CampanhaMessage
  } catch {
    const created = await pb.collection('campanha_messages').create({
      campaign: campaignId,
      customer: customerId,
      status: 'sent',
      sent_at: new Date().toISOString(),
      texto_gerado: textoGerado,
      wa_me_link: waMeLink,
      channel: 'whatsapp',
    })
    return created as unknown as CampanhaMessage
  }
}
