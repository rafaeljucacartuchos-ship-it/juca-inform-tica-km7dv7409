import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseJucaOrderQr, sanitizeInternalRedirect } from '../src/lib/qr-order-utils.ts'

test('parseJucaOrderQr - accepts direct 15-char PocketBase ID', () => {
  const result = parseJucaOrderQr('k9f8d7s6a5q4w3e')
  assert.equal(result.valid, true)
  assert.equal(result.orderId, 'k9f8d7s6a5q4w3e')
  assert.equal(result.targetPath, '/ordens/k9f8d7s6a5q4w3e')
})

test('parseJucaOrderQr - accepts relative URL /ordens/:id', () => {
  const result = parseJucaOrderQr('/ordens/k9f8d7s6a5q4w3e')
  assert.equal(result.valid, true)
  assert.equal(result.orderId, 'k9f8d7s6a5q4w3e')
  assert.equal(result.targetPath, '/ordens/k9f8d7s6a5q4w3e')
})

test('parseJucaOrderQr - rejects external domain when full URL is passed with another host', () => {
  const result = parseJucaOrderQr('https://phishing-site.com/ordens/k9f8d7s6a5q4w3e')
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'invalid_domain')
})

test('parseJucaOrderQr - rejects empty or non-OS path', () => {
  const empty = parseJucaOrderQr('')
  assert.equal(empty.valid, false)

  const products = parseJucaOrderQr('/produtos/123456789012345')
  assert.equal(products.valid, false)
  assert.equal(products.reason, 'invalid_path')
})

test('sanitizeInternalRedirect - prevents open redirect attacks', () => {
  assert.equal(sanitizeInternalRedirect('https://malicious.com'), '/ordens')
  assert.equal(sanitizeInternalRedirect('//evil.com'), '/ordens')
  assert.equal(sanitizeInternalRedirect('javascript:alert(1)'), '/ordens')
  assert.equal(sanitizeInternalRedirect('/ordens/k9f8d7s6a5q4w3e'), '/ordens/k9f8d7s6a5q4w3e')
})
