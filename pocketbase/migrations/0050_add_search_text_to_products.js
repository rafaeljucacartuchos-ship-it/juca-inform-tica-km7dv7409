migrate(
  (app) => {
    // 1. Adiciona o campo search_text se ainda não existir
    const col = app.findCollectionByNameOrId('products')
    if (!col.fields.getByName('search_text')) {
      col.fields.add(new TextField({ name: 'search_text' }))
      app.save(col)
    }

    // 2. Cria índice em search_text para acelerar buscas
    col.addIndex('idx_products_search_text', false, 'search_text', '')
    app.save(col)

    // 3. Função de normalização (minúsculas, remove acentos e caracteres diacríticos)
    const normalizeText = (str) => {
      if (!str) return ''
      return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ç/g, 'c')
        .replace(/Ç/g, 'c')
        .toLowerCase()
        .trim()
    }

    // 4. Backfill de todos os produtos existentes
    const pageSize = 500
    let offset = 0
    let totalUpdated = 0

    while (true) {
      const records = app.findRecordsByFilter('products', '1=1', 'id', pageSize, offset)
      if (!records || records.length === 0) break

      for (let i = 0; i < records.length; i++) {
        const record = records[i]
        const name = record.getString('name') || ''
        const sku = record.getString('sku') || ''
        const barcode = record.getString('barcode') || ''
        const codigoBarras = record.getString('codigo_barras') || ''

        const parts = [
          normalizeText(name),
          normalizeText(sku),
          normalizeText(barcode),
          normalizeText(codigoBarras),
        ].filter(Boolean)

        const uniqueTokens = []
        parts.forEach((p) => {
          if (!uniqueTokens.includes(p)) {
            uniqueTokens.push(p)
          }
        })

        const searchText = uniqueTokens.join(' ')
        record.set('search_text', searchText)
        app.save(record)
        totalUpdated++
      }

      if (records.length < pageSize) break
      offset += records.length
    }

    console.log(
      'Backfill search_text concluído com sucesso. Total de produtos atualizados: ' + totalUpdated,
    )
  },
  (app) => {
    const col = app.findCollectionByNameOrId('products')
    col.removeIndex('idx_products_search_text')
    const searchTextField = col.fields.getByName('search_text')
    if (searchTextField) {
      col.fields.remove(searchTextField)
    }
    app.save(col)
  },
)
