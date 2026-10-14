import { MigrationPhysicalDownload } from '@/components/MigrationPhysicalDownload'
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

  const [exportingFull, setExportingFull] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const downloadingAttachments = false
  const attachmentProgress: string | null = null
  const [lastPackage, setLastPackage] = useState<any | null>(() => {
    try {
      const cached = localStorage.getItem('juca_last_migration_package_meta')
      if (cached) return JSON.parse(cached)
    } catch {
      /* intentionally ignored */
    }
    return null
  })
  const [showAuditDetails, setShowAuditDetails] = useState(false)

  const handleExportFullSystemPackage = async () => {
    try {
      setExportingFull(true)
      setExportStatus('Iniciando exportação...')
      const {
        generateFullMigrationPackage,
        downloadMigrationPackageFile,
        downloadAttachmentsManifestCSV,
      } = await import('@/services/migration-export')
      const pkg = await generateFullMigrationPackage((msg) => {
        setExportStatus(msg)
      })
      setLastPackage(pkg)
      try {
        localStorage.setItem('juca_last_migration_package_meta', JSON.stringify(pkg))
      } catch {
        /* intentionally ignored */
      }
      downloadMigrationPackageFile(pkg)
      downloadAttachmentsManifestCSV(pkg.attachments_manifest)

      const statusDesc =
        pkg.meta.package_status === 'complete'
          ? 'PACOTE COMPLETO'
          : `PACOTE PARCIAL (${pkg.meta.collections_failed_count} coleções com falha)`

      const verifiedInitial = (pkg.attachments_manifest || []).filter(
        (it: any) => it.download_status === 'success' && !!it.sha256,
      ).length

      setExportStatus(
        `Status: ${statusDesc}. Exportados: ${pkg.meta.total_records_exported} registros em ${pkg.meta.collections_exported_count} coleções. Manifesto com ${pkg.meta.total_attachments_manifested} anexos gerado (${verifiedInitial} c/ SHA-256 no cache).`,
      )
    } catch (err: any) {
      setExportStatus(`Erro ao exportar: ${err?.message || String(err)}`)
    } finally {
      setExportingFull(false)
    }
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
        <div className="pt-2 border-t border-slate-200 space-y-3">
          <div className="rounded-md border border-indigo-200 bg-indigo-50/70 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                📦 Pacote Completo de Migração (Todas as Coleções)
              </span>
            </div>
            <p className="text-[11px] text-indigo-700">
              Exporta as 38 coleções do sistema em JSON bruto, manifesto de anexos com URLs
              permanentes, SHA-256 e auditoria financeira por status.
            </p>
            {exportStatus && (
              <p className="text-[10px] font-mono text-indigo-900 bg-white/80 p-1.5 rounded border border-indigo-200 whitespace-pre-wrap">
                {exportStatus}
              </p>
            )}
            {attachmentProgress && (
              <p className="text-[10px] font-mono text-emerald-800 bg-emerald-50 p-1.5 rounded border border-emerald-200 whitespace-pre-wrap">
                {attachmentProgress}
              </p>
            )}
            <div className="flex flex-col gap-1.5 pt-1">
              <Button
                type="button"
                size="sm"
                disabled={exportingFull || downloadingAttachments}
                onClick={handleExportFullSystemPackage}
                className="w-full text-xs gap-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold"
              >
                {exportingFull
                  ? 'Exportando base...'
                  : 'Gerar Pacote de Migração (JSON + Manifesto CSV)'}
              </Button>
              {lastPackage && (
                <>
                  <MigrationPhysicalDownload
                    manifest={lastPackage.attachments_manifest || []}
                    exportId={lastPackage.meta?.export_id || 'exportacao'}
                  />

                  {/* Botão direto para baixar manifesto CSV a qualquer momento sem reprocessar */}
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={downloadingAttachments || exportingFull}
                      onClick={async () => {
                        const { downloadAttachmentsManifestCSV } =
                          await import('@/services/migration-export')
                        downloadAttachmentsManifestCSV(
                          lastPackage.attachments_manifest || [],
                          'completo',
                        )
                      }}
                      className="text-[11px] gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                      <FileText className="h-3 w-3" /> Baixar Manifesto CSV
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={downloadingAttachments || exportingFull}
                      onClick={async () => {
                        const { downloadAttachmentsManifestCSV } =
                          await import('@/services/migration-export')
                        const pendingOrFailed = (lastPackage.attachments_manifest || []).filter(
                          (m: any) => m.download_status !== 'success' || !m.sha256,
                        )
                        if (pendingOrFailed.length === 0) {
                          alert(
                            'Não há arquivos pendentes ou com falha! Todos os anexos estão 100% verificados.',
                          )
                          return
                        }
                        downloadAttachmentsManifestCSV(pendingOrFailed, 'pendentes')
                      }}
                      className="text-[11px] gap-1 border-amber-200 text-amber-800 hover:bg-amber-50"
                    >
                      <FileText className="h-3 w-3" /> Manifesto Pendentes
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAuditDetails(!showAuditDetails)}
                    className="w-full text-xs text-indigo-700 hover:bg-indigo-100/50"
                  >
                    {showAuditDetails
                      ? 'Ocultar Relatório de Conferência'
                      : 'Ver Relatório de Conferência da Exportação'}
                  </Button>
                </>
              )}

              {showAuditDetails && lastPackage && (
                <div className="mt-2 rounded bg-white p-2.5 border border-indigo-200 text-xs space-y-2 max-h-56 overflow-y-auto font-sans">
                  <div className="flex justify-between items-center border-b pb-1">
                    <span className="font-bold text-slate-800">Conferência da Exportação</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      ID: {lastPackage.meta?.export_id}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Status do Pacote:</span>
                      <span className="font-semibold uppercase text-indigo-700">
                        {lastPackage.meta?.package_status}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Registros:</span>
                      <span className="font-bold font-mono">
                        {lastPackage.meta?.total_records_exported}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Coleções Exportadas:</span>
                      <span className="font-mono">
                        {lastPackage.meta?.collections_exported_count} de{' '}
                        {lastPackage.meta?.total_collections_catalog}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Anexos Listados:</span>
                      <span className="font-mono">
                        {lastPackage.meta?.total_attachments_manifested}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">OS Nominal Total:</span>
                      <span className="font-mono font-bold text-slate-800">
                        R$ {lastPackage.financial_audit?.service_orders_nominal_total?.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Faturamento Realizado (Pago):</span>
                      <span className="font-mono font-bold text-emerald-600">
                        R$ {lastPackage.financial_audit?.payments_total_paid?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {lastPackage.meta?.integrity_warnings?.length > 0 && (
                    <div className="mt-2 text-[10px] bg-amber-50 p-1.5 rounded border border-amber-200 text-amber-800 space-y-0.5">
                      <span className="font-bold block">Avisos de Integridade:</span>
                      {lastPackage.meta.integrity_warnings.map((w: string, idx: number) => (
                        <p key={idx}>• {w}</p>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 italic pt-1 border-t">
                    * Paginação por chave estável (+id). Para o corte final, registrar data e
                    verificar deltas com updated &gt;= corte.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                Exportação do Período (Equipe e Divisão de OS)
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
                <FileText className="h-3.5 w-3.5" /> CSV Divisão (Período)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportMigrationJSON}
                className="text-xs gap-1.5 border-indigo-200 hover:bg-indigo-50 text-indigo-700"
              >
                <FileText className="h-3.5 w-3.5" /> JSON Divisão (Período)
              </Button>
            </div>
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
