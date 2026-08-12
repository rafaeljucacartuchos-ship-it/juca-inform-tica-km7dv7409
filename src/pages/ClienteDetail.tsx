import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, MapPin, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Customer, ServiceOrder } from '@/types'
import { getCustomer } from '@/services/customers'
import { getServiceOrders } from '@/services/service_orders'

export default function ClienteDetail() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<ServiceOrder[]>([])

  useEffect(() => {
    if (!id) return
    getCustomer(id)
      .then(setCustomer)
      .catch(() => {})
    getServiceOrders(`customer = "${id}"`)
      .then(setOrders)
      .catch(() => {})
  }, [id])

  if (!customer) {
    return <div className="p-8 text-center text-slate-500">Carregando cliente...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/clientes">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{customer.name}</h1>
          <p className="text-xs text-slate-500">Perfil do cliente e histórico de atendimento</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900">Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Phone className="h-4 w-4 text-indigo-500" />
              <span className="font-mono">{customer.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Mail className="h-4 w-4 text-indigo-500" />
              <span>{customer.email || 'Não informado'}</span>
            </div>
            <div className="flex items-start gap-2 text-slate-700">
              <MapPin className="h-4 w-4 text-indigo-500 mt-0.5" />
              <span>
                {customer.street} {customer.number}, {customer.city} - {customer.state} (
                {customer.zip})
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900">
              Histórico de Ordens de Serviço
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Número</th>
                  <th className="py-2.5 px-4">Título</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-600">
                      <Link to={`/ordens/${o.id}`}>{o.number}</Link>
                    </td>
                    <td className="py-2.5 px-4 font-medium">{o.title}</td>
                    <td className="py-2.5 px-4 capitalize">{o.status}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">
                      R$ {(o.total || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      Nenhuma ordem encontrada para este cliente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
