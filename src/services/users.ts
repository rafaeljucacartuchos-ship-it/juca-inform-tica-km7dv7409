import pb from '@/lib/pocketbase/client'
import { User } from '@/types'

export const getUsers = () =>
  pb.collection('users').getFullList<User>({
    sort: 'name',
  })

export const getTechnicians = () =>
  pb.collection('users').getFullList<User>({
    filter: 'role = "technician" || role = "admin"',
    sort: 'name',
  })
