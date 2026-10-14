import assert from 'node:assert/strict'
import { test } from 'node:test'
import { escapeCSVCell, buildCSVRow, buildCSVContent } from '../src/lib/csv-helper.ts'
import {
  ALL_SYSTEM_COLLECTIONS,
  ATTACHMENT_FIELDS,
  buildFinancialAudit,
  extractEmbeddedPhotosFromRecords,
} from '../src/services/migration-export.ts'

test('csv helper escapes quotes, semicolons and newlines properly (RFC 4180)', () => {
  assert.equal(escapeCSVCell('hello'), '"hello"')
  assert.equal(escapeCSVCell('quote "test" here'), '"quote ""test"" here"')
  assert.equal(escapeCSVCell('line 1\nline 2'), '"line 1\nline 2"')
  assert.equal(escapeCSVCell('semi;colon'), '"semi;colon"')
  assert.equal(escapeCSVCell(null), '""')
  assert.equal(escapeCSVCell(undefined), '""')

  const row = buildCSVRow(['a', 'b "c"', 123], ';')
  assert.equal(row, '"a";"b ""c""";"123"')

  const csv = buildCSVContent(['col1', 'col2'], [['val1', 'val2\nwith newline']], ';')
  assert.ok(csv.startsWith('\uFEFF'), 'Debe conter UTF-8 BOM')
  assert.ok(csv.includes('"col1";"col2"'))
  assert.ok(csv.includes('"val1";"val2\nwith newline"'))
})

test('all 38 system collections are enumerated', () => {
  assert.equal(ALL_SYSTEM_COLLECTIONS.length, 38)
  assert.ok(ALL_SYSTEM_COLLECTIONS.includes('quick_accounts'))
  assert.ok(ALL_SYSTEM_COLLECTIONS.includes('service_orders'))
  assert.ok(ALL_SYSTEM_COLLECTIONS.includes('rental_contracts'))
  assert.ok(ALL_SYSTEM_COLLECTIONS.includes('order_division_history'))
})

test('attachment fields coverage matches schema', () => {
  assert.deepEqual(ATTACHMENT_FIELDS['service_orders'], ['customer_signature', 'technician_signature'])
  assert.deepEqual(ATTACHMENT_FIELDS['service_attachments'], ['file'])
  assert.deepEqual(ATTACHMENT_FIELDS['orcamentos'], ['assinatura_cliente', 'assinatura_tecnico'])
  assert.deepEqual(ATTACHMENT_FIELDS['orcamento_anexos'], ['caminho_arquivo'])
  assert.deepEqual(ATTACHMENT_FIELDS['laudos_tecnicos'], ['assinatura_tecnico', 'assinatura_cliente'])
  assert.deepEqual(ATTACHMENT_FIELDS['equipment'], ['photos'])
  assert.deepEqual(ATTACHMENT_FIELDS['products'], ['photo_file'])
})

test('extractEmbeddedPhotosFromRecords extracts Base64 photos from rental_contracts snapshots', () => {
  const records = [
    {
      id: 'contract-1',
      equipamento_dados: {
        modelo_contrato: {
          photos: [
            {
              id: 'p1',
              name: 'vistoria.jpg',
              dataUrl: 'data:image/jpeg;base64,123456',
            },
          ],
        },
      },
    },
    {
      id: 'contract-2',
      equipamento_dados: {},
    },
  ]

  const items = extractEmbeddedPhotosFromRecords(records, 'rental_contracts')
  assert.equal(items.length, 1)
  assert.equal(items[0].record_id, 'contract-1')
  assert.equal(items[0].filename, 'vistoria.jpg')
  assert.equal(items[0].is_embedded_base64, true)
})

test('buildFinancialAudit separates nominal OS totals from real received payments and audits statuses', () => {
  const fakeCustomers = [{ id: 'cust-1' }, { id: 'cust-2' }]
  const fakeOrders = [
    { id: 'os-1', customer: 'cust-1', total: 100, status: 'completed' },
    { id: 'os-2', customer: 'cust-2', total: 200, status: 'open' },
    { id: 'os-3', customer: 'cust-unknown', total: 50, status: 'cancelled' },
    { id: 'os-4', customer: 'cust-1', total: 'invalid', status: 'completed' },
  ]
  const fakePayments = [
    { id: 'pay-1', service_order: 'os-1', amount: 100, status: 'paid', method: 'pix' },
    { id: 'pay-2', service_order: 'os-2', amount: 50, status: 'pending', method: 'credit_card' },
    { id: 'pay-3', service_order: 'os-nonexistent', amount: 30, status: 'paid', method: 'cash' },
    { id: 'pay-4', service_order: null, amount: 20, status: 'refunded', method: 'pix' },
  ]
  const fakeQuotes = [
    { id: 'q-1', total_geral: 500, status: 'aprovado' },
    { id: 'q-2', total_geral: 300, status: 'rascunho' },
  ]
  const fakeProducts = [{ id: 'p-1' }, { id: 'p-2' }]
  const fakeServices = [{ id: 's-1' }]

  const audit = buildFinancialAudit(
    fakeOrders,
    fakePayments,
    fakeQuotes,
    fakeProducts,
    fakeServices,
    fakeCustomers,
  )

  // 1. Ordens de Serviço
  assert.equal(audit.service_orders_count, 4)
  assert.equal(audit.service_orders_nominal_total, 350) // 100 + 200 + 50 (ignora 'invalid')
  assert.equal(audit.service_orders_with_invalid_values_count, 1)
  assert.equal(audit.service_orders_without_customer_count, 1)

  // Conferência por status da OS
  const completedStatus = audit.service_orders_by_status.find((s) => s.status === 'completed')
  assert.equal(completedStatus?.count, 2)
  assert.equal(completedStatus?.nominal_total, 100)

  const openStatus = audit.service_orders_by_status.find((s) => s.status === 'open')
  assert.equal(openStatus?.count, 1)
  assert.equal(openStatus?.nominal_total, 200)

  // 2. Pagamentos
  assert.equal(audit.payments_count, 4)
  assert.equal(audit.payments_total_paid, 130) // pay-1 (100) + pay-3 (30)
  assert.equal(audit.payments_total_pending, 50)
  assert.equal(audit.payments_total_refunded, 20)
  assert.equal(audit.orphan_payments_count, 2) // pay-3 (os-nonexistent) e pay-4 (sem OS)
  assert.equal(audit.unique_orders_with_payments, 2) // os-1 e os-2

  // 3. Orçamentos
  assert.equal(audit.quotes_count, 2)
  assert.equal(audit.quotes_nominal_total, 800)

  // 4. Catálogos mantidos isolados (não somam em faturamento)
  assert.equal(audit.catalog_products_count, 2)
  assert.equal(audit.catalog_services_count, 1)

  // 5. Critérios explícitos
  assert.ok(audit.criteria_notes.faturamento_recebido_definition.includes('Apenas pagamentos'))
  assert.ok(audit.criteria_notes.deduplication_rule.includes('NÃO são somados'))
})
