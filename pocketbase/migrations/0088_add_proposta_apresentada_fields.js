migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('orcamentos')

    if (!col.fields.getByName('proposta_apresentada_em')) {
      col.fields.add(
        new DateField({
          name: 'proposta_apresentada_em',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('proposta_apresentada_por')) {
      col.fields.add(
        new RelationField({
          name: 'proposta_apresentada_por',
          required: false,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('orcamentos')
      const f1 = col.fields.getByName('proposta_apresentada_em')
      if (f1) {
        col.fields.removeById(f1.id)
      }
      const f2 = col.fields.getByName('proposta_apresentada_por')
      if (f2) {
        col.fields.removeById(f2.id)
      }
      app.save(col)
    } catch (_) {}
  },
)
