import pb from '@/lib/pocketbase/client'
import { ServiceType } from '@/types'

export const getServiceTypes = async (onlyActive = true) => {
  const filter = onlyActive ? 'active = true' : ''
  return pb.collection('service_types').getFullList<ServiceType>({
    filter,
    sort: 'name',
  })
}

export const getAllServiceTypes = async () => {
  return pb.collection('service_types').getFullList<ServiceType>({
    sort: 'name',
  })
}

export const getServiceType = (id: string) => pb.collection('service_types').getOne<ServiceType>(id)

export const createServiceType = (data: Partial<ServiceType>) =>
  pb.collection('service_types').create<ServiceType>(data)

export const updateServiceType = (id: string, data: Partial<ServiceType>) =>
  pb.collection('service_types').update<ServiceType>(id, data)

export const toggleServiceTypeActive = (id: string, currentActive: boolean) =>
  pb.collection('service_types').update<ServiceType>(id, { active: !currentActive })

export const deleteServiceType = (id: string) => pb.collection('service_types').delete(id)
