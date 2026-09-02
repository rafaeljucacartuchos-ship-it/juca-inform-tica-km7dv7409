import pb from '@/lib/pocketbase/client'
import { Customer } from '@/types'
import { normalizePhone } from '@/lib/phones'

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
    const digits = search.replace(/\D/g, '')
    if (digits) {
      filter = `razao_social ~ '${s}' || nome_fantasia ~ '${s}' || name ~ '${s}' || cpf_cnpj ~ '${s}' || celular ~ '${digits}' || phone ~ '${digits}'`
    } else {
      filter = `razao_social ~ '${s}' || nome_fantasia ~ '${s}' || name ~ '${s}' || cpf_cnpj ~ '${s}' || celular ~ '${s}' || phone ~ '${s}'`
    }
  }
  const result = await pb.collection('customers').getList<Customer>(1, 100, {
    filter,
    sort: 'razao_social',
  })
  return result.items
}

export const getCustomer = (id: string) => pb.collection('customers').getOne<Customer>(id)

export const createCustomer = (data: Partial<Customer>) => {
  const rawPhone = data.celular || data.phone || ''
  const normalized = normalizePhone(rawPhone)
  const payload: Partial<Customer> = {
    ...data,
    celular: normalized,
    // Garante sincronização bidirecional com campos legados para manter compatibilidade
    name: data.razao_social || data.nome_fantasia || data.name || '',
    phone: normalized,
    street: data.endereco || data.street || '',
  }
  return pb.collection('customers').create<Customer>(payload)
}

export const updateCustomer = (id: string, data: Partial<Customer>) => {
  const rawPhone = data.celular !== undefined ? data.celular : data.phone
  const normalized = rawPhone !== undefined ? normalizePhone(rawPhone) : undefined
  const payload: Partial<Customer> = {
    ...data,
    ...(normalized !== undefined ? { celular: normalized, phone: normalized } : {}),
    name: data.razao_social || data.nome_fantasia || data.name || '',
    street: data.endereco || data.street || '',
  }
  return pb.collection('customers').update<Customer>(id, payload)
}

export const deleteCustomer = (id: string) => pb.collection('customers').delete(id)
