migrate(
  (app) => {
    // 1. Atualizar campo 'tipo' na coleção pos_venda_messages para incluir os novos tipos:
    //    checkin_pos_venda, avaliacao_tecnico, avaliacao_google
    const col = app.findCollectionByNameOrId('pos_venda_messages')
    const tipoField = col.fields.getByName('tipo')

    if (tipoField) {
      // PocketBase v0.36 SelectField
      tipoField.values = [
        'resumo_finalizacao',
        'checkin_pos_venda',
        'avaliacao_tecnico',
        'avaliacao_google',
        'avaliacao_30min',
        'pos_venda_7d',
        'oferta_30d',
      ]
      col.fields.add(tipoField)
      app.save(col)
    }

    // 2. Garantir que a setting google_review_url exista na coleção settings
    try {
      const settingsCol = app.findCollectionByNameOrId('settings')
      try {
        app.findFirstRecordByData('settings', 'key', 'google_review_url')
      } catch (_) {
        const record = new Record(settingsCol)
        record.set('key', 'google_review_url')
        record.set('value', 'https://g.page/r/CfKb0UxVRFNsEAI/review')
        record.set('description', 'Link público para avaliação no Google Meu Negócio')
        app.save(record)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('pos_venda_messages')
      const tipoField = col.fields.getByName('tipo')
      if (tipoField) {
        tipoField.values = ['resumo_finalizacao', 'avaliacao_30min', 'pos_venda_7d', 'oferta_30d']
        col.fields.add(tipoField)
        app.save(col)
      }
    } catch (_) {}
  },
)
