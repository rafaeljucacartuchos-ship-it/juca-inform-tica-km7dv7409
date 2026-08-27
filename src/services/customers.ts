import pb from '@/lib/pocketbase/client'
import { Customer } from '@/types'

export const getCustomerDisplayName = (customer?: Partial<Customer> | null): string => {
  if (!customer) return 'Cliente'
  return customer.nome_fantasia || customer.razao_social || customer.name || 'Cliente Sem Nome'
}

export const getCustomerPhone = (customer?: Partial<Customer> | null): string => {
  if (!customer) return ''
  return customer.celular || customer.phone || ''
}

export const getCustomers = async (search = '') => {
  let filter = ''
  if (search && search.trim()) {
    const s = search.trim().replace(/'/g, "\\'")
    filter = `razao_social ~ '${s}' || nome_fantasia ~ '${s}' || name ~ '${s}'`
  }
  const result = await pb.collection('customers').getList<Customer>(1, 100, {
    filter,
    sort: 'razao_social',
  })
  return result.items
}

export const getCustomer = (id: string) => pb.collection('customers').getOne<Customer>(id)

export const createCustomer = (data: Partial<Customer>) => {
  const payload: Partial<Customer> = {
    ...data,
    // Garante sincronização bidirecional com campos legados para manter compatibilidade
    name: data.razao_social || data.nome_fantasia || data.name || '',
    phone: data.celular || data.phone || '',
    street: data.endereco || data.street || '',
  }
  return pb.collection('customers').create<Customer>(payload)
}

export const updateCustomer = (id: string, data: Partial<Customer>) => {
  const payload: Partial<Customer> = {
    ...data,
    name: data.razao_social || data.nome_fantasia || data.name || '',
    phone: data.celular || data.phone || '',
    street: data.endereco || data.street || '',
  }
  return pb.collection('customers').update<Customer>(id, payload)
}

export const deleteCustomer = (id: string) => pb.collection('customers').delete(id)
