migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pos_venda_messages')

    // 1. cliente_respondeu (bool) - flag se o cliente respondeu ao pós-venda
    // bool fields NÃO devem ser required no PocketBase
    if (!col.fields.getByName('cliente_respondeu')) {
      col.fields.add(
        new BoolField({
          name: 'cliente_respondeu',
          required: false,
        }),
      )
    }

    // 2. cliente_respondeu_em (date) - data/hora em que o cliente respondeu ou foi marcado como respondido
    if (!col.fields.getByName('cliente_respondeu_em')) {
      col.fields.add(
        new DateField({
          name: 'cliente_respondeu_em',
          required: false,
        }),
      )
    }

    // 3. avaliacoes_liberadas (bool) - flag se as mensagens de avaliação já foram geradas/liberadas para este checkin
    if (!col.fields.getByName('avaliacoes_liberadas')) {
      col.fields.add(
        new BoolField({
          name: 'avaliacoes_liberadas',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('pos_venda_messages')
      const f1 = col.fields.getByName('cliente_respondeu')
      if (f1) col.fields.removeById(f1.id)
      const f2 = col.fields.getByName('cliente_respondeu_em')
      if (f2) col.fields.removeById(f2.id)
      const f3 = col.fields.getByName('avaliacoes_liberadas')
      if (f3) col.fields.removeById(f3.id)
      app.save(col)
    } catch (_) {}
  },
)
