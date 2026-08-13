import { useState, useEffect } from 'react'
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
import { ServiceOrder, Payment, ServiceOrderItem } from '@/types'
import { exportToCSV, exportToExcel, type ExportSection } from '@/lib/export-utils'
import { getAllOrderItems } from '@/services/service_orders'
import { buildCategoryReport, buildOrderCategoryMap } from '@/lib/category-report'

interface ExportOrdersListModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  orders: ServiceOrder[]
  payments: Payment[]
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

function getPaymentStatus(orderId: string, payments: Payment[]): string {
  const orderPayments = payments.filter((p) => p.service_order === orderId)
  if (orderPayments.length === 0) return 'Sem pagamento'
  if (orderPayments.some((p) => p.status === 'paid')) return 'Pago'
  if (orderPayments.some((p) => p.status === 'pending')) return 'Pendente'
  if (orderPayments.some((p) => p.status === 'refunded')) return 'Reembolsado'
  return 'Sem pagamento'
}

function fmtDate(d?: string): string {
  if (!d) return ''
  return d.substring(0, 10).split('-').reverse().join('/')
}

export function ExportOrdersListModal({
  open,
  onOpenChange,
  orders,
  payments,
}: ExportOrdersListModalProps) {
  const today = new Date().toISOString().substring(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .substring(0, 10)
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [format, setFormat] = useState<'csv' | 'excel'>('csv')
  const [allItems, setAllItems] = useState<ServiceOrderItem[]>([])

  useEffect(() => {
    if (open) {
      getAllOrderItems()
        .then(setAllItems)
        .catch(() => {})
    }
  }, [open])

  const inRange = (dateStr?: string) => {
    if (!dateStr) return false
    const d = dateStr.substring(0, 10)
    return d >= startDate && d <= endDate
  }

  const periodOrders = orders.filter((o) => inRange(o.created))
  const dateRange = `${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')}`

  const headers = [
    'Número',
    'Status',
    'Prioridade',
    'Título',
    'Descrição',
    'Cliente',
    'Telefone',
    'Técnico',
    'Data Criação',
    'Data Atendimento',
    'Horário Atendimento',
    'Equipamento',
    'Marca',
    'Modelo',
    'N° Série',
    'Custo Estimado',
    'Total',
    'Status Pagamento',
    'Observações',
  ]

  const rows: (string | number)[][] = periodOrders.map((o) => [
    o.number,
    STATUS_LABELS[o.status] || o.status,
    PRIORITY_LABELS[o.priority] || o.priority,
    o.title || '',
    o.description || '',
    o.expand?.customer?.name || '',
    o.expand?.customer?.phone || '',
    o.expand?.technician?.name || '',
    fmtDate(o.created),
    fmtDate(o.attendance_date),
    o.attendance_time || '',
    o.expand?.equipment_ref?.name || o.equipment || '',
    o.expand?.equipment_ref?.brand || '',
    o.expand?.equipment_ref?.model || '',
    o.expand?.equipment_ref?.serial_number || '',
    (o.estimated_cost || 0).toFixed(2),
    (o.total || 0).toFixed(2),
    getPaymentStatus(o.id, payments),
    o.notes || '',
  ])

  const categoryReport = buildCategoryReport(periodOrders, allItems)
  const orderCategoryMap = buildOrderCategoryMap(categoryReport)

  const categoryHeaders = [...headers, 'Categorias']
  const categoryRows: (string | number)[][] = periodOrders.map((o, i) => [
    ...rows[i],
    orderCategoryMap.get(o.id) || 'Sem categoria',
  ])

  const buildSections = (): ExportSection[] => [
    { title: `Lista de Ordens de Serviço - Período: ${dateRange}` },
    { title: `Total de registros: ${periodOrders.length}` },
    {
      title: 'Resumo por Categoria de Serviço',
      headers: ['Categoria', 'Qtd. OS', 'Receita (R$)'],
      rows: categoryReport
        .filter((c) => c.count > 0)
        .map((c) => [c.label, c.count, c.revenue.toFixed(2)]),
    },
    { headers: categoryHeaders, rows: categoryRows },
  ]

  const handleExport = () => {
    const filename = `lista_oss_${startDate}_${endDate}`
    if (format === 'csv') {
      exportToCSV(filename, buildSections())
    } else {
      exportToExcel(filename, buildSections())
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            Exportar Lista de OSs
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
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-600">Formato</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={format === 'csv' ? 'default' : 'outline'}
                onClick={() => setFormat('csv')}
                className={format === 'csv' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
              >
                <FileText className="h-4 w-4 mr-1.5" /> CSV
              </Button>
              <Button
                type="button"
                size="sm"
                variant={format === 'excel' ? 'default' : 'outline'}
                onClick={() => setFormat('excel')}
                className={format === 'excel' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Excel
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Período:</span>
              <span className="font-medium">{dateRange}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total de OSs:</span>
              <span className="font-bold">{periodOrders.length}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            size="sm"
            onClick={handleExport}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
          >
            {format === 'csv' ? (
              <FileText className="h-4 w-4" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
