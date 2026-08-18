import pb from '@/lib/pocketbase/client'
import { CatalogService, Service } from '@/types'

export const getCatalogServices = () =>
  pb.collection('services').getFullList<CatalogService>({
    sort: 'name',
  })

export const createCatalogService = (data: Partial<CatalogService>) =>
  pb.collection('services').create<CatalogService>(data)

export const updateCatalogService = (id: string, data: Partial<CatalogService>) =>
  pb.collection('services').update<CatalogService>(id, data)

export const deleteCatalogService = (id: string) => pb.collection('services').delete(id)

/** Lista os serviços importados da planilha (com campos extendidos). */
export const getServices = (search = '') => {
  let filter = ''
  if (search.trim()) {
    filter = `title ~ "${search.trim()}" || name ~ "${search.trim()}" || external_code ~ "${search.trim()}" || cnae ~ "${search.trim()}"`
  }
  return pb.collection('services').getFullList<Service>({
    filter,
    sort: '-created',
  })
}

export const getService = (id: string) => pb.collection('services').getOne<Service>(id)

export const createService = (data: Partial<Service>) =>
  pb.collection('services').create<Service>(data)

export const updateService = (id: string, data: Partial<Service>) =>
  pb.collection('services').update<Service>(id, data)

export const deleteService = (id: string) => pb.collection('services').delete(id)
