import pb from '@/lib/pocketbase/client'
import { StatusHistory } from '@/types'

export const getAllStatusHistory = () =>
  pb.collection('status_history').getFullList<StatusHistory>({
    sort: 'created',
  })
