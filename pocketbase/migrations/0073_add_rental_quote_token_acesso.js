migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('rental_quotes')

    // 1. Adicionar campo token_acesso se não existir
    if (!col.fields.getByName('token_acesso')) {
      col.fields.add(
        new TextField({
          name: 'token_acesso',
          required: false,
        }),
      )
    }

    // 2. Ajustar API rules para permitir leitura somente se autenticado OU com token válido na query
    col.listRule =
      "@request.auth.id != '' || (token_acesso != '' && @request.query.token != '' && token_acesso = @request.query.token)"
    col.viewRule =
      "@request.auth.id != '' || (token_acesso != '' && @request.query.token != '' && token_acesso = @request.query.token)"

    // 3. Adicionar índice no campo token_acesso
    try {
      col.addIndex('idx_rental_quotes_token', false, 'token_acesso', '')
    } catch (_) {}

    app.save(col)

    // 4. Preencher tokens nos registros existentes que ainda não possuem
    try {
      const records = app.findRecordsByFilter('rental_quotes', '', '', 500, 0)
      for (const record of records) {
        if (!record.getString('token_acesso')) {
          const randToken = $security.randomString(32)
          record.set('token_acesso', randToken)
          app.save(record)
        }
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('rental_quotes')
      col.listRule = "@request.auth.id != ''"
      col.viewRule = "@request.auth.id != ''"
      try {
        col.removeIndex('idx_rental_quotes_token')
      } catch (_) {}
      if (col.fields.getByName('token_acesso')) {
        col.fields.removeByName('token_acesso')
      }
      app.save(col)
    } catch (_) {}
  },
)
