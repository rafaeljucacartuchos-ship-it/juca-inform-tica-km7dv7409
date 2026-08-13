import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ServiceOrder, ServiceOrderItem } from '@/types'
import { getServiceOrders } from '@/services/service_orders'
import { getAllOrderItems } from '@/services/service_orders'
import { buildCategoryReport, type CategoryReportData } from '@/lib/category-report'
import { COMPANY_DATA } from '@/lib/company'

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em Andamento',
  waiting_parts: 'Aguardando Peças',
  completed: 'Concluída',
  closed: 'Fechada',
  cancelled: 'Cancelada',
}

function fmtDate(d?: string): string {
  if (!d) return ''
  return d.substring(0, 10).split('-').reverse().join('/')
}

export default function RelatorioCategoriasPrint() {
  const [report, setReport] = useState<CategoryReportData[]>([])
  const [loading, setLoading] = useState(true)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    Promise.all([getServiceOrders(), getAllOrderItems()])
      .then(([orders, items]: [ServiceOrder[], ServiceOrderItem[]]) => {
        const r = buildCategoryReport(orders, items)
        setReport(r)
        setTotalRevenue(r.reduce((s, c) => s + c.revenue, 0))
        setTotalCount(r.reduce((s, c) => s + c.count, 0))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-6 sm:p-8">
      <div className="no-print mb-6 flex justify-end">
        <Button onClick={() => window.print()} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="print-document mx-auto max-w-4xl">
        <div className="mb-6 text-center border-b-2 border-slate-800 pb-4">
          <h1 className="text-xl font-bold text-slate-900">{COMPANY_DATA.name}</h1>
          <p className="text-sm text-slate-600">Relatório de Ordens de Serviço por Categoria</p>
          <p className="text-xs text-slate-500 mt-1">
            Emitido em: {fmtDate(new Date().toISOString())}
          </p>
        </div>

        <div className="mb-6 flex justify-around text-center">
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalCount}</p>
            <p className="text-xs text-slate-500">Total de OS</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">R$ {totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-slate-500">Receita Total</p>
          </div>
        </div>

        {report.map((cat) =>
          cat.count === 0 ? null : (
            <div key={cat.category} className="mb-6 break-inside-avoid">
              <h2 className="text-sm font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">
                {cat.label} — {cat.count} OS — R$ {cat.revenue.toFixed(2)}
              </h2>
              <table className="w-full text-xs border border-slate-300">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-2 py-1.5 text-left border-b border-slate-300">Nº</th>
                    <th className="px-2 py-1.5 text-left border-b border-slate-300">Cliente</th>
                    <th className="px-2 py-1.5 text-left border-b border-slate-300">Status</th>
                    <th className="px-2 py-1.5 text-right border-b border-slate-300">Data</th>
                    <th className="px-2 py-1.5 text-right border-b border-slate-300">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.orders.map((o) => (
                    <tr key={o.id} className="border-b border-slate-200">
                      <td className="px-2 py-1.5 font-mono font-semibold">{o.number}</td>
                      <td className="px-2 py-1.5">{o.expand?.customer?.name || '—'}</td>
                      <td className="px-2 py-1.5">{STATUS_LABELS[o.status] || o.status}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmtDate(o.created)}</td>
                      <td className="px-2 py-1.5 text-right font-mono font-bold">
                        R$ {(o.total || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        )}

        <div className="mt-8 text-center text-xs text-slate-400 border-t border-slate-200 pt-4">
          {COMPANY_DATA.name} — {COMPANY_DATA.phone}
        </div>
      </div>
    </div>
  )
}
