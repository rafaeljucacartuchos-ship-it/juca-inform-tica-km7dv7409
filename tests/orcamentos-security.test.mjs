import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const names = ['orcamentos', 'orcamento_itens', 'orcamento_anexos']
const rules = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']
const authenticated = "@request.auth.id != ''"

function migration() {
  let callbacks
  vm.runInNewContext(read('pocketbase/migrations/0096_require_auth_for_orcamentos.js'), {
    migrate: (up, down) => { callbacks = { up, down } },
  })
  return callbacks
}

function collections() {
  const records = names.map((name) => ({ name, ...Object.fromEntries(rules.map((r) => [r, ''])) }))
  const saved = []
  return {
    records,
    saved,
    app: {
      findCollectionByNameOrId: (name) => records.find((c) => c.name === name),
      save: (collection) => saved.push(collection.name),
    },
  }
}

test('migration closes all 15 public records API rules', () => {
  const fixture = collections()
  migration().up(fixture.app)
  assert.deepEqual(fixture.saved, names)
  for (const collection of fixture.records) {
    for (const rule of rules) assert.equal(collection[rule], authenticated)
  }
})

test('migration preserves locked and custom rules and is idempotent', () => {
  const fixture = collections()
  fixture.records[0].deleteRule = null
  fixture.records[1].updateRule = "@request.auth.role = 'admin'"
  const { up } = migration()
  up(fixture.app)
  assert.equal(fixture.records[0].deleteRule, null)
  assert.equal(fixture.records[1].updateRule, "@request.auth.role = 'admin'")
  fixture.saved.length = 0
  up(fixture.app)
  assert.deepEqual(fixture.saved, [])
})

test('save failures propagate to the PocketBase migration transaction', () => {
  const fixture = collections()
  fixture.app.save = () => { throw new Error('disk failure') }
  assert.throws(() => migration().up(fixture.app), /disk failure/)
})

test('rollback cannot silently reopen anonymous access', () => {
  assert.throws(() => migration().down(), /cannot be reverted/)
})

test('checked-in schema agrees with the migration', () => {
  const schema = JSON.parse(read('src/lib/pocketbase/schema.json'))
  for (const name of names) {
    const collection = schema.collections.find((c) => c.name === name)
    assert.ok(collection, name)
    for (const rule of rules) assert.equal(collection.apiRules[rule.replace('Rule', '')], authenticated)
  }
})

// Execute the actual hooks with an in-memory data adapter. This checks route
// behavior, not PocketBase's native rule parser or HTTP/file serving layer.
function record(id, fields = {}, collectionId = 'orcamentos') {
  const values = { ...fields }
  return {
    id,
    getString: (key) => String(values[key] ?? ''),
    getInt: (key) => Math.trunc(Number(values[key]) || 0),
    getFloat: (key) => Number(values[key]) || 0,
    set: (key, value) => { values[key] = value },
    collection: () => ({ id: collectionId }),
  }
}

function proposalRoute(file, overrides = {}) {
  const token = 'valid-private-proposal-token'
  const quote = record('quote-a', {
    token_acesso: token,
    numero_orcamento: 'ORC-0001',
    status: 'enviado',
    created: new Date().toISOString().slice(0, 19).replace('T', ' '),
    validade: 15,
    assinatura_cliente: 'signature.png',
    ...overrides,
  })
  const saved = []
  const lookups = []
  let handler
  vm.runInNewContext(read('pocketbase/hooks/' + file), {
    routerAdd: (_method, _path, callback, ...middleware) => {
      assert.equal(middleware.length, 0, 'public token route must not require a login')
      handler = callback
    },
    $app: {
      findFirstRecordByData: (collection, field, value) => {
        lookups.push({ collection, field, value })
        assert.equal(collection, 'orcamentos')
        assert.equal(field, 'token_acesso')
        if (value !== token) throw new Error('not found')
        return quote
      },
      findRecordsByFilter: (collection, filter) => {
        if (collection === 'orcamento_itens' || collection === 'orcamento_anexos') {
          assert.equal(filter, 'id_orcamento = "quote-a"')
          return collection === 'orcamento_itens'
            ? [record('item-a', { descricao: 'Reparo', quantidade: 1, valor_total_item: 50 })]
            : [record('attachment-a', { caminho_arquivo: 'photo.jpg' }, collection)]
        }
        return []
      },
      findCollectionByNameOrId: () => { throw new Error('optional notifications unavailable') },
      save: (value) => saved.push(value.id),
    },
  })
  return {
    token, quote, saved, lookups,
    call: (requestToken, body = {}) => handler({
      auth: null,
      request: { pathValue: () => requestToken, header: { get: () => '' } },
      requestInfo: () => ({ body }),
      realIP: () => '127.0.0.1',
      json: (status, data) => ({ status, data }),
    }),
  }
}

for (const file of ['proposta_get.js', 'proposta_aprovar.js']) {
  test(file + ': missing/short tokens fail before database access', () => {
    const route = proposalRoute(file)
    for (const token of ['', 'short']) assert.equal(route.call(token).status, 400)
    assert.equal(route.lookups.length, 0)
    assert.equal(route.saved.length, 0)
  })

  test(file + ': unknown tokens cannot read or change a proposal', () => {
    const route = proposalRoute(file)
    assert.equal(route.call('another-private-token').status, 404)
    assert.equal(route.saved.length, 0)
    assert.equal(route.quote.getString('status'), 'enviado')
  })
}

test('valid public token returns proposal, scoped items and attachment URLs without login', () => {
  const route = proposalRoute('proposta_get.js')
  const result = route.call(route.token)
  assert.equal(result.status, 200)
  assert.equal(result.data.id, 'quote-a')
  assert.equal(result.data.items[0].id, 'item-a')
  assert.equal(result.data.anexos[0].url, '/api/files/orcamento_anexos/attachment-a/photo.jpg')
  assert.equal(result.data.assinatura_cliente_url, '/api/files/orcamentos/quote-a/signature.png')
  assert.equal(route.saved.length, 0)
})

test('valid public token approves a signed proposal and repeated approval does not write twice', () => {
  const route = proposalRoute('proposta_aprovar.js')
  assert.equal(route.call(route.token).status, 200)
  assert.equal(route.quote.getString('status'), 'aprovado')
  assert.deepEqual(route.saved, ['quote-a'])
  assert.equal(route.call(route.token).data.alreadyApproved, true)
  assert.deepEqual(route.saved, ['quote-a'])
})

test('unsigned, rejected, replaced and expired proposals cannot be approved', () => {
  for (const overrides of [
    { assinatura_cliente: '' },
    { status: 'rejeitado' },
    { status: 'substituido' },
    { created: '2000-01-01 00:00:00' },
  ]) {
    const route = proposalRoute('proposta_aprovar.js', overrides)
    assert.equal(route.call(route.token).status, 400)
    assert.equal(route.saved.length, 0)
  }
})
