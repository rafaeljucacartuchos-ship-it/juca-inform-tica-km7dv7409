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
import { ServiceOrder, Payment, User, StatusHistory } from '@/types'
import { exportToCSV, exportToExcel, type ExportSection } from '@/lib/export-utils'

interface ExportReportsModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  orders: ServiceOrder[]
  payments: Payment[]
  technicians: User[]
  history: StatusHistory[]
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em Andamento',
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
  const periodPayments = payments.filter((p) => p.status === 'paid' && inRange(p.paid_at))
  const revenue = periodPayments.reduce((s, p) => s + (p.amount || 0), 0)
  const invoiced = periodOrders.reduce((s, o) => s + (o.total || 0), 0)
  const uniqueCustomers = new Set(periodOrders.map((o) => o.customer)).size

  const statusCounts = [
    'open',
    'in_progress',
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
      title: 'Financeiro',
      headers: ['Indicador', 'Valor'],
      rows: [
        ['Faturamento Total (Pago)', `R$ ${revenue.toFixed(2)}`],
        ['Total Faturado', `R$ ${invoiced.toFixed(2)}`],
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
            <div className="flex justify-between">
              <span className="text-slate-500">Clientes:</span>
              <span className="font-bold">{uniqueCustomers}</span>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleCSV} className="text-xs gap-1.5">
            <FileText className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button
            size="sm"
            onClick={handleExcel}
            className="gap-1.5 bg-emerald-600 text-xs hover:bg-emerald-700"
          >
            <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
