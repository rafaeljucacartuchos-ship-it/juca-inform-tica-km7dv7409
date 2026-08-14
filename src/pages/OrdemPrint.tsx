import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { ServiceOrder } from '@/types'
import { getServiceOrder } from '@/services/service_orders'
import { useAuth } from '@/hooks/use-auth'
import { PrintOrderDocument } from '@/components/PrintOrderDocument'

export default function OrdemPrint() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [order, setOrder] = useState<ServiceOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getServiceOrder(id)
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!order) {
    return <div className="p-8 text-center text-slate-500">Ordem não encontrada.</div>
  }

  if (user?.role === 'technician' && order.technician !== user.id) {
    return <Navigate to="/ordens" replace />
  }

  return <PrintOrderDocument order={order} items={[]} history={[]} attachments={[]} />
}
