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

export const createOrderItem = (data: Partial<ServiceOrderItem>) =>
  pb.collection('service_order_items').create<ServiceOrderItem>(data)

export const deleteOrderItem = (id: string) => pb.collection('service_order_items').delete(id)

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
  // O SignaturePad agora entrega um data URL base64 ("data:image/png;base64,...").
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
