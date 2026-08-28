import pb from '@/lib/pocketbase/client'
import { Product } from '@/types'

export const getProducts = async (search = '') => {
  let filter = ''
  if (search && search.trim()) {
    const s = search.trim().replace(/'/g, "\\'")
    // No PocketBase o campo de nome do produto é "name", código de barras é "barcode" / "codigo_barras", código é "sku"
    filter = `name ~ '${s}' || barcode ~ '${s}' || codigo_barras ~ '${s}' || sku ~ '${s}'`
  }
  const result = await pb.collection('products').getList<Product>(1, 100, {
    filter,
    sort: 'sku',
  })
  return result.items
}

export const getProduct = (id: string) => pb.collection('products').getOne<Product>(id)

export const createProduct = (data: Partial<Product>) =>
  pb.collection('products').create<Product>(data)

export const updateProduct = (id: string, data: Partial<Product>) =>
  pb.collection('products').update<Product>(id, data)

export const toggleProductActive = (id: string, currentActive: boolean) =>
  pb.collection('products').update<Product>(id, { active: !currentActive })

export const deleteProduct = (id: string) => pb.collection('products').delete(id)
