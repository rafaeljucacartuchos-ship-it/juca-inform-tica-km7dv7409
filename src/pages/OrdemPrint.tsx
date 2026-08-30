import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { ServiceOrder, ServiceOrderItem, StatusHistory, ServiceAttachment } from '@/types'
import { getServiceOrder, getOrderItems, getStatusHistory } from '@/services/service_orders'
import { getAttachments } from '@/services/service_attachments'
import { useAuth } from '@/hooks/use-auth'
import { PrintOrderDocument } from '@/components/PrintOrderDocument'

export default function OrdemPrint() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [order, setOrder] = useState<ServiceOrder | null>(null)
  const [items, setItems] = useState<ServiceOrderItem[]>([])
  const [history, setHistory] = useState<StatusHistory[]>([])
  const [attachments, setAttachments] = useState<ServiceAttachment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      getServiceOrder(id),
      getOrderItems(id).catch(() => [] as ServiceOrderItem[]),
      getStatusHistory(id).catch(() => [] as StatusHistory[]),
      getAttachments(id).catch(() => [] as ServiceAttachment[]),
    ])
      .then(([o, it, hist, atts]) => {
        // Recalcula subtotal e total consistente com a visualização da ordem
        const subtotal = (it || []).reduce((sum, item) => sum + (item.total || 0), 0)
        const desc = Number(o.desconto) || 0
        const acresc = Number(o.acrescimo) || 0
        if (subtotal > 0 || (o.total ?? 0) === 0) {
          o.total = Math.max(0, subtotal + acresc - desc)
        }
        setOrder(o)
        setItems(it || [])
        setHistory(hist || [])
        setAttachments(atts || [])
      })
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

  return (
    <PrintOrderDocument order={order} items={items} history={history} attachments={attachments} />
  )
}
