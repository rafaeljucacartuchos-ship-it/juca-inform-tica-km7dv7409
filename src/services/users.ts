import pb from '@/lib/pocketbase/client'
import { User } from '@/types'

export const getUsers = (includeInactive = false) => {
  if (includeInactive) {
    return pb.collection('users').getFullList<User>({ sort: 'name' })
  }
  return pb.collection('users').getFullList<User>({
    filter: 'ativo = true || ativo = null',
    sort: 'name',
  })
}

export const getAllUsers = () => pb.collection('users').getFullList<User>({ sort: 'name' })

export const getTechnicians = (includeInactive = false) => {
  if (includeInactive) {
    return pb.collection('users').getFullList<User>({
      filter: 'role = "technician" || role = "admin"',
      sort: 'name',
    })
  }
  return pb.collection('users').getFullList<User>({
    filter: '(role = "technician" || role = "admin") && (ativo = true || ativo = null)',
    sort: 'name',
  })
}

export const getUser = (id: string) => pb.collection('users').getOne<User>(id)

export const createUser = (data: {
  password: string
  passwordConfirm: string
  name: string
  role: string
  phone?: string
  email?: string
}) => pb.collection('users').create<User>(data)

export const updateUser = (
  id: string,
  data: Partial<{
    name: string
    phone: string
    role: string
    email: string
    permissions: Record<string, boolean>
    ativo: boolean
  }>,
) => pb.collection('users').update<User>(id, data)

export const resetUserPassword = (id: string, password: string) =>
  pb.collection('users').update<User>(id, { password, passwordConfirm: password })

export const deleteUser = (id: string) => pb.collection('users').delete(id)

export const toggleUserActive = async (id: string, currentActive = true) => {
  return pb.collection('users').update<User>(id, { ativo: !currentActive })
}

export const regenerateRegistrationCode = (id: string) =>
  pb.send(`/backend/v1/users/${id}/regenerate-code`, { method: 'POST' })
