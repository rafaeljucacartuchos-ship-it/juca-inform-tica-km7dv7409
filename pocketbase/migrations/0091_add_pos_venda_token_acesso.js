migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pos_venda_messages')

    // 1) Adiciona token_acesso em pos_venda_messages caso não exista
    if (!col.fields.getByName('token_acesso')) {
      col.fields.add(
        new TextField({
          name: 'token_acesso',
          min: 16,
          max: 64,
        }),
      )
    }

    col.addIndex('idx_pos_venda_token', false, 'token_acesso', '')
    app.save(col)

    // 2) Backfill de token_acesso para registros existentes de avaliacao_satisfacao
    try {
      const records = app.findRecordsByFilter(
        'pos_venda_messages',
        'token_acesso = null || token_acesso = ""',
        'created',
        1000,
        0,
      )

      for (const rec of records) {
        const token = $security.randomString(32)
        rec.set('token_acesso', token)
        app.save(rec)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('pos_venda_messages')
      col.removeIndex('idx_pos_venda_token')
      if (col.fields.getByName('token_acesso')) {
        col.fields.removeByName('token_acesso')
      }
      app.save(col)
    } catch (_) {}
  },
)
