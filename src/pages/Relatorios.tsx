import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, CheckCircle2, Wrench, Tag, Printer, FileDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ServiceOrder, ServiceOrderItem, SERVICE_CATEGORY_LABELS } from '@/types'
import { getServiceOrders, getAllOrderItems } from '@/services/service_orders'
import { getAllPayments } from '@/services/payments'
import { buildCategoryReport, type CategoryReportData } from '@/lib/category-report'
import { exportToCSV, exportToExcel, type ExportSection } from '@/lib/export-utils'
import { ExportReportsModal } from '@/components/ExportReportsModal'

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em Andamento',
  paused: 'Pausada',
  waiting_parts: 'Aguardando Peças',
  completed: 'Concluída',
  closed: 'Fechada',
  cancelled: 'Cancelada',
}

function fmtDate(d?: string): string {
  if (!d) return ''
  return d.substring(0, 10).split('-').reverse().join('/')
}

export default function Relatorios() {
  const navigate = useNavigate()
  const [report, setReport] = useState<CategoryReportData[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [completedOrders, setCompletedOrders] = useState(0)
  const [payments, setPayments] = useState<any[]>([])
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [exportOpen, setExportOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getServiceOrders(), getAllOrderItems(), getAllPayments()])
      .then(([so, items, pay]: [ServiceOrder[], ServiceOrderItem[], any[]]) => {
        setOrders(so)
        setPayments(pay)
        setTotalOrders(so.length)
        setCompletedOrders(
          so.filter((o) => o.status === 'closed' || o.status === 'completed').length,
        )
        const rev = pay.filter((p) => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
        setTotalRevenue(rev)
        setReport(buildCategoryReport(so, items))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleExport = (format: 'csv' | 'excel') => {
    const sections: ExportSection[] = [
      { title: 'Relatório por Categoria de Serviço' },
      {
        title: 'Resumo por Categoria',
        headers: ['Categoria', 'Qtd. OS', 'Receita (R$)'],
        rows: report
          .filter((c) => c.count > 0)
          .map((c) => [c.label, c.count, c.revenue.toFixed(2)]),
      },
    ]
    for (const cat of report.filter((c) => c.count > 0)) {
      sections.push({
        title: cat.label,
        headers: ['Número', 'Cliente', 'Status', 'Data', 'Total'],
        rows: cat.orders.map((o) => [
          o.number,
          o.expand?.customer?.name || '',
          STATUS_LABELS[o.status] || o.status,
          fmtDate(o.created),
          (o.total || 0).toFixed(2),
        ]),
      })
    }
    const fn = `relatorio_categorias_${new Date().toISOString().substring(0, 10)}`
    if (format === 'csv') exportToCSV(fn, sections)
    else exportToExcel(fn, sections)
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Carregando relatórios...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Relatórios por Categoria
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Análise de ordens de serviço agrupadas por categoria.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => navigate('/relatorios/avaliacoes')}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            ★ Avaliações dos Técnicos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            className="gap-1.5"
          >
            <FileDown className="h-4 w-4" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('excel')}
            className="gap-1.5"
          >
            <FileDown className="h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(true)}
            className="gap-1.5"
          >
            <FileDown className="h-4 w-4" /> Rel. Geral
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/relatorios/categorias/imprimir')}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
          >
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </Button>
        </div>
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
              <p className="text-xs text-slate-500 font-medium">Total de OS</p>
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
              <p className="text-xs text-slate-500 font-medium">Concluídas</p>
              <p className="text-xl font-bold font-mono text-slate-900">{completedOrders}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {report.map((cat) => {
        if (cat.count === 0) return null
        return (
          <Card key={cat.category} className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-indigo-500" />
                  {cat.label}
                </span>
                <span className="flex items-center gap-3 text-xs">
                  <Badge variant="outline">{cat.count} OS</Badge>
                  <span className="font-mono font-bold text-emerald-600">
                    R$ {cat.revenue.toFixed(2)}
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Número</th>
                      <th className="py-2.5 px-4">Cliente</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cat.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-semibold text-indigo-600">
                          {o.number}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">
                          {o.expand?.customer?.name || '—'}
                        </td>
                        <td className="py-2.5 px-4">{STATUS_LABELS[o.status] || o.status}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold">
                          R$ {(o.total || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      })}

      <ExportReportsModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        orders={orders}
        payments={payments}
        technicians={[]}
        history={[]}
      />
    </div>
  )
}
