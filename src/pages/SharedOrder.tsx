import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, Loader2 } from 'lucide-react'
import { CompanyHeader } from '@/components/CompanyHeader'
import { SignaturePad } from '@/components/SignaturePad'
import {
  getSharedOrder,
  saveCustomerSignaturePublic,
  type SharedOrderData,
} from '@/services/shared_order'

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em Andamento',
  waiting_parts: 'Aguardando Peças',
  completed: 'Concluída',
  closed: 'Fechada',
  cancelled: 'Cancelada',
}

export default function SharedOrder() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<SharedOrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    getSharedOrder(id)
      .then((data) => {
        setOrder(data)
        setSigned(data.has_customer_signature)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  const handleSign = async (dataUrl: string) => {
    if (!id) return
    setSigning(true)
    try {
      await saveCustomerSignaturePublic(id, dataUrl)
      setSigned(true)
    } catch {
      /* ignored */
    } finally {
      setSigning(false)
    }
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  if (error || !order)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Ordem de serviço não encontrada.
      </div>
    )

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <CompanyHeader />
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900 font-mono">OS #{order.number}</h1>
              <p className="text-xs text-slate-500">{order.title}</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-100 text-indigo-700">
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="font-semibold text-slate-500">Cliente:</span>
              <p className="font-medium text-slate-900">{order.customer?.name || '—'}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Telefone:</span>
              <p className="font-medium text-slate-900">{order.customer?.phone || '—'}</p>
            </div>
            {order.attendance_date && (
              <div>
                <span className="font-semibold text-slate-500">Data:</span>
                <p className="font-medium text-slate-900">
                  {order.attendance_date.split('-').reverse().join('/')}
                </p>
              </div>
            )}
            {order.attendance_time && (
              <div>
                <span className="font-semibold text-slate-500">Horário:</span>
                <p className="font-medium text-slate-900">{order.attendance_time}</p>
              </div>
            )}
          </div>
          {order.equipment && (
            <div className="text-xs">
              <span className="font-semibold text-slate-500">Equipamento:</span>
              <p className="font-medium text-slate-900">
                {order.equipment.name} {order.equipment.brand ? `- ${order.equipment.brand}` : ''}{' '}
                {order.equipment.model || ''}
              </p>
            </div>
          )}
          {order.description && (
            <div className="text-xs">
              <span className="font-semibold text-slate-500">Descrição:</span>
              <p className="text-slate-700 mt-1">{order.description}</p>
            </div>
          )}
          {order.service_report && (
            <div className="text-xs">
              <span className="font-semibold text-slate-500">Relatório:</span>
              <p className="text-slate-700 mt-1">{order.service_report}</p>
            </div>
          )}
          {order.items.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1.5">Descrição</th>
                    <th className="py-1.5 text-center">Qtd</th>
                    <th className="py-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {order.items.map((item, i) => (
                    <tr key={i}>
                      <td className="py-1.5">{item.description}</td>
                      <td className="py-1.5 text-center">{item.quantity}</td>
                      <td className="py-1.5 text-right font-mono">R$ {item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-slate-100 pt-3 flex justify-between font-bold text-sm">
            <span>Total:</span>
            <span className="font-mono text-indigo-600">R$ {(order.total || 0).toFixed(2)}</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
          {signed ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <CheckCircle className="h-12 w-12 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-900">Assinatura registrada!</p>
              <p className="text-xs text-slate-500">Sua assinatura foi salva com sucesso.</p>
            </div>
          ) : signing ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-900">Assinatura do Cliente</p>
              <p className="text-xs text-slate-500">
                Assine abaixo para confirmar o recebimento do serviço.
              </p>
              <SignaturePad onConfirm={handleSign} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
