import pb from '@/lib/pocketbase/client'
import { ServiceAttachment } from '@/types'

export const getAttachments = (orderId: string) =>
  pb.collection('service_attachments').getFullList<ServiceAttachment>({
    filter: `service_order = "${orderId}"`,
    sort: 'created',
  })

export const createAttachment = (
  orderId: string,
  file: File | Blob,
  fileName?: string,
  caption?: string,
) => {
  const formData = new FormData()
  formData.append('service_order', orderId)
  if (fileName) {
    formData.append('file', file, fileName)
  } else if (file instanceof File) {
    formData.append('file', file, file.name)
  } else {
    formData.append('file', file, 'foto.jpg')
  }
  if (caption) formData.append('caption', caption)
  return pb.collection('service_attachments').create<ServiceAttachment>(formData)
}

export const updateAttachment = (id: string, caption: string) =>
  pb.collection('service_attachments').update<ServiceAttachment>(id, { caption })

export const deleteAttachment = (id: string) => pb.collection('service_attachments').delete(id)
