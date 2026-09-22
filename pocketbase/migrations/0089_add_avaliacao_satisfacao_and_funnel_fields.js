migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pos_venda_messages')
    const tipoField = col.fields.getByName('tipo')

    if (tipoField) {
      // Adicionar avaliacao_satisfacao mantendo compatibilidade total com os tipos existentes
      tipoField.values = [
        'resumo_finalizacao',
        'checkin_pos_venda',
        'avaliacao_tecnico',
        'avaliacao_google',
        'avaliacao_satisfacao',
        'avaliacao_30min',
        'pos_venda_7d',
        'oferta_30d',
      ]
      col.fields.add(tipoField)
    }

    if (!col.fields.getByName('nota_avaliacao')) {
      col.fields.add(
        new NumberField({
          name: 'nota_avaliacao',
          min: 0,
          max: 5,
          onlyInt: true,
        }),
      )
    }

    if (!col.fields.getByName('status_funil')) {
      col.fields.add(
        new SelectField({
          name: 'status_funil',
          values: [
            'aguardando_nota',
            'critica_contato_pendente',
            'google_sugerido',
            'google_enviado',
            'resolvido',
          ],
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('feedback_cliente')) {
      col.fields.add(
        new TextField({
          name: 'feedback_cliente',
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('pos_venda_messages')
      const tipoField = col.fields.getByName('tipo')
      if (tipoField) {
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
      }
      if (col.fields.getByName('nota_avaliacao')) {
        col.fields.removeByName('nota_avaliacao')
      }
      if (col.fields.getByName('status_funil')) {
        col.fields.removeByName('status_funil')
      }
      if (col.fields.getByName('feedback_cliente')) {
        col.fields.removeByName('feedback_cliente')
      }
      app.save(col)
    } catch (_) {}
  },
)
