import pb from '@/lib/pocketbase/client'
import { Equipment, ServiceOrder } from '@/types'

export const getEquipment = () =>
  pb.collection('equipment').getFullList<Equipment>({
    expand: 'customer',
    sort: 'name',
  })

export const getEquipmentByCustomer = (customerId: string) =>
  pb.collection('equipment').getFullList<Equipment>({
    filter: `customer = "${customerId}"`,
    sort: 'name',
  })

export const getEquipmentItem = (id: string) =>
  pb.collection('equipment').getOne<Equipment>(id, { expand: 'customer' })

export const createEquipment = (data: Partial<Equipment>) =>
  pb.collection('equipment').create<Equipment>(data, { expand: 'customer' })

export const updateEquipment = (id: string, data: Partial<Equipment> | FormData) =>
  pb.collection('equipment').update<Equipment>(id, data, { expand: 'customer' })

export const deleteEquipment = (id: string) => pb.collection('equipment').delete(id)

export const createEquipmentWithPhotos = (data: FormData) =>
  pb.collection('equipment').create<Equipment>(data, { expand: 'customer' })

export const getEquipmentServiceOrders = (equipmentId: string) =>
  pb.collection('service_orders').getFullList<ServiceOrder>({
    filter: `equipment_ref = "${equipmentId}"`,
    sort: 'title',
    expand: 'customer,technician',
  })
