// Trigger manual para importar os produtos do CSV agora (em vez de
// esperar o cron). O $http só funciona em hooks, não em migrações —
// por isso a importação real dos produtos acontece aqui.
//
// GET /backend/v1/import_products_now
routerAdd('GET', '/backend/v1/import_products_now', (e) => {
  var currentCount = $app.countRecords('products')
  if (currentCount >= 2600) {
    return e.json(200, { skipped: true, reason: 'already imported', count: currentCount })
  }

  var url =
    'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/819ad1b5-1865-4f2e-9fe9-f488ce98c0b0/produtos18082026-53d74.csv'
  var res = $http.send({ url: url, method: 'GET', timeout: 120 })

  if (res.statusCode !== 200) {
    return e.json(200, { error: 'fetch failed', statusCode: res.statusCode })
  }

  var raw = typeof res.raw === 'string' ? res.raw : ''
  if (!raw) {
    return e.json(200, { error: 'empty body' })
  }

  var text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.substring(1)
  }

  // ---- Parser CSV (quoted fields with embedded commas/newlines) ----
  var rows = []
  var row = []
  var field = ''
  var inQuotes = false
  var i = 0
  while (i < text.length) {
    var ch = text.charAt(i)
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text.charAt(i + 1) === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        field += ch
        i++
      }
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
      } else if (ch === ',') {
        row.push(field)
        field = ''
        i++
      } else if (ch === '\n') {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
        i++
      } else {
        field += ch
        i++
      }
    }
  }
  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  var toNumber = function (v) {
    if (!v) return 0
    var s = String(v).trim().replace(/\./g, '').replace(',', '.')
    var n = parseFloat(s)
    return isNaN(n) ? 0 : n
  }

  var clean = function (p) {
    return (p || '').trim()
  }

  var extractSku = function (name) {
    if (!name) return ''
    var m = name.match(/^\s*(\d+)\s*[-–]/)
    return m && m.length > 1 ? m[1] : ''
  }

  var col = $app.findCollectionByNameOrId('products')
  $app.truncateCollection(col)

  var count = 0
  var total = 0
  var errors = 0
  var errorSamples = []

  for (var r = 2; r < rows.length; r++) {
    var parts = rows[r]
    if (!parts || parts.length < 8) continue

    var name = clean(parts[0])
    if (!name) continue
    var nameLower = name.toLowerCase()
    if (nameLower === 'nome' || nameLower === 'nome do produto') continue

    total++

    var description = clean(parts[1])
    var stock = toNumber(parts[2])
    var category = clean(parts[6])
    var statusStr = clean(parts[7])
    var cost = toNumber(parts[8])
    var price = toNumber(parts[9])

    var sku = extractSku(name)
    if (!sku) {
      sku = 'GEN-' + r
    }
    var active = statusStr.toLowerCase() === 'ativo'

    var record = new Record(col)
    record.set('name', name)
    record.set('description', description)
    record.set('sku', sku)
    record.set('price', price)
    record.set('stock_quantity', stock)
    record.set('cost', cost)
    record.set('category', category)
    record.set('photo', '')
    record.set('active', active)

    try {
      $app.save(record)
      count++
    } catch (err) {
      errors++
      if (errorSamples.length < 5) {
        errorSamples.push({ name: name, err: String(err) })
      }
    }
  }

  console.log('✅ Produtos importados: ' + count + ' de ' + total + ' (erros: ' + errors + ')')

  return e.json(200, {
    rowsParsed: rows.length,
    total: total,
    imported: count,
    errors: errors,
    errorSamples: errorSamples,
  })
})
