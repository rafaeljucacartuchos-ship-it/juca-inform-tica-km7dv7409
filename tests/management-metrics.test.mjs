import { test } from 'node:test'
import assert from 'node:assert/strict'
import { managementMetrics, periodStart } from '../src/lib/management-metrics.ts'

const start = new Date('2026-09-01T00:00:00Z')
const end = new Date('2026-09-25T12:00:00Z')
test('empty data does not invent a conversion percentage', () => {
  const result = managementMetrics([], [], [], start, end)
  assert.equal(result.conversion, null)
  assert.equal(result.received, 0)
  assert.equal(result.activeOrders, 0)
})
test('current workload excludes completed, closed and cancelled orders, regardless of period', () => {
  const result = managementMetrics([
    { id: '1', status: 'waiting_parts', technician: 'tech1' },
    { id: '2', status: 'open' },
    { id: '3', status: 'completed', technician: 'tech1' },
    { id: '4', status: 'closed' },
    { id: '5', status: 'cancelled' },
  ], [], [], start, end)
  assert.equal(result.activeOrders, 2)
  assert.equal(result.waitingParts, 1)
  assert.equal(result.unassigned, 1)
  assert.deepEqual(result.workload, [['tech1', 1], ['', 1]])
})
test('conversion counts a creation cohort, excluding drafts, replaced and out-of-period proposals', () => {
  const result = managementMetrics([], [
    { id: 'a', status: 'aprovado', created: '2026-09-02 12:00:00.000Z' },
    { id: 'b', status: 'enviado', created: '2026-09-03T12:00:00Z' },
    { id: 'c', status: 'substituido', created: '2026-09-04T12:00:00Z' },
    { id: 'd', status: 'faturado', created: '2026-08-02T12:00:00Z' },
    { id: 'e', status: 'rascunho', created: '2026-09-04T12:00:00Z' },
    { id: 'f', status: 'aprovado', created: 'invalid' },
  ], [], start, end)
  assert.equal(result.quotes, 2)
  assert.equal(result.approved, 1)
  assert.equal(result.conversion, 50)
  assert.equal(result.received, 0)
})
test('receipts use paid_at and paid status, pending balances include all periods', () => {
  const result = managementMetrics([], [], [
    { id: 'a', status: 'paid', amount: 0.1, paid_at: '2026-09-01T00:00:00Z' },
    { id: 'b', status: 'paid', amount: 0.2, paid_at: '2026-09-25T12:00:00Z' },
    { id: 'c', status: 'pending', amount: 80 },
    { id: 'd', status: 'refunded', amount: 100, paid_at: '2026-09-20T12:00:00Z' },
    { id: 'e', status: 'paid', amount: 1000, paid_at: '2026-08-20T12:00:00Z' },
    { id: 'f', status: 'paid', amount: 500, paid_at: '2026-09-26T00:00:00Z' },
    { id: 'g', status: 'paid', amount: 500 },
    { id: 'h', status: 'pending', amount: NaN },
  ], start, end)
  assert.equal(result.received, 0.3)
  assert.equal(result.pending, 80)
})
test('period includes today and uses local calendar day boundaries', () => {
  const now = new Date(2026, 8, 25, 15)
  assert.equal(periodStart(1, now).getDate(), 25)
  assert.equal(periodStart(7, now).getDate(), 19)
  assert.equal(periodStart(7, now).getHours(), 0)
  assert.equal(now.getHours(), 15)
})
