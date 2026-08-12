import pb from '@/lib/pocketbase/client'
import { Equipment } from '@/types'

export const getEquipment = () =>
  pb.collection('equipment').getFullList<Equipment>({
    expand: 'customer',
    sort: '-created',
  })

export const getEquipmentByCustomer = (customerId: string) =>
  pb.collection('equipment').getFullList<Equipment>({
    filter: `customer = "${customerId}"`,
    sort: '-created',
  })

export const getEquipmentItem = (id: string) =>
  pb.collection('equipment').getOne<Equipment>(id, { expand: 'customer' })

export const createEquipment = (data: Partial<Equipment>) =>
  pb.collection('equipment').create<Equipment>(data, { expand: 'customer' })

export const updateEquipment = (id: string, data: Partial<Equipment>) =>
  pb.collection('equipment').update<Equipment>(id, data, { expand: 'customer' })

export const deleteEquipment = (id: string) => pb.collection('equipment').delete(id)
