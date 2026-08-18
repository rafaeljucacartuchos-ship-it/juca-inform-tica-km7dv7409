// Adiciona os campos da planilha de serviços à coleção `services` e importa
// o CSV de serviços (62 linhas) enviado pelo usuário.
//
// Campos adicionados: title, external_code, status, obs, obs_template,
// obs_editable, cnae. A coleção `services` já existia (name, description,
// price, estimated_duration, active, category) — apenas estendemos.
//
// O CSV é buscado em tempo de execução via $http.send. A importação é
// idempotente: serviços já existentes (mesmo external_code) são atualizados.

migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('services')

    // Helper: adiciona campo apenas se ainda não existir.
    var addField = function (field) {
      if (!col.fields.getByName(field.name)) {
        col.fields.add(field)
      }
    }

    addField(new TextField({ name: 'title' }))
    addField(new TextField({ name: 'external_code' }))
    addField(new TextField({ name: 'status' }))
    addField(new TextField({ name: 'obs' }))
    addField(new TextField({ name: 'obs_template' }))
    addField(new BoolField({ name: 'obs_editable' }))
    addField(new TextField({ name: 'cnae' }))

    app.save(col)

    // ---- Importação do CSV de serviços ----
    // O anexo segue o mesmo padrão de URL pública do CSV de produtos.
    var csvCandidates = [
      'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/819ad1b5-1865-4f2e-9fe9-f488ce98c0b0/servicos_18_08_2026-1460e.csv',
      'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/servicos_18_08_2026-1460e.csv',
    ]

    var raw = ''
    var foundUrl = ''
    for (var i = 0; i < csvCandidates.length; i++) {
      try {
        var res = $http.send({ url: csvCandidates[i], method: 'GET', timeout: 60 })
        if (res.statusCode === 200 && res.raw) {
          raw = res.raw
          foundUrl = csvCandidates[i]
          break
        }
      } catch (_) {}
    }

    if (!raw) {
      console.log(
        'Services CSV import: CSV não disponível em nenhuma URL candidata — pulando importação de dados.',
      )
      return
    }
    console.log('Services CSV import: encontrado em ' + foundUrl + ' length=' + raw.length)

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

    // Detecta o delimitador (vírgula ou ponto-e-vírgula ou pipe).
    var delim = ','
    if (lines.length > 0 && lines[0].indexOf(';') >= 0) delim = ';'
    if (
      lines.length > 0 &&
      lines[0].indexOf('|') >= 0 &&
      lines[0].split('|').length > lines[0].split(delim).length
    )
      delim = '|'

    var imported = 0
    var updated = 0
    var skipped = 0

    for (var li = 0; li < lines.length; li++) {
      var line = lines[li]
      if (!line) continue
      var t = line.trim()
      if (!t) continue

      var parts = line.split(delim)
      if (parts.length < 2) {
        skipped++
        continue
      }

      // Mapeamento flexível por cabeçalho detectado na primeira linha.
      // Tentamos posicionalmente: assume ordem
      // title, description, price, external_code, status, obs, obs_template, obs_editable, cnae
      // mas também tolera apenas title + price.
      var title = clean(parts[0])
      // Pula cabeçalho
      if (
        li === 0 &&
        (title.toLowerCase() === 'titulo' ||
          title.toLowerCase() === 'title' ||
          title.toLowerCase().indexOf('servi') >= 0)
      ) {
        continue
      }
      if (!title) {
        skipped++
        continue
      }

      var description = parts.length > 1 ? clean(parts[1]) : ''
      var price = parts.length > 2 ? toNumber(parts[2]) : 0
      var external_code = parts.length > 3 ? clean(parts[3]) : ''
      var statusStr = parts.length > 4 ? clean(parts[4]) : 'ativo'
      var obs = parts.length > 5 ? clean(parts[5]) : ''
      var obs_template = parts.length > 6 ? clean(parts[6]) : ''
      var obs_editable =
        parts.length > 7
          ? clean(parts[7]).toLowerCase() === 'true' ||
            clean(parts[7]) === '1' ||
            clean(parts[7]).toLowerCase() === 'sim'
          : false
      var cnae = parts.length > 8 ? clean(parts[8]) : ''

      // Idempotente por external_code (ou por title se não houver código).
      var existing = null
      var lookupField = external_code ? 'external_code' : 'title'
      var lookupValue = external_code ? external_code : title
      if (lookupValue) {
        try {
          existing = app.findFirstRecordByData('services', lookupField, lookupValue)
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
      record.set('status', statusStr || 'ativo')
      record.set('obs', obs)
      record.set('obs_template', obs_template)
      record.set('obs_editable', obs_editable)
      record.set('cnae', cnae)
      if (!existing) {
        record.set('active', true)
        record.set('category', 'outros')
        record.set('estimated_duration', 0)
      }

      try {
        app.save(record)
      } catch (err) {
        console.log('Services CSV import: falha ao salvar title=' + title + ' err=' + String(err))
        skipped++
      }
    }

    console.log(
      'Services CSV import completed imported=' +
        imported +
        ' updated=' +
        updated +
        ' skipped=' +
        skipped,
    )
  },
  (app) => {
    // Reversão: remove apenas os campos adicionados (não apaga registros).
    var col = app.findCollectionByNameOrId('services')
    ;['title', 'external_code', 'status', 'obs', 'obs_template', 'obs_editable', 'cnae'].forEach(
      function (n) {
        var f = col.fields.getByName(n)
        if (f) col.fields.remove(f)
      },
    )
    app.save(col)
  },
)
