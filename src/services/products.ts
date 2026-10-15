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

/**
 * Busca de produtos para a janela de consulta ("Consultar Produto").
 *
 * Suporta:
 * 1) 'barcode': correspondência EXATA de barcode / codigo_barras.
 *    Preserva zeros à esquerda rigorosamente (como string pura).
 *    NÃO busca em sku (código interno) nem search_text para não confundir
 *    com código interno.
 * 2) 'description': busca parcial por texto normalizado (nome/descrição/palavras).
 */
export const searchProductsLookup = async ({
  mode,
  term,
  page = 1,
  perPage = 50,
}: {
  mode: 'description' | 'barcode'
  term: string
  page?: number
  perPage?: number
}): Promise<{ items: Product[]; totalItems: number }> => {
  const cleanTerm = (term ?? '').trim()
  if (!cleanTerm) {
    return { items: [], totalItems: 0 }
  }

  if (mode === 'barcode') {
    // Escapa aspas e barras para montagem segura do filtro PocketBase
    // Preserva zeros à esquerda exatamente como digitado (ex: "00123" !== "123")
    const safeBarcode = cleanTerm.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    const filter = `barcode = '${safeBarcode}' || codigo_barras = '${safeBarcode}'`
    const result = await pb.collection('products').getList<Product>(page, perPage, {
      filter,
      sort: 'name',
    })
    return { items: result.items, totalItems: result.totalItems }
  }

  // mode === 'description'
  const normalized = normalizeSearchText(cleanTerm)
  const words = normalized
    .split(/\s+/)
    .map((w) => w.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'"))
    .filter((w) => w.length > 0)

  let filter = ''
  if (words.length > 0) {
    // Busca AND para que todas as palavras informadas estejam presentes na descrição/busca
    filter = words.map((w) => `search_text ~ '${w}'`).join(' && ')
  }

  const result = await pb.collection('products').getList<Product>(page, perPage, {
    filter: filter || undefined,
    sort: 'name',
  })
  return { items: result.items, totalItems: result.totalItems }
}

export const getProduct = (id: string) => pb.collection('products').getOne<Product>(id)

export const createProduct = (data: Partial<Product>) =>
  pb.collection('products').create<Product>(data)

export const updateProduct = (id: string, data: Partial<Product>) =>
  pb.collection('products').update<Product>(id, data)

export const toggleProductActive = (id: string, currentActive: boolean) =>
  pb.collection('products').update<Product>(id, { active: !currentActive })

export const deleteProduct = (id: string) => pb.collection('products').delete(id)
