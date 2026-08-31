migrate(
  (app) => {
    // 1. Adiciona attendance_type na coleção service_orders (relação com service_types)
    const serviceTypes = app.findCollectionByNameOrId('service_types')
    const soCol = app.findCollectionByNameOrId('service_orders')

    if (!soCol.fields.getByName('attendance_type')) {
      soCol.fields.add(
        new RelationField({
          name: 'attendance_type',
          collectionId: serviceTypes.id,
          maxSelect: 1,
          required: false,
        }),
      )
      app.save(soCol)
    }

    // 2. Adiciona type (enum: produto | serviço) na coleção products
    const productsCol = app.findCollectionByNameOrId('products')
    if (!productsCol.fields.getByName('type')) {
      productsCol.fields.add(
        new SelectField({
          name: 'type',
          values: ['produto', 'servico'],
          maxSelect: 1,
          required: false,
        }),
      )
      app.save(productsCol)
    }

    // 3. Backfill dos produtos existentes para 'produto' caso type esteja vazio ou nulo
    app
      .db()
      .newQuery("UPDATE products SET type = 'produto' WHERE type IS NULL OR type = ''")
      .execute()

    // 4. Backfill/migração dos serviços da collection `services` para `products` com type='servico'
    // Consolida o catálogo sem quebrar se `services` ainda existir
    try {
      const services = app.findRecordsByFilter('services', '', '', 500, 0)
      for (let i = 0; i < services.length; i++) {
        const s = services[i]
        const serviceTitle = (s.getString('title') || s.getString('name') || '').trim()
        if (!serviceTitle) continue

        const sku = (s.getString('external_code') || '').trim()
        const price = s.getFloat('price') || 0
        const active = s.getBool('active')
        const category = s.getString('category') || ''
        const description = s.getString('description') || s.getString('obs') || ''
        const searchTxt = (serviceTitle + ' ' + sku + ' ' + category).toLowerCase()

        // Verifica se já existe em products por sku ou por nome
        let found = false
        if (sku) {
          try {
            app.findFirstRecordByData('products', 'sku', sku)
            found = true
          } catch (_) {}
        }
        if (!found) {
          try {
            app.findFirstRecordByData('products', 'name', serviceTitle)
            found = true
          } catch (_) {}
        }

        if (!found) {
          const pRec = new Record(productsCol)
          pRec.set('name', serviceTitle)
          pRec.set('type', 'servico')
          if (sku) pRec.set('sku', sku)
          pRec.set('price', price)
          pRec.set('cost', 0)
          pRec.set('stock_quantity', 0)
          pRec.set('active', active !== false)
          pRec.set('category', category)
          pRec.set('description', description)
          pRec.set('search_text', searchTxt)
          try {
            app.save(pRec)
          } catch (saveErr) {
            console.log(
              'Erro ao migrar servico para produto: ' + serviceTitle + ' - ' + String(saveErr),
            )
          }
        }
      }
    } catch (err) {
      console.log('Aviso na migracao de services para products: ' + String(err))
    }
  },
  (app) => {
    try {
      const soCol = app.findCollectionByNameOrId('service_orders')
      const f1 = soCol.fields.getByName('attendance_type')
      if (f1) {
        soCol.fields.remove(f1)
        app.save(soCol)
      }
    } catch (_) {}

    try {
      const productsCol = app.findCollectionByNameOrId('products')
      const f2 = productsCol.fields.getByName('type')
      if (f2) {
        productsCol.fields.remove(f2)
        app.save(productsCol)
      }
    } catch (_) {}
  },
)
