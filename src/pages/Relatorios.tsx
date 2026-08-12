import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, DollarSign, CheckCircle2, Wrench } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getServiceOrders } from '@/services/service_orders'
import { getAllPayments } from '@/services/payments'

export default function Relatorios() {
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [completedOrders, setCompletedOrders] = useState(0)

  useEffect(() => {
    Promise.all([getServiceOrders(), getAllPayments()]).then(([so, pay]) => {
      setTotalOrders(so.length)
      setCompletedOrders(so.filter((o) => o.status === 'closed' || o.status === 'completed').length)
      const rev = pay.filter((p) => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
      setTotalRevenue(rev)
    })
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Relatórios Gerenciais</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Métricas de faturamento, produtividade da equipe técnica e volume de atendimentos.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Faturamento Total</p>
              <p className="text-xl font-bold font-mono text-slate-900">
                R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total de Chamados</p>
              <p className="text-xl font-bold font-mono text-slate-900">{totalOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Atendimentos Concluídos</p>
              <p className="text-xl font-bold font-mono text-slate-900">{completedOrders}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
