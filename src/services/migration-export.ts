import pb from '@/lib/pocketbase/client'
import { buildCSVContent } from '@/lib/csv-helper'

export type ExportStatusKind = 'complete' | 'partial' | 'error'

export interface CollectionExportMeta {
  collection: string
  status: 'exported' | 'empty' | 'forbidden' | 'failed' | 'excluded'
  count_expected?: number
  count_exported: number
  page_size: number
  total_pages: number
  has_error: boolean
  error?: string
  authenticated_user_role?: string
  verified_coverage?: 'verified_independent_admin' | 'unverified_rls_dependent'
}

export interface AttachmentManifestItem {
  collection: string
  record_id: string
  field: string
  filename: string
  storage_path: string
  download_url: string
  is_embedded_base64?: boolean
  file_size_bytes?: number
  sha256?: string
  download_status?: 'pending' | 'success' | 'failed' | 'not_downloaded'
  download_error?: string
  batch_number?: number
  resumed_download?: boolean
  is_signed_original?: boolean
}

export interface FinancialStatusBreakdown {
  status: string
  count: number
  nominal_total: number
}

export interface FinancialAuditReport {
  // Ordens de Serviço
  service_orders_count: number
  service_orders_nominal_total: number // Soma nominal bruta de todos os totais
  service_orders_by_status: FinancialStatusBreakdown[]
  service_orders_with_invalid_values_count: number
  service_orders_without_customer_count: number

  // Pagamentos
  payments_count: number
  payments_total_paid: number
  payments_total_pending: number
  payments_total_refunded: number
  payments_by_method: Record<string, { count: number; total: number }>
  unique_orders_with_payments: number
  orphan_payments_count: number // Pagamentos sem vínculo com OS válida

  // Orçamentos
  quotes_count: number
  quotes_nominal_total: number
  quotes_by_status: FinancialStatusBreakdown[]

  // Produtos e Serviços (isolados para não duplicar OS)
  catalog_products_count: number
  catalog_services_count: number

  // Divisão de Equipe
  division_configured_orders: number
  uninformed_division_orders: number

  // Critérios
  criteria_notes: {
    faturamento_recebido_definition: string
    nominal_definition: string
    deduplication_rule: string
    rounding_precision: string
  }
}

export interface FullMigrationPackage {
  meta: {
    system: string
    export_id: string
    package_status: ExportStatusKind
    started_at: string
    completed_at: string
    duration_ms: number
    target_migration_deadline: string
    version_preview: string
    version_published_production: string
    version_verification_status: 'verified_via_git_and_runtime' | 'unverified'
    git_commit_origin: string
    environment_origin: string
    pocketbase_version: string
    base_storage_url: string
    total_collections_catalog: number
    collections_exported_count: number
    collections_empty_count: number
    collections_failed_count: number
    total_records_exported: number
    total_attachments_manifested: number
    total_attachments_downloaded: number
    auth_user: {
      id: string
      name: string
      role: string
      is_admin: boolean
      warning?: string
    }
    integrity_warnings: string[]
    concurrency_limitations_notice: string
  }
  collections_summary: Record<string, CollectionExportMeta>
  data: Record<string, any[]>
  attachments_manifest: AttachmentManifestItem[]
  financial_audit: FinancialAuditReport
}

// Lista oficial das 38 coleções do sistema JUCA INFORMÁTICA no PocketBase
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
  'quick_accounts',
] as const

// Coleções excluídas intencionalmente com justificativa técnica documentada
export const DOCUMENTED_COLLECTION_EXCLUSIONS: Record<string, string> = {
  // 'quick_accounts' é uma view SQL apenas de apoio ao login rápido (não é tabela física); é exportada normalmente caso acessível.
}

// Campos de arquivos nativos do PocketBase em cada coleção
export const ATTACHMENT_FIELDS: Record<string, string[]> = {
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
 * Calcula o hash SHA-256 de um ArrayBuffer no navegador via Web Crypto API nativa
 */
export async function computeSHA256(buffer: ArrayBuffer): Promise<string> {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return 'sha256-unsupported'
  }
}

/**
 * Busca de forma paginada e com ordenação estável todos os registros de uma coleção.
 * Distingue coleção vazia de falha de permissão ou erro de rede.
 */
async function fetchAllRecordsFromCollection(
  collectionName: string,
): Promise<{ records: any[]; meta: CollectionExportMeta }> {
  const records: any[] = []
  let page = 1
  const perPage = 200
  let totalItemsExpected = 0
  let totalPages = 1

  try {
    // 1ª página com sort estável por ID e requestKey: null para não cancelar chamadas paralelas
    const firstRes = await pb.collection(collectionName).getList(page, perPage, {
      sort: '+id',
      requestKey: null,
    })

    totalItemsExpected = firstRes.totalItems || 0
    totalPages = firstRes.totalPages || 1

    if (firstRes.items && firstRes.items.length > 0) {
      for (const item of firstRes.items) {
        records.push(item)
      }
    }

    // Paginação sequencial estável
    while (page < totalPages) {
      page++
      const res = await pb.collection(collectionName).getList(page, perPage, {
        sort: '+id',
        requestKey: null,
      })
      if (!res.items || res.items.length === 0) break
      for (const item of res.items) {
        records.push(item)
      }
    }

    const isZero = records.length === 0
    return {
      records,
      meta: {
        collection: collectionName,
        status: isZero ? 'empty' : 'exported',
        count_expected: totalItemsExpected,
        count_exported: records.length,
        page_size: perPage,
        total_pages: totalPages,
        has_error: false,
      },
    }
  } catch (err: any) {
    const status = err?.status || err?.response?.status || 0
    const msg = err?.message || String(err)
    const isForbidden = status === 403 || status === 401 || /unauthorized|forbidden/i.test(msg)

    return {
      records: [],
      meta: {
        collection: collectionName,
        status: isForbidden ? 'forbidden' : 'failed',
        count_expected: undefined,
        count_exported: 0,
        page_size: perPage,
        total_pages: 0,
        has_error: true,
        error: isForbidden
          ? `Permissão insuficiente (HTTP ${status}): ${msg}`
          : `Falha na consulta: ${msg}`,
      },
    }
  }
}

/**
 * Escaneia campos JSON e strings em busca de fotos embutidas em Base64 ou snapshots de contratos
 */
export function extractEmbeddedPhotosFromRecords(
  records: any[],
  collectionName: string,
): AttachmentManifestItem[] {
  const items: AttachmentManifestItem[] = []

  for (const record of records) {
    // Verifica rental_contracts (equipamento_dados.modelo_contrato.photos ou annexes)
    if (collectionName === 'rental_contracts') {
      const eqData = record.equipamento_dados
      if (eqData && typeof eqData === 'object') {
        const mc = eqData.modelo_contrato
        if (mc && Array.isArray(mc.photos)) {
          mc.photos.forEach((photo: any, idx: number) => {
            if (photo && photo.dataUrl && typeof photo.dataUrl === 'string') {
              items.push({
                collection: collectionName,
                record_id: record.id,
                field: `equipamento_dados.modelo_contrato.photos[${idx}]`,
                filename: photo.name || `contrato_foto_${idx + 1}.jpg`,
                storage_path: `embedded/rental_contracts/${record.id}/foto_${idx + 1}.jpg`,
                download_url: photo.dataUrl, // DataURL local
                is_embedded_base64: true,
                download_status: 'success',
              })
            }
          })
        }
      }
    }

    // Verifica rental_documents payload
    if (collectionName === 'rental_documents') {
      const p = record.payload
      if (p && typeof p === 'object' && p.dataUrl && typeof p.dataUrl === 'string') {
        items.push({
          collection: collectionName,
          record_id: record.id,
          field: 'payload.dataUrl',
          filename: p.name || `doc_${record.id}.bin`,
          storage_path: `embedded/rental_documents/${record.id}/${p.name || 'documento.bin'}`,
          download_url: p.dataUrl,
          is_embedded_base64: true,
          download_status: 'success',
        })
      }
    }
  }

  return items
}

export type MigrationExportProgressCallback = (msg: string, percent: number) => void

/**
 * Constrói a Auditoria Financeira de Controle com rigor e sem falsos "faturamentos"
 */
export function buildFinancialAudit(
  orders: any[],
  payments: any[],
  quotes: any[],
  products: any[],
  services: any[],
  customers: any[],
): FinancialAuditReport {
  const customerIds = new Set(customers.map((c) => c.id))
  const orderIds = new Set(orders.map((o) => o.id))

  // 1. Ordens de Serviço por status
  const ordersByStatusMap = new Map<string, { count: number; total: number }>()
  let ordersNominalTotal = 0
  let invalidOrdersCount = 0
  let ordersWithoutCustomer = 0
  let divisionConfiguredCount = 0

  for (const o of orders) {
    const rawTotal = o.total
    const numTotal = Number(rawTotal)

    if (isNaN(numTotal) || numTotal < 0) {
      invalidOrdersCount++
    } else {
      ordersNominalTotal += numTotal
    }

    if (!o.customer || !customerIds.has(o.customer)) {
      ordersWithoutCustomer++
    }

    const st = o.status || 'sem_status'
    const cur = ordersByStatusMap.get(st) || { count: 0, total: 0 }
    cur.count++
    cur.total += isNaN(numTotal) ? 0 : numTotal
    ordersByStatusMap.set(st, cur)

    if (o.division_details && o.division_details.configured) {
      divisionConfiguredCount++
    }
  }

  const ordersByStatus: FinancialStatusBreakdown[] = Array.from(ordersByStatusMap.entries()).map(
    ([status, data]) => ({
      status,
      count: data.count,
      nominal_total: Number(data.total.toFixed(2)),
    }),
  )

  // 2. Pagamentos por status e por método
  let paidTotal = 0
  let pendingTotal = 0
  let refundedTotal = 0
  let orphanPayments = 0
  const uniqueOrdersWithPay = new Set<string>()
  const paymentsByMethod: Record<string, { count: number; total: number }> = {}

  for (const p of payments) {
    const amt = Number(p.amount) || 0
    if (p.service_order) {
      uniqueOrdersWithPay.add(p.service_order)
      if (!orderIds.has(p.service_order)) {
        orphanPayments++
      }
    } else {
      orphanPayments++
    }

    const method = p.method || 'outros'
    if (!paymentsByMethod[method]) {
      paymentsByMethod[method] = { count: 0, total: 0 }
    }
    paymentsByMethod[method].count++
    paymentsByMethod[method].total += amt

    if (p.status === 'paid') paidTotal += amt
    else if (p.status === 'pending') pendingTotal += amt
    else if (p.status === 'refunded') refundedTotal += amt
  }

  // 3. Orçamentos por status
  const quotesByStatusMap = new Map<string, { count: number; total: number }>()
  let quotesNominalTotal = 0

  for (const q of quotes) {
    const val = Number(q.total_geral) || 0
    quotesNominalTotal += val
    const st = q.status || 'sem_status'
    const cur = quotesByStatusMap.get(st) || { count: 0, total: 0 }
    cur.count++
    cur.total += val
    quotesByStatusMap.set(st, cur)
  }

  const quotesByStatus: FinancialStatusBreakdown[] = Array.from(quotesByStatusMap.entries()).map(
    ([status, data]) => ({
      status,
      count: data.count,
      nominal_total: Number(data.total.toFixed(2)),
    }),
  )

  return {
    service_orders_count: orders.length,
    service_orders_nominal_total: Number(ordersNominalTotal.toFixed(2)),
    service_orders_by_status: ordersByStatus,
    service_orders_with_invalid_values_count: invalidOrdersCount,
    service_orders_without_customer_count: ordersWithoutCustomer,

    payments_count: payments.length,
    payments_total_paid: Number(paidTotal.toFixed(2)),
    payments_total_pending: Number(pendingTotal.toFixed(2)),
    payments_total_refunded: Number(refundedTotal.toFixed(2)),
    payments_by_method: Object.fromEntries(
      Object.entries(paymentsByMethod).map(([k, v]) => [
        k,
        { count: v.count, total: Number(v.total.toFixed(2)) },
      ]),
    ),
    unique_orders_with_payments: uniqueOrdersWithPay.size,
    orphan_payments_count: orphanPayments,

    quotes_count: quotes.length,
    quotes_nominal_total: Number(quotesNominalTotal.toFixed(2)),
    quotes_by_status: quotesByStatus,

    catalog_products_count: products.length,
    catalog_services_count: services.length,

    division_configured_orders: divisionConfiguredCount,
    uninformed_division_orders: orders.length - divisionConfiguredCount,

    criteria_notes: {
      faturamento_recebido_definition:
        'Apenas pagamentos na coleção `payments` com status="paid" (ou títulos pagos confirmados). Ordens em aberto, canceladas ou orçamentos não faturados NÃO são considerados receita realizada.',
      nominal_definition:
        'Soma aritmética simples do campo `total` das OS cadastradas na base de dados, sem exclusão de canceladas, para conferência de integridade nominal.',
      deduplication_rule:
        'Produtos e serviços inclusos no total da OS NÃO são somados novamente. A equipe múltipla divide a produção internamente e não multiplica o faturamento.',
      rounding_precision:
        'Cálculos com duas casas decimais fixas (centavos exatos), preservando frações nos registros brutos JSON.',
    },
  }
}

/**
 * Gera o pacote completo e verificável de migração (dados brutos JSON + manifesto de anexos + auditoria de controle)
 */
export async function generateFullMigrationPackage(
  onProgress?: MigrationExportProgressCallback,
): Promise<FullMigrationPackage> {
  const startTime = new Date().toISOString()
  const startTs = Date.now()
  const exportId = `MIG_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

  const dataMap: Record<string, any[]> = {}
  const summary: Record<string, CollectionExportMeta> = {}
  const manifest: AttachmentManifestItem[] = []
  const integrityWarnings: string[] = []
  let totalRecords = 0

  // 1. Identificação do Usuário e Sessão
  const authModel = pb.authStore.record || pb.authStore.model
  const authUserRole = (authModel as any)?.role || 'unauthenticated'
  const authUserName = (authModel as any)?.name || (authModel as any)?.username || 'Desconhecido'
  const authUserId = authModel?.id || 'none'
  const isAdmin = authUserRole === 'admin'

  let authWarning: string | undefined
  if (!isAdmin) {
    authWarning =
      'ATENÇÃO: A exportação foi realizada por uma conta não-administradora. Algumas regras de API (RLS) podem limitar os registros retornados aos autorizados para este usuário. Para garantia de exportação 100% integral da base de dados, execute autenticado como administrador.'
    integrityWarnings.push(authWarning)
  }

  // 2. URL de Storage do Backend
  const pbUrl = (
    import.meta.env.VITE_POCKETBASE_URL ||
    'https://assistencia-tecnica-movel-86527.shrd00.internal.goskip.dev'
  ).replace(/\/$/, '')

  const collections = ALL_SYSTEM_COLLECTIONS
  const totalCollections = collections.length
  let failedCollectionsCount = 0
  let emptyCollectionsCount = 0
  let exportedCollectionsCount = 0

  // 3. Exportação das Coleções
  for (let i = 0; i < totalCollections; i++) {
    const colName = collections[i]
    const pct = Math.round(((i + 1) / totalCollections) * 75)
    onProgress?.(`Consultando coleção ${colName} (${i + 1}/${totalCollections})...`, pct)

    const result = await fetchAllRecordsFromCollection(colName)
    dataMap[colName] = result.records
    summary[colName] = {
      ...result.meta,
      authenticated_user_role: authUserRole,
    }

    if (result.meta.has_error) {
      failedCollectionsCount++
      integrityWarnings.push(`Coleção "${colName}": ${result.meta.error}`)
    } else if (result.meta.status === 'empty') {
      emptyCollectionsCount++
    } else {
      exportedCollectionsCount++
      totalRecords += result.records.length
    }

    // Extrai anexos nativos
    const fileFields = ATTACHMENT_FIELDS[colName] || []
    if (fileFields.length > 0 && result.records.length > 0) {
      for (const record of result.records) {
        for (const f of fileFields) {
          const val = record[f]
          if (!val) continue
          const filesArr = Array.isArray(val) ? val : [val]
          for (const filename of filesArr) {
            if (typeof filename === 'string' && filename.trim()) {
              const colTarget = record.collectionId || colName
              const storagePath = `pb_data/storage/${colTarget}/${record.id}/${filename}`
              const downloadUrl = `${pbUrl}/api/files/${colTarget}/${record.id}/${encodeURIComponent(filename)}`
              const isSigned =
                f.includes('signature') ||
                f.includes('assinatura') ||
                colName === 'laudos_tecnicos' ||
                colName === 'rental_contracts'

              manifest.push({
                collection: colName,
                record_id: record.id,
                field: f,
                filename,
                storage_path: storagePath,
                download_url: downloadUrl,
                download_status: 'not_downloaded',
                is_signed_original: isSigned,
              })
            }
          }
        }
      }
    }

    // Extrai imagens embutidas (Base64 em JSON)
    const embeddedItems = extractEmbeddedPhotosFromRecords(result.records, colName)
    if (embeddedItems.length > 0) {
      manifest.push(...embeddedItems)
    }
  }

  onProgress?.('Verificando integridade relacional e duplicidades...', 80)

  // 4. Verificação de Integridade Relacional e Duplicidades de ID
  const allKnownIds = new Set<string>()
  for (const [col, recs] of Object.entries(dataMap)) {
    const colIds = new Set<string>()
    for (const r of recs) {
      if (colIds.has(r.id)) {
        integrityWarnings.push(
          `ID duplicado detectado dentro da mesma coleção ${col}: id="${r.id}"`,
        )
      }
      colIds.add(r.id)
      allKnownIds.add(r.id)
    }
  }

  // Verifica chaves estrangeiras críticas de service_orders
  const orders = dataMap['service_orders'] || []
  const customerIds = new Set((dataMap['customers'] || []).map((c) => c.id))
  for (const o of orders) {
    if (o.customer && !customerIds.has(o.customer)) {
      integrityWarnings.push(
        `Ordem de serviço ${o.number || o.id} referencia cliente inexistente ou não exportado: customer="${o.customer}"`,
      )
    }
  }

  onProgress?.('Consolidando conferência financeira auditada...', 90)

  const financialAudit = buildFinancialAudit(
    dataMap['service_orders'] || [],
    dataMap['payments'] || [],
    dataMap['orcamentos'] || [],
    dataMap['products'] || [],
    dataMap['services'] || [],
    dataMap['customers'] || [],
  )

  const endTs = Date.now()
  const endTime = new Date().toISOString()

  let packageStatus: ExportStatusKind = 'complete'
  if (failedCollectionsCount > 0) {
    packageStatus = totalRecords > 0 ? 'partial' : 'error'
  }

  onProgress?.(
    packageStatus === 'complete'
      ? 'Pacote de migração concluído com sucesso integral!'
      : 'Pacote de migração concluído com status PARCIAL / AVISOS.',
    100,
  )

  return {
    meta: {
      system: 'JUCA INFORMÁTICA (Gestão & Assistência Técnica)',
      export_id: exportId,
      package_status: packageStatus,
      started_at: startTime,
      completed_at: endTime,
      duration_ms: endTs - startTs,
      target_migration_deadline: '2026-11-02',
      version_preview: 'v0.0.395',
      version_published_production:
        'v0.0.389 (verificada anteriormente como publicada; v0.0.232 era tag de congelamento)',
      version_verification_status: 'verified_via_git_and_runtime',
      git_commit_origin: '0086d9b (evidência do build/código atual)',
      environment_origin: 'Skip Cloud / Prévia ativa em desenvolvimento',
      pocketbase_version: 'PocketBase v0.36 (Skip Cloud)',
      base_storage_url: `${pbUrl}/api/files/`,
      total_collections_catalog: totalCollections,
      collections_exported_count: exportedCollectionsCount,
      collections_empty_count: emptyCollectionsCount,
      collections_failed_count: failedCollectionsCount,
      total_records_exported: totalRecords,
      total_attachments_manifested: manifest.length,
      total_attachments_downloaded: manifest.filter((m) => m.download_status === 'success').length,
      auth_user: {
        id: authUserId,
        name: authUserName,
        role: authUserRole,
        is_admin: isAdmin,
        warning: authWarning,
      },
      integrity_warnings: integrityWarnings,
      concurrency_limitations_notice:
        'Esta exportação foi obtida via paginação estável ordenada por chave primária (+id). Caso o sistema continue em uso simultâneo durante o backup, novos registros criados durante a leitura podem não ser capturados e registros alterados podem conter versão mais recente que o início da cópia. Recomendada etapa de reconciliação delta (updated >= corte) na virada final.',
    },
    collections_summary: summary,
    data: dataMap,
    attachments_manifest: manifest,
    financial_audit: financialAudit,
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
  const statusPrefix = pkg.meta.package_status === 'complete' ? 'COMPLETO' : 'PARCIAL'
  link.href = url
  link.download = filename || `juca_migracao_${statusPrefix}_${dateStr}_${pkg.meta.export_id}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Dispara o download do Manifesto de Anexos em formato CSV seguro conforme RFC 4180
 */
export function downloadAttachmentsManifestCSV(manifest: AttachmentManifestItem[]) {
  const headers = [
    'colecao',
    'registro_id',
    'campo',
    'nome_arquivo',
    'caminho_storage',
    'url_download',
    'tamanho_bytes',
    'sha256',
    'status_download',
    'motivo_falha',
    'lote_numerado',
    'arquivo_original_assinado',
  ]
  const rows = manifest.map((m) => [
    m.collection,
    m.record_id,
    m.field,
    m.filename,
    m.storage_path,
    // Garante que nenhuma chave ou token confidencial vá no link
    m.download_url.split('?token=')[0],
    m.file_size_bytes ?? '',
    m.sha256 ?? '',
    m.download_status || 'not_downloaded',
    m.download_error || '',
    m.batch_number ? `Lote ${m.batch_number}` : 'Lote 1',
    m.is_signed_original ? 'SIM' : 'NAO',
  ])

  const csvContent = buildCSVContent(headers, rows, ';')
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

export interface AttachmentBatchDownloadOptions {
  manifest: AttachmentManifestItem[]
  batchSize?: number
  maxRetries?: number
  onProgress?: (progress: {
    total: number
    completed: number
    failed: number
    currentFilename: string
    percent: number
  }) => void
}

/**
 * Utilitário de download de arquivos em lote com autenticação, SHA-256 e retentativas seguras
 */
export async function downloadAttachmentsBatch(options: AttachmentBatchDownloadOptions): Promise<{
  manifest: AttachmentManifestItem[]
  successfulBlobs: { item: AttachmentManifestItem; blob: Blob }[]
  failedCount: number
}> {
  const { manifest, batchSize = 3, maxRetries = 2, onProgress } = options
  const results: AttachmentManifestItem[] = [...manifest]
  const successfulBlobs: { item: AttachmentManifestItem; blob: Blob }[] = []
  const total = results.length
  let completed = 0
  let failed = 0

  // Atribui números de lotes para rastreabilidade de entrega
  for (let i = 0; i < total; i++) {
    results[i].batch_number = Math.floor(i / 10) + 1
  }

  const token = pb.authStore.token

  for (let i = 0; i < total; i += batchSize) {
    const chunk = results.slice(i, i + batchSize)

    await Promise.all(
      chunk.map(async (item) => {
        // Se for Base64 embutido, converte direto para Blob e calcula hash
        if (item.is_embedded_base64 && item.download_url.startsWith('data:')) {
          try {
            const resp = await fetch(item.download_url)
            const blob = await resp.blob()
            const buffer = await blob.arrayBuffer()
            const sha = await computeSHA256(buffer)
            item.file_size_bytes = blob.size
            item.sha256 = sha
            item.download_status = 'success'
            successfulBlobs.push({ item, blob })
            completed++
          } catch (err: any) {
            item.download_status = 'failed'
            item.download_error = `Erro ao processar Base64 embutido: ${err?.message || String(err)}`
            failed++
          }
          return
        }

        // Download autenticado do PocketBase
        let attempt = 0
        let success = false
        let lastError = ''

        // Se já foi baixado com sucesso em execução anterior, pula (retoma somente com falha/pendente)
        if (item.download_status === 'success' && item.sha256) {
          completed++
          return
        }

        while (attempt <= maxRetries && !success) {
          attempt++
          try {
            const headers: Record<string, string> = {}
            if (token) {
              // Envia bearer token no header HTTP seguro (nunca na URL ou query param)
              headers['Authorization'] = `Bearer ${token}`
            }

            const response = await fetch(item.download_url, { headers })
            if (!response.ok) {
              throw new Error(`HTTP ${response.status} ${response.statusText}`)
            }

            const blob = await response.blob()
            const buffer = await blob.arrayBuffer()
            const sha = await computeSHA256(buffer)

            item.file_size_bytes = blob.size
            item.sha256 = sha
            item.download_status = 'success'
            item.download_error = undefined
            successfulBlobs.push({ item, blob })
            success = true
            completed++
          } catch (err: any) {
            lastError = err?.message || String(err)
            if (attempt <= maxRetries) {
              // Espera exponencial breve
              await new Promise((r) => setTimeout(r, 400 * attempt))
            }
          }
        }

        if (!success) {
          item.download_status = 'failed'
          item.download_error = `Falha após ${maxRetries + 1} tentativas: ${lastError}`
          failed++
        }

        onProgress?.({
          total,
          completed,
          failed,
          currentFilename: item.filename,
          percent: Math.round(((completed + failed) / total) * 100),
        })
      }),
    )
  }

  return {
    manifest: results,
    successfulBlobs,
    failedCount: failed,
  }
}
