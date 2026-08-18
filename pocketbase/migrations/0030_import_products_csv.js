// Importa os produtos da planilha CSV enviada pelo usuário José.
// O CSV é disponibilizado via URL pública (Supabase Storage) e é lido
// em tempo de execução da migração através de $http.send.
//
// Estrutura do CSV (delimitado por "|", formato tabela markdown):
//   Nome | Descrição | Estoque total | ... | Categoria | Status | Custo unitário | Valor unitário | ...
//
// O SKU é extraído do número inicial do "Nome" (antes do primeiro " - ").
// Valores numéricos usam vírgula como separador decimal ("20,76" -> 20.76).
// A importação é idempotente: produtos já existentes (mesmo SKU) são atualizados.

migrate(
  (app) => {
    const csvUrl =
      'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/819ad1b5-1865-4f2e-9fe9-f488ce98c0b0/produtos18082026-f5a1f.csv'

    var res = $http.send({ url: csvUrl, method: 'GET', timeout: 60 })
    if (res.statusCode !== 200) {
      console.log('CSV import: failed to fetch CSV, status=' + res.statusCode)
      return
    }
    var raw = res.raw || ''
    if (!raw) {
      console.log('CSV import: empty CSV body')
      return
    }
    console.log('CSV import: fetched raw length=' + raw.length)
    if (raw.indexOf('|') < 0) {
      console.log('CSV import: no pipe delimiter found, aborting')
      return
    }

    // Normaliza quebras de linha.
    var text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    var lines = text.split('\n')

    var col = app.findCollectionByNameOrId('products')

    // Helper: converte "20,76" / "11,00" / "0" para número.
    var toNumber = function (v) {
      if (!v) return 0
      var s = String(v).trim().replace(/\./g, '').replace(',', '.')
      var n = parseFloat(s)
      return isNaN(n) ? 0 : n
    }

    // Helper: extrai SKU (número inicial antes do primeiro " - ").
    var extractSku = function (name) {
      if (!name) return ''
      var m = name.match(/^\s*(\d+)\s*[-–]/)
      return m && m.length > 1 ? m[1] : ''
    }

    var imported = 0
    var updated = 0
    var skipped = 0

    console.log('CSV import: total lines=' + lines.length)
    console.log('CSV import: line[0]=' + lines[0].substring(0, 80))
    console.log('CSV import: line[2]=' + (lines[2] || '').substring(0, 80))

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i]
      if (!line) continue
      var t = line.trim()
      if (!t) continue
      // Linhas de cabeçalho/separador da tabela markdown.
      if (t.indexOf('---') === 0 && t.indexOf('|') >= 0) continue
      if (t.indexOf('Nome do produto') >= 0) continue
      if (t.charAt(0) !== '|') continue

      var parts = line.split('|')
      if (parts.length < 10) {
        skipped++
        continue
      }

      var clean = function (p) {
        return (p || '').trim()
      }

      var name = clean(parts[1])
      var description = clean(parts[2])
      var stockTotal = clean(parts[3])
      var category = clean(parts[7])
      var statusStr = clean(parts[8])
      var costStr = clean(parts[9])
      var priceStr = clean(parts[10])

      if (!name) {
        skipped++
        continue
      }

      var sku = extractSku(name)
      var price = toNumber(priceStr)
      var cost = toNumber(costStr)
      var stock = toNumber(stockTotal)
      var active = statusStr.toLowerCase() === 'ativo'

      // Idempotente por SKU: se já existe, atualiza; senão cria.
      var existing = null
      if (sku) {
        try {
          existing = app.findFirstRecordByData('products', 'sku', sku)
        } catch (_) {
          existing = null
        }
      }

      var record
      if (existing) {
        record = existing
        updated++
      } else {
        record = new Record(col)
        imported++
      }

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
        app.save(record)
      } catch (err) {
        console.log(
          'CSV import: failed to save product sku=' + sku + ' name=' + name + ' err=' + String(err),
        )
        skipped++
      }
    }

    console.log(
      'CSV import completed imported=' + imported + ' updated=' + updated + ' skipped=' + skipped,
    )
  },
  (app) => {
    // Reversão: não removemos os produtos automaticamente para evitar
    // apagar registros criados manualmente pelo usuário.
    // A importação é idempotente, então re-aplicar não duplica dados.
  },
)
