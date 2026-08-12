import pb from '@/lib/pocketbase/client'
import { Payment } from '@/types'

export const getOrderPayments = (orderId: string) =>
  pb.collection('payments').getFullList<Payment>({
    filter: `service_order = "${orderId}"`,
    sort: '-created',
  })

export const getAllPayments = () =>
  pb.collection('payments').getFullList<Payment>({
    sort: '-created',
  })

export const createPayment = (data: Partial<Payment>) =>
  pb.collection('payments').create<Payment>(data)
