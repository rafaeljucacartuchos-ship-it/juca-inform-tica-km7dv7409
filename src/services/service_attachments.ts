import pb from '@/lib/pocketbase/client'
import { ServiceAttachment } from '@/types'

export const getAttachments = (orderId: string) =>
  pb.collection('service_attachments').getFullList<ServiceAttachment>({
    filter: `service_order = "${orderId}"`,
    sort: 'created',
  })

export const createAttachment = (orderId: string, file: File, caption?: string) => {
  const formData = new FormData()
  formData.append('service_order', orderId)
  formData.append('file', file)
  if (caption) formData.append('caption', caption)
  return pb.collection('service_attachments').create<ServiceAttachment>(formData)
}

export const updateAttachment = (id: string, caption: string) =>
  pb.collection('service_attachments').update<ServiceAttachment>(id, { caption })

export const deleteAttachment = (id: string) => pb.collection('service_attachments').delete(id)
