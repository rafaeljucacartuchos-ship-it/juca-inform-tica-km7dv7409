import pb from '@/lib/pocketbase/client'
import { Product } from '@/types'

export const getProducts = (search = '') => {
  let filter = ''
  if (search.trim()) {
    filter = `name ~ "${search.trim()}" || sku ~ "${search.trim()}" || category ~ "${search.trim()}"`
  }
  return pb.collection('products').getFullList<Product>({
    filter,
    sort: '-created',
  })
}

export const getProduct = (id: string) => pb.collection('products').getOne<Product>(id)

export const createProduct = (data: Partial<Product>) =>
  pb.collection('products').create<Product>(data)

export const updateProduct = (id: string, data: Partial<Product>) =>
  pb.collection('products').update<Product>(id, data)

export const toggleProductActive = (id: string, currentActive: boolean) =>
  pb.collection('products').update<Product>(id, { active: !currentActive })

export const deleteProduct = (id: string) => pb.collection('products').delete(id)
