import { useState } from 'react'
import { FileText, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ServiceOrder, Payment, User, StatusHistory, ServiceOrderItem } from '@/types'
import { exportToCSV, exportToExcel, type ExportSection } from '@/lib/export-utils'

interface ExportReportsModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  orders: ServiceOrder[]
  payments: Payment[]
  technicians: User[]
  history: StatusHistory[]
  items?: ServiceOrderItem[]
  divisionHistory?: import('@/types').OrderDivisionHistoryRecord[]
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em Andamento',
  paused: 'Pausada',
  waiting_parts: 'Aguardando Peças',
  completed: 'Concluída',
  closed: 'Fechada',
  cancelled: 'Cancelada',
}
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

export function ExportReportsModal({
  open,
  onOpenChange,
  orders,
  payments,
  technicians,
  items = [],
  divisionHistory = [],
}: ExportReportsModalProps) {
  const today = new Date().toISOString().substring(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .substring(0, 10)
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(today)

  const inRange = (dateStr?: string) => {
    if (!dateStr) return false
    const d = dateStr.substring(0, 10)
    return d >= startDate && d <= endDate
  }

  const periodOrders = orders.filter((o) => inRange(o.created))
  const periodOrderIds = new Set(periodOrders.map((o) => o.id))
  const periodPayments = payments.filter((p) => p.status === 'paid' && inRange(p.paid_at))
  const revenue = periodPayments.reduce((s, p) => s + (p.amount || 0), 0)
  const invoiced = periodOrders.reduce((s, o) => s + (o.total || 0), 0)
  const uniqueCustomers = new Set(periodOrders.map((o) => o.customer)).size

  // Métricas separadas de Produtos vs Serviços
  const periodItems = items.filter((it) => periodOrderIds.has(it.service_order))
  const productItems = periodItems.filter(
    (it) => !!it.product && it.expand?.product?.type !== 'servico',
  )
  const serviceItems = periodItems.filter(
    (it) => !!it.service || it.expand?.product?.type === 'servico',
  )

  const productTotal = productItems.reduce((s, it) => s + (it.total || 0), 0)
  const serviceTotal = serviceItems.reduce((s, it) => s + (it.total || 0), 0)
  const productQty = productItems.reduce((s, it) => s + (it.quantity || 1), 0)
  const serviceQty = serviceItems.reduce((s, it) => s + (it.quantity || 1), 0)

  const statusCounts = [
    'open',
    'in_progress',
    'paused',
    'waiting_parts',
    'completed',
    'closed',
    'cancelled',
  ].map((s) => ({
    label: STATUS_LABELS[s],
    count: periodOrders.filter((o) => o.status === s).length,
  }))
  const priorityCounts = ['low', 'medium', 'high', 'urgent'].map((p) => ({
    label: PRIORITY_LABELS[p],
    count: periodOrders.filter((o) => o.priority === p).length,
  }))
  const techCompleted = technicians
    .map((t) => ({
      name: t.name,
      count: periodOrders.filter(
        (o) => o.technician === t.id && (o.status === 'completed' || o.status === 'closed'),
      ).length,
    }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)

  const dateRange = `${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')}`

  const buildSections = (): ExportSection[] => [
    { title: `Relatório de Desempenho - Período: ${dateRange}` },
    {
      title: 'Indicadores Gerais',
      headers: ['Indicador', 'Valor'],
      rows: [
        ['Total de Ordens de Serviço', periodOrders.length],
        ...statusCounts.map((s) => [s.label, s.count] as [string, number]),
      ],
    },
    {
      title: 'Por Prioridade',
      headers: ['Prioridade', 'Quantidade'],
      rows: priorityCounts.map((p) => [p.label, p.count]),
    },
    {
      title: 'Financeiro e Segmentação (Produtos vs Serviços)',
      headers: ['Indicador', 'Valor'],
      rows: [
        ['Faturamento Total (Pago)', `R$ ${revenue.toFixed(2)}`],
        ['Total Faturado em O.S.', `R$ ${invoiced.toFixed(2)}`],
        ['Total em Produtos / Peças', `R$ ${productTotal.toFixed(2)} (${productQty} un.)`],
        ['Total em Serviços / Mão de Obra', `R$ ${serviceTotal.toFixed(2)} (${serviceQty} un.)`],
        ['Clientes Atendidos', uniqueCustomers],
      ],
    },
    {
      title: 'Top Técnicos por Ordens Concluídas',
      headers: ['Técnico', 'Ordens Concluídas'],
      rows: techCompleted.map((t) => [t.name, t.count]),
    },
  ]

  const handleCSV = () => exportToCSV(`relatorio_${startDate}_${endDate}`, buildSections())
  const handleExcel = () => exportToExcel(`relatorio_${startDate}_${endDate}`, buildSections())

  const handleExportMigrationCSV = () => {
    const ordersHeaders = [
      'id',
      'number',
      'status',
      'created',
      'total',
      'technician_id',
      'technician_name',
      'second_technician_id',
      'second_technician_name',
      'seller_id',
      'seller_name',
      'division_model',
      'division_details_json',
    ]

    const ordersRows = periodOrders.map((o) => [
      o.id,
      o.number,
      o.status,
      o.created || '',
      (o.total || 0).toFixed(2),
      o.technician || '',
      o.expand?.technician?.name || '',
      o.second_technician || '',
      o.expand?.second_technician?.name || '',
      o.seller || '',
      o.expand?.seller?.name || '',
      o.division_model || (o.division_details ? 'definida' : 'Divisão não informada'),
      o.division_details ? JSON.stringify(o.division_details) : '',
    ])

    const relevantHistory = divisionHistory.filter((h) => periodOrderIds.has(h.service_order))
    const historyHeaders = [
      'id',
      'service_order_id',
      'user_id',
      'user_name',
      'action',
      'reason',
      'order_status_at_change',
      'created',
      'previous_state_json',
      'new_state_json',
      'previous_details_json',
      'new_details_json',
    ]

    const historyRows = relevantHistory.map((h) => [
      h.id,
      h.service_order,
      h.user || '',
      h.user_name || '',
      h.action || '',
      h.reason || '',
      h.order_status_at_change || '',
      h.created || '',
      h.previous_state ? JSON.stringify(h.previous_state) : '',
      h.new_state ? JSON.stringify(h.new_state) : '',
      h.previous_details ? JSON.stringify(h.previous_details) : '',
      h.new_details ? JSON.stringify(h.new_details) : '',
    ])

    const migrationSections: ExportSection[] = [
      { title: `Migração e Auditoria da Divisão de OS - Período: ${dateRange}` },
      {
        title: 'Ordens de Serviço (Equipe e Divisão)',
        headers: ordersHeaders,
        rows: ordersRows,
      },
      {
        title: 'Histórico de Auditoria da Divisão (order_division_history)',
        headers: historyHeaders,
        rows: historyRows,
      },
    ]

    exportToCSV(`migracao_divisao_os_${startDate}_${endDate}`, migrationSections)
  }

  const handleExportMigrationJSON = () => {
    const relevantHistory = divisionHistory.filter((h) => periodOrderIds.has(h.service_order))
    const payload = {
      exported_at: new Date().toISOString(),
      date_range: { start: startDate, end: endDate },
      total_orders: periodOrders.length,
      total_history_records: relevantHistory.length,
      service_orders: periodOrders.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        created: o.created,
        total: o.total,
        technician: o.technician || null,
        technician_name: o.expand?.technician?.name || null,
        second_technician: o.second_technician || null,
        second_technician_name: o.expand?.second_technician?.name || null,
        seller: o.seller || null,
        seller_name: o.expand?.seller?.name || null,
        division_model:
          o.division_model || (o.division_details ? 'custom' : 'Divisão não informada'),
        division_details: o.division_details || null,
      })),
      order_division_history: relevantHistory.map((h) => ({
        id: h.id,
        service_order: h.service_order,
        user: h.user || null,
        user_name: h.user_name || null,
        action: h.action || null,
        reason: h.reason || null,
        order_status_at_change: h.order_status_at_change || null,
        created: h.created,
        updated: h.updated,
        previous_state: h.previous_state || null,
        new_state: h.new_state || null,
        previous_details: h.previous_details || null,
        new_details: h.new_details || null,
      })),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `migracao_divisao_os_${startDate}_${endDate}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-md h-full sm:h-auto max-h-screen sm:max-h-[90vh] rounded-none sm:rounded-lg overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            Exportar Relatórios
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Período:</span>
              <span className="font-medium">{dateRange}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total de OS:</span>
              <span className="font-bold">{periodOrders.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Faturamento:</span>
              <span className="font-bold text-emerald-600">R$ {revenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200">
              <span className="text-indigo-700 font-medium">Produtos / Peças:</span>
              <span className="font-mono font-bold text-indigo-700">
                R$ {productTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-700 font-medium">Serviços / Mão de Obra:</span>
              <span className="font-mono font-bold text-emerald-700">
                R$ {serviceTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200">
              <span className="text-slate-500">Clientes Atendidos:</span>
              <span className="font-bold">{uniqueCustomers}</span>
            </div>
          </div>
        </div>
        <div className="pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
              Exportação para Migração (Equipe e Divisão)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportMigrationCSV}
              className="text-xs gap-1.5 border-indigo-200 hover:bg-indigo-50 text-indigo-700"
            >
              <FileText className="h-3.5 w-3.5" /> CSV Migração
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportMigrationJSON}
              className="text-xs gap-1.5 border-indigo-200 hover:bg-indigo-50 text-indigo-700"
            >
              <FileText className="h-3.5 w-3.5" /> JSON Migração
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleCSV} className="text-xs gap-1.5">
            <FileText className="h-4 w-4" /> Relatório CSV
          </Button>
          <Button
            size="sm"
            onClick={handleExcel}
            className="gap-1.5 bg-emerald-600 text-xs hover:bg-emerald-700"
          >
            <FileSpreadsheet className="h-4 w-4" /> Relatório Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
