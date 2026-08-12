import pb from '@/lib/pocketbase/client'
import { ServiceOrder, ServiceOrderItem, StatusHistory } from '@/types'

export const getServiceOrders = (filterStr = '') =>
  pb.collection('service_orders').getFullList<ServiceOrder>({
    filter: filterStr,
    expand: 'customer,technician,appointment,equipment_ref',
    sort: '-created',
  })

export const getServiceOrder = (id: string) =>
  pb.collection('service_orders').getOne<ServiceOrder>(id, {
    expand: 'customer,technician,appointment,equipment_ref',
  })

export const createServiceOrder = (data: Partial<ServiceOrder>) =>
  pb.collection('service_orders').create<ServiceOrder>(data, {
    expand: 'customer,technician,equipment_ref',
  })

export const updateServiceOrder = (id: string, data: Partial<ServiceOrder>) =>
  pb.collection('service_orders').update<ServiceOrder>(id, data, {
    expand: 'customer,technician,equipment_ref',
  })

export const getOrderItems = (orderId: string) =>
  pb.collection('service_order_items').getFullList<ServiceOrderItem>({
    filter: `service_order = "${orderId}"`,
    expand: 'service',
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

export const uploadSignature = (
  id: string,
  field: 'technician_signature' | 'customer_signature',
  blob: Blob,
) => {
  const formData = new FormData()
  formData.append(field, blob, 'signature.png')
  return pb.collection('service_orders').update<ServiceOrder>(id, formData, {
    expand: 'customer,technician',
  })
}
