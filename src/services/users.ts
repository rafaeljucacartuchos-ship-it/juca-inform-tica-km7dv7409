import pb from '@/lib/pocketbase/client'
import { User } from '@/types'

export const getUsers = () => pb.collection('users').getFullList<User>({ sort: 'name' })

export const getTechnicians = () =>
  pb.collection('users').getFullList<User>({
    filter: 'role = "technician" || role = "admin"',
    sort: 'name',
  })

export const getUser = (id: string) => pb.collection('users').getOne<User>(id)

export const createUser = (data: {
  email: string
  password: string
  passwordConfirm: string
  name: string
  role: string
  phone?: string
}) => pb.collection('users').create<User>(data)

export const updateUser = (
  id: string,
  data: Partial<{
    name: string
    phone: string
    role: string
    email: string
  }>,
) => pb.collection('users').update<User>(id, data)

export const resetUserPassword = (id: string, password: string) =>
  pb.collection('users').update<User>(id, { password, passwordConfirm: password })

export const deleteUser = (id: string) => pb.collection('users').delete(id)
