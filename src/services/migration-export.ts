import pb from '@/lib/pocketbase/client'

export interface CollectionExportMeta {
  collection: string
  count: number
  hasError: boolean
  error?: string
}

export interface AttachmentManifestItem {
  collection: string
  record_id: string
  field: string
  filename: string
  storage_path: string
  download_url: string
}

export interface FullMigrationPackage {
  meta: {
    system: string
    exported_at: string
    target_migration_deadline: string
    version_preview: string
    version_published_production: string
    pocketbase_version: string
    base_storage_url: string
    collections_count: number
    total_records: number
    total_attachments: number
  }
  collections_summary: Record<string, { count: number; error?: string }>
  data: Record<string, any[]>
  attachments_manifest: AttachmentManifestItem[]
  financial_audit: {
    service_orders_count: number
    service_orders_total_invoiced: number
    payments_count: number
    payments_total_paid: number
    payments_total_pending: number
    payments_total_refunded: number
    unique_orders_with_payments: number
    division_configured_orders: number
    uninformed_division_orders: number
  }
}

// Lista oficial das coleções do sistema JUCA INFORMÁTICA
export const ALL_SYSTEM_COLLECTIONS = [
  'users',
  'customers',
  'appointments',
  'service_orders',
  'services',
  'service_order_items',
  'status_history',
  'payments',
  'equipment',
  'products',
  'service_attachments',
  'notifications',
  'evaluations',
  'push_subscriptions',
  'service_types',
  'settings',
  'pos_venda_messages',
  'campaigns',
  'campanha_messages',
  'orcamentos',
  'orcamento_itens',
  'orcamento_anexos',
  'pricing_history',
  'rental_machines',
  'rental_quotes',
  'rental_contracts',
  'funcoes',
  'parametros',
  'suprimentos',
  'impressoras',
  'contratos',
  'auditoria_precos',
  'laudos_tecnicos',
  'financial_receivables',
  'rental_documents',
  'rental_reserve',
  'order_division_history',
] as const

// Definição dos campos de arquivo conhecidos por coleção para o manifesto
const ATTACHMENT_FIELDS: Record<string, string[]> = {
  users: ['avatar'],
  equipment: ['photos'],
  products: ['photo_file'],
  service_orders: ['customer_signature', 'technician_signature'],
  service_attachments: ['file'],
  campaigns: ['flyer'],
  orcamentos: ['assinatura_cliente', 'assinatura_tecnico'],
  orcamento_anexos: ['caminho_arquivo'],
  laudos_tecnicos: ['assinatura_tecnico', 'assinatura_cliente'],
}

/**
 * Busca TODOS os registros de uma coleção de forma paginada (batch 500)
 */
async function fetchAllRecordsFromCollection(collectionName: string): Promise<any[]> {
  const allRecords: any[] = []
  let page = 1
  const perPage = 500

  while (true) {
    const res = await pb.collection(collectionName).getList(page, perPage, {
      sort: '+created',
      requestKey: null,
    })

    if (!res.items || res.items.length === 0) break

    for (const item of res.items) {
      allRecords.push(item)
    }

    if (page >= res.totalPages) break
    page++
  }

  return allRecords
}

export type MigrationExportProgressCallback = (msg: string, percent: number) => void

/**
 * Gera o pacote completo e verificável de migração (dados brutos JSON + manifesto de anexos + auditoria de controle)
 */
export async function generateFullMigrationPackage(
  onProgress?: MigrationExportProgressCallback,
): Promise<FullMigrationPackage> {
  const startTime = new Date().toISOString()
  const dataMap: Record<string, any[]> = {}
  const summary: Record<string, { count: number; error?: string }> = {}
  const manifest: AttachmentManifestItem[] = []
  let totalRecords = 0

  const pbUrl =
    import.meta.env.VITE_POCKETBASE_URL ||
    'https://assistencia-tecnica-movel-86527.shrd00.internal.goskip.dev'

  const collections = ALL_SYSTEM_COLLECTIONS
  const totalCollections = collections.length

  for (let i = 0; i < totalCollections; i++) {
    const colName = collections[i]
    const pct = Math.round(((i + 1) / totalCollections) * 80)
    onProgress?.(`Exportando coleção ${colName} (${i + 1}/${totalCollections})...`, pct)

    try {
      const records = await fetchAllRecordsFromCollection(colName)
      dataMap[colName] = records
      summary[colName] = { count: records.length }
      totalRecords += records.length

      // Verifica anexos na coleção
      const fileFields = ATTACHMENT_FIELDS[colName] || []
      if (fileFields.length > 0) {
        for (const record of records) {
          for (const f of fileFields) {
            const val = record[f]
            if (!val) continue

            // Pode ser string única ou array de strings
            const filesArr = Array.isArray(val) ? val : [val]
            for (const filename of filesArr) {
              if (typeof filename === 'string' && filename.trim()) {
                const storagePath = `pb_data/storage/${record.collectionId || colName}/${record.id}/${filename}`
                const downloadUrl = `${pbUrl}/api/files/${record.collectionId || colName}/${record.id}/${filename}`
                manifest.push({
                  collection: colName,
                  record_id: record.id,
                  field: f,
                  filename,
                  storage_path: storagePath,
                  download_url: downloadUrl,
                })
              }
            }
          }
        }
      }
    } catch (err: any) {
      summary[colName] = { count: 0, error: err?.message || String(err) }
      dataMap[colName] = []
    }
  }

  onProgress?.('Consolidando conferência financeira e integridade...', 90)

  // Auditoria financeira de controle (sem duplicação de OS ou pagamentos)
  const orders = dataMap['service_orders'] || []
  const payments = dataMap['payments'] || []

  const totalInvoiced = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)

  let totalPaid = 0
  let totalPending = 0
  let totalRefunded = 0
  const uniqueOrderIdsWithPay = new Set<string>()

  for (const p of payments) {
    const amt = Number(p.amount) || 0
    if (p.service_order) uniqueOrderIdsWithPay.add(p.service_order)

    if (p.status === 'paid') totalPaid += amt
    else if (p.status === 'pending') totalPending += amt
    else if (p.status === 'refunded') totalRefunded += amt
  }

  const divisionConfiguredOrders = orders.filter(
    (o) => o.division_details && o.division_details.configured,
  ).length
  const uninformedDivisionOrders = orders.length - divisionConfiguredOrders

  onProgress?.('Pacote de migração concluído!', 100)

  return {
    meta: {
      system: 'JUCA INFORMÁTICA (Gestão & Assistência Técnica)',
      exported_at: startTime,
      target_migration_deadline: '2026-11-02',
      version_preview: 'v0.0.395',
      version_published_production: 'v0.0.232',
      pocketbase_version: 'PocketBase v0.36 (Skip Cloud)',
      base_storage_url: `${pbUrl}/api/files/`,
      collections_count: totalCollections,
      total_records: totalRecords,
      total_attachments: manifest.length,
    },
    collections_summary: summary,
    data: dataMap,
    attachments_manifest: manifest,
    financial_audit: {
      service_orders_count: orders.length,
      service_orders_total_invoiced: Number(totalInvoiced.toFixed(2)),
      payments_count: payments.length,
      payments_total_paid: Number(totalPaid.toFixed(2)),
      payments_total_pending: Number(totalPending.toFixed(2)),
      payments_total_refunded: Number(totalRefunded.toFixed(2)),
      unique_orders_with_payments: uniqueOrderIdsWithPay.size,
      division_configured_orders: divisionConfiguredOrders,
      uninformed_division_orders: uninformedDivisionOrders,
    },
  }
}

/**
 * Dispara o download local no navegador do pacote JSON completo
 */
export function downloadMigrationPackageFile(pkg: FullMigrationPackage, filename?: string) {
  const jsonStr = JSON.stringify(pkg, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStr = new Date().toISOString().substring(0, 10)
  link.href = url
  link.download = filename || `juca_backup_completo_migracao_${dateStr}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Dispara o download do Manifesto de Anexos em formato CSV
 */
export function downloadAttachmentsManifestCSV(manifest: AttachmentManifestItem[]) {
  const headers = [
    'colecao',
    'registro_id',
    'campo',
    'nome_arquivo',
    'caminho_storage',
    'url_download',
  ]
  const rows = manifest.map((m) => [
    `"${m.collection}"`,
    `"${m.record_id}"`,
    `"${m.field}"`,
    `"${m.filename}"`,
    `"${m.storage_path}"`,
    `"${m.download_url}"`,
  ])

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStr = new Date().toISOString().substring(0, 10)
  link.href = url
  link.download = `manifesto_anexos_juca_${dateStr}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
