import pb from '@/lib/pocketbase/client'
import { Customer } from '@/types'

export const getCustomers = async (search = '') => {
  let filter = ''
  if (search.trim()) {
    filter = `name ~ "${search.trim()}" || phone ~ "${search.trim()}" || email ~ "${search.trim()}" || cpf_cnpj ~ "${search.trim()}"`
  }
  return pb.collection('customers').getFullList<Customer>({
    filter,
    sort: 'name',
  })
}

export const getCustomer = (id: string) => pb.collection('customers').getOne<Customer>(id)

export const createCustomer = (data: Partial<Customer>) =>
  pb.collection('customers').create<Customer>(data)

export const updateCustomer = (id: string, data: Partial<Customer>) =>
  pb.collection('customers').update<Customer>(id, data)

export const deleteCustomer = (id: string) => pb.collection('customers').delete(id)
