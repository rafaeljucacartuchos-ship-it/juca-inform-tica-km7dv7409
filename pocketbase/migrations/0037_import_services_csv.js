// Importa os serviços do CSV anexado pelo usuário (62 serviços).
//
// O CSV é lido em tempo de execução via $http.send — os dados NÃO estão
// embutidos no código. O CSV vem no formato de tabela markdown (delimitado
// por "|") com as colunas:
//   Titulo do serviço | Descrição na NFS-e | Formatação do texto na NFS-e
//   | Preço | Código externo | Status | Observação | Template de observação
//   | A observação pode ser editada | CNAE do serviço
//
// Regras:
//   - Preço com vírgula decimal ("50,00" → 50.00)
//   - Status "Ativo" → status="active", "Inativo" → status="inactive"
//   - obs_editable "Ativo" → true, "Inativo" → false
//   - Idempotente por external_code (ou por título/name se vazio)
//   - Sem try/catch silencioso: erros de fetch ou save estouram

migrate(
  (app) => {
    var csvUrls = [
      'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/819ad1b5-1865-4f2e-9fe9-f488ce98c0b0/servicos18082026-2dc70.csv',
      'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/819ad1b5-1865-4f2e-9fe9-f488ce98c0b0/servicos_18_08_2026-2dc70.csv',
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
      throw new Error('Não foi possível baixar o CSV de serviços. Tentativas:\n' + tried.join('\n'))
    }

    console.log('Serviços CSV: baixado, ' + raw.length + ' caracteres')

    var text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    var lines = text.split('\n')

    var toNumber = function (v) {
      if (!v) return 0
      var s = String(v).trim().replace(/\./g, '').replace(',', '.')
      var n = parseFloat(s)
      return isNaN(n) ? 0 : n
    }

    var clean = function (p) {
      return (p || '').trim()
    }

    var col = app.findCollectionByNameOrId('services')
    var imported = 0
    var updated = 0

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i]
      if (!line) continue
      var t = line.trim()
      if (!t) continue
      if (t.charAt(0) !== '|') continue
      if (t.indexOf('---') >= 0) continue

      var parts = line.split('|')
      // [1]=Titulo [2]=Descrição NFS-e [3]=Formatação(ignorar)
      // [4]=Preço [5]=Código externo [6]=Status [7]=Observação
      // [8]=Template obs [9]=obs editável [10]=CNAE
      var title = clean(parts[1])

      if (!title) continue
      var titleLower = title.toLowerCase()
      if (
        titleLower === 'titulo do serviço' ||
        titleLower === 'titulo do servico' ||
        titleLower.indexOf('nome do serviço') >= 0 ||
        titleLower.indexOf('nome do servico') >= 0
      )
        continue

      var description = clean(parts[2])
      var price = toNumber(parts[4])
      var external_code = clean(parts[5])
      var statusStr = clean(parts[6])
      var obs = clean(parts[7])
      var obs_template = clean(parts[8])
      var obs_editableStr = clean(parts[9])
      var cnae = clean(parts[10])

      // Status: "Ativo" → "active", "Inativo" → "inactive"
      var status = statusStr.toLowerCase() === 'ativo' ? 'active' : 'inactive'
      var obs_editable = obs_editableStr.toLowerCase() === 'ativo'
      var active = statusStr.toLowerCase() === 'ativo'

      // Idempotente: buscar por external_code, depois por title, depois por name.
      var existing = null
      if (external_code) {
        try {
          existing = app.findFirstRecordByData('services', 'external_code', external_code)
        } catch (_) {
          existing = null
        }
      }
      if (!existing) {
        try {
          existing = app.findFirstRecordByData('services', 'title', title)
        } catch (_) {
          existing = null
        }
      }
      if (!existing) {
        try {
          existing = app.findFirstRecordByData('services', 'name', title)
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

      record.set('name', title)
      record.set('title', title)
      record.set('description', description)
      record.set('price', price)
      record.set('external_code', external_code)
      record.set('status', status)
      record.set('obs', obs)
      record.set('obs_template', obs_template)
      record.set('obs_editable', obs_editable)
      record.set('cnae', cnae)
      record.set('active', active)

      if (!existing) {
        record.set('category', 'outros')
        record.set('estimated_duration', 0)
      }

      // Sem try/catch — se falhar, estoura para sabermos qual serviço.
      app.save(record)
    }

    console.log('Importados ' + imported + ' serviços (atualizados ' + updated + ')')
  },
  (app) => {
    // Reversão: não removemos os serviços automaticamente.
    // A importação é idempotente, então re-aplicar não duplica dados.
  },
)
