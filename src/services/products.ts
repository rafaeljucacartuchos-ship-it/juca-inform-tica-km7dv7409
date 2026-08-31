import pb from '@/lib/pocketbase/client'
import { Product } from '@/types'

export const normalizeSearchText = (text: string): string => {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .toLowerCase()
    .trim()
}

export const getProducts = async (
  search = '',
  page = 1,
  perPage = 100,
  typeFilter?: 'produto' | 'servico',
) => {
  const filterParts: string[] = []
  if (search && search.trim()) {
    const normalized = normalizeSearchText(search)
    // Divide em palavras para permitir busca em qualquer ordem (AND sobre search_text)
    const words = normalized
      .split(/\s+/)
      .map((w) => w.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'"))
      .filter((w) => w.length > 0)

    if (words.length > 0) {
      filterParts.push(words.map((w) => `search_text ~ '${w}'`).join(' && '))
    }
  }

  if (typeFilter) {
    filterParts.push(`type = '${typeFilter}'`)
  }

  const filter = filterParts.join(' && ')

  const result = await pb.collection('products').getList<Product>(page, perPage, {
    filter,
    sort: 'name',
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
