// Importa os produtos do CSV anexado pelo usuário (500+ produtos).
//
// O CSV é lido em tempo de execução via $http.send — os dados NÃO estão
// embutidos no código. O CSV vem no formato de tabela markdown (delimitado
// por "|") com as colunas:
//   Nome | Descrição | Estoque total | Estoque empresa | Estoque colaborador
//   | Equipamento | Categoria | Status | Custo unitário | Valor unitário
//   | Estoque mínimo | Entrada de estoque | Template de especificações
//
// Regras:
//   - SKU extraído do número inicial do Nome ("0423 - CHIP..." → "0423")
//   - Valores com vírgula decimal ("20,76" → 20.76)
//   - Status "Ativo" → active=true
//   - Idempotente por SKU (ou por nome se não houver SKU)
//   - Sem try/catch silencioso: erros de fetch ou save estouram

migrate(
  (app) => {
    // URLs candidatas — o arquivo foi anexado como produtos_18_08_2026-53d74.csv
    // mas o storage também responde sem os underscores.
    var csvUrls = [
      'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/819ad1b5-1865-4f2e-9fe9-f488ce98c0b0/produtos18082026-53d74.csv',
      'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/819ad1b5-1865-4f2e-9fe9-f488ce98c0b0/produtos_18_08_2026-53d74.csv',
    ]

    var raw = ''
    var tried = []
    for (var i = 0; i < csvUrls.length; i++) {
      var res = $http.send({ url: csvUrls[i], method: 'GET', timeout: 60 })
      var body = typeof res.raw === 'string' ? res.raw : ''
      tried.push(csvUrls[i] + ' → HTTP ' + res.statusCode + ' body=' + body.length + ' chars')
      if (res.statusCode === 200 && body) {
        raw = body
        break
      }
    }

    if (!raw) {
      throw new Error('Não foi possível baixar o CSV de produtos. Tentativas:\n' + tried.join('\n'))
    }

    console.log('Produtos CSV: baixado, ' + raw.length + ' caracteres')

    var text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    var lines = text.split('\n')

    // Converte "20,76" / "1.544,25" / "0" para número.
    var toNumber = function (v) {
      if (!v) return 0
      var s = String(v).trim().replace(/\./g, '').replace(',', '.')
      var n = parseFloat(s)
      return isNaN(n) ? 0 : n
    }

    // Extrai SKU: número inicial antes do primeiro " - " ou "–".
    var extractSku = function (name) {
      if (!name) return ''
      var m = name.match(/^\s*(\d+)\s*[-–]/)
      return m && m.length > 1 ? m[1] : ''
    }

    var clean = function (p) {
      return (p || '').trim()
    }

    var col = app.findCollectionByNameOrId('products')
    var imported = 0
    var updated = 0

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i]
      if (!line) continue
      var t = line.trim()
      if (!t) continue
      if (t.charAt(0) !== '|') continue
      // Separador da tabela markdown.
      if (t.indexOf('---') >= 0) continue

      var parts = line.split('|')
      // [1]=Nome [2]=Descrição [3]=Estoque total [7]=Categoria
      // [8]=Status [9]=Custo unitário [10]=Valor unitário
      var name = clean(parts[1])

      // Pular cabeçalho e linha de descrição das colunas.
      if (!name) continue
      var nameLower = name.toLowerCase()
      if (nameLower === 'nome' || nameLower.indexOf('nome do produto') >= 0) continue

      var description = clean(parts[2])
      var stock = toNumber(parts[3])
      var category = clean(parts[7])
      var statusStr = clean(parts[8])
      var cost = toNumber(parts[9])
      var price = toNumber(parts[10])

      var sku = extractSku(name)
      var active = statusStr.toLowerCase() === 'ativo'

      // Idempotente: buscar por SKU, depois por nome.
      var existing = null
      if (sku) {
        try {
          existing = app.findFirstRecordByData('products', 'sku', sku)
        } catch (_) {
          existing = null
        }
      }
      if (!existing) {
        try {
          existing = app.findFirstRecordByData('products', 'name', name)
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
      record.set('active', active)

      // Sem try/catch — se falhar, estoura para sabermos qual produto.
      app.save(record)
    }

    console.log('Importados ' + imported + ' produtos (atualizados ' + updated + ')')
  },
  (app) => {
    // Reversão: não removemos os produtos automaticamente.
    // A importação é idempotente, então re-aplicar não duplica dados.
  },
)
