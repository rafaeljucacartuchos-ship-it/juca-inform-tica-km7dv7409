migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('orcamentos')
    if (!col.fields.getByName('token_acesso')) {
      col.fields.add(
        new TextField({
          name: 'token_acesso',
          required: false,
        }),
      )
      app.save(col)
    }

    // Preencher tokens nos registros existentes via raw SQL
    const rows = new DynamicModel({
      id: '',
      token_acesso: '',
    })
    const records = app.findRecordsByFilter('orcamentos', '', '', 500, 0)
    for (const record of records) {
      if (!record.getString('token_acesso')) {
        const randToken = $security.randomString(32)
        record.set('token_acesso', randToken)
        app.save(record)
      }
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('orcamentos')
      col.fields.removeByName('token_acesso')
      app.save(col)
    } catch (_) {}
  },
)
