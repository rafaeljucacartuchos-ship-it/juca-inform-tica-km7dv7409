import { useState, useEffect } from 'react'
import { DollarSign, CheckCircle2, Wrench, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getServiceOrders } from '@/services/service_orders'
import { getAllPayments } from '@/services/payments'
import { getCatalogServices } from '@/services/services_catalog'
import { SERVICE_CATEGORY_LABELS, ServiceCategory } from '@/types'

export default function Relatorios() {
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [completedOrders, setCompletedOrders] = useState(0)
  const [categoryData, setCategoryData] = useState<
    Record<string, { count: number; total: number }>
  >({})

  useEffect(() => {
    Promise.all([getServiceOrders(), getAllPayments(), getCatalogServices()]).then(
      ([so, pay, services]) => {
        setTotalOrders(so.length)
        setCompletedOrders(
          so.filter((o) => o.status === 'closed' || o.status === 'completed').length,
        )
        const rev = pay.filter((p) => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
        setTotalRevenue(rev)

        const catData: Record<string, { count: number; total: number }> = {}
        for (const s of services) {
          const cat = (s.category || 'outros') as ServiceCategory
          if (!catData[cat]) catData[cat] = { count: 0, total: 0 }
          catData[cat].count++
          catData[cat].total += s.price || 0
        }
        setCategoryData(catData)
      },
    )
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

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Tag className="h-4 w-4 text-indigo-500" />
            Serviços por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(SERVICE_CATEGORY_LABELS).map(([value, label]) => {
              const data = categoryData[value] || { count: 0, total: 0 }
              return (
                <div
                  key={value}
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-3 bg-slate-50/50"
                >
                  <div>
                    <Badge variant="outline" className="text-[10px] mb-1">
                      {label}
                    </Badge>
                    <p className="text-xs text-slate-500">
                      {data.count} serviço{data.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-sm text-slate-900">
                    R$ {data.total.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
