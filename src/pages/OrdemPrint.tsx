import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PrintOrderDocument } from '@/components/PrintOrderDocument'
import { getServiceOrder, getOrderItems, getStatusHistory } from '@/services/service_orders'
import { getAttachments } from '@/services/service_attachments'
import { ServiceOrder, ServiceOrderItem, StatusHistory, ServiceAttachment } from '@/types'

export default function OrdemPrint() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [order, setOrder] = useState<ServiceOrder | null>(null)
  const [items, setItems] = useState<ServiceOrderItem[]>([])
  const [history, setHistory] = useState<StatusHistory[]>([])
  const [attachments, setAttachments] = useState<ServiceAttachment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([getServiceOrder(id), getOrderItems(id), getStatusHistory(id), getAttachments(id)])
      .then(([o, it, h, att]) => {
        setOrder(o)
        setItems(it)
        setHistory([...h].reverse())
        setAttachments(att)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando documento...</div>
  if (!order) return <div className="p-8 text-center text-slate-500">Ordem não encontrada.</div>

  return (
    <div className="min-h-screen bg-white p-6 print:p-0">
      <div className="no-print mb-4 flex gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate(`/ordens/${id}`)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <Button
          size="sm"
          onClick={() => window.print()}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Printer className="mr-1 h-4 w-4" /> Imprimir / PDF
        </Button>
      </div>
      <PrintOrderDocument order={order} items={items} history={history} attachments={attachments} />
    </div>
  )
}
