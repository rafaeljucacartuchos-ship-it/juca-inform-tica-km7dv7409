// Importa os produtos do CSV produtos_18_08_2026-53d74.csv via cron job.
//
// MOTIVO: $http NÃO está disponível em migrações (é um global exclusivo
// de hooks). As migrações anteriores (0030-0037) usaram $http.send()
// dentro de migrate(), o que causa ReferenceError silencioso — a
// migração é marcada como "applied" mas nenhum dado é inserido.
//
// Este hook registra um cron job que roda a cada minuto, busca o CSV
// via $http.send (que FUNCIONA em hooks), faz o parse e importa os
// produtos. Quando a importação está completa (2600+ produtos), o
// cron simplesmente pula nas execuções seguintes.
//
// Colunas do CSV (comma-delimited, com campos quoted):
//   [0] Nome | [1] Descrição | [2] Estoque total | [3] Estoque empresa
//   [4] Estoque colaborador | [5] Equipamento | [6] Categoria
//   [7] Status | [8] Custo unitário | [9] Valor unitário | ...
//
// Mapeamento:
//   Nome → name, SKU extraído do início (ex: "0423 - CHIP..." → "0423")
//   Descrição → description, Estoque total → stock_quantity
//   Valor unitário → price, Custo unitário → cost
//   Categoria → category, Status "Ativo" → active=true

cronAdd('import_products_csv', '* * * * *', function () {
  // Pula se já importado (idempotente)
  var currentCount = $app.countRecords('products')
  if (currentCount >= 2600) {
    return
  }

  console.log('Import products cron: starting (current count: ' + currentCount + ')')

  // Busca o CSV via $http (disponível em hooks, NÃO em migrações)
  var url =
    'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/819ad1b5-1865-4f2e-9fe9-f488ce98c0b0/produtos18082026-53d74.csv'
  var res = $http.send({ url: url, method: 'GET', timeout: 120 })

  if (res.statusCode !== 200) {
    console.log('Import products cron: HTTP ' + res.statusCode + ' — will retry next minute')
    return
  }

  var raw = typeof res.raw === 'string' ? res.raw : ''
  if (!raw) {
    console.log('Import products cron: empty response body — will retry next minute')
    return
  }

  console.log('Import products cron: fetched ' + raw.length + ' chars')

  // Normaliza quebras de linha e remove BOM
  var text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.substring(1)
  }

  // ---- Parser CSV (handles quoted fields with embedded commas/newlines) ----
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

  console.log('Import products cron: parsed ' + rows.length + ' rows')

  // ---- Helpers ----
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

  // ---- Deleta registros existentes ----
  var col = $app.findCollectionByNameOrId('products')
  $app.truncateCollection(col)

  // ---- Importa produtos ----
  var count = 0
  var total = 0
  var errors = 0

  // Pula as primeiras 2 linhas (cabeçalho + linha de descrição)
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
    // Gera SKU único para produtos sem número inicial
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
      console.log('Import products cron: failed to save "' + name + '": ' + String(err))
      errors++
    }
  }

  console.log('✅ Produtos importados: ' + count + ' de ' + total + ' (erros: ' + errors + ')')
})
