import pb from '@/lib/pocketbase/client'
import { CatalogService } from '@/types'

export const getCatalogServices = () =>
  pb.collection('services').getFullList<CatalogService>({
    sort: 'name',
  })

export const createCatalogService = (data: Partial<CatalogService>) =>
  pb.collection('services').create<CatalogService>(data)

export const updateCatalogService = (id: string, data: Partial<CatalogService>) =>
  pb.collection('services').update<CatalogService>(id, data)

export const deleteCatalogService = (id: string) => pb.collection('services').delete(id)
