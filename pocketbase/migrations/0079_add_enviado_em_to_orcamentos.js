migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('orcamentos')

    if (!col.fields.getByName('enviado_em')) {
      col.fields.add(
        new DateField({
          name: 'enviado_em',
          required: false,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('orcamentos')
      const f = col.fields.getByName('enviado_em')
      if (f) {
        col.fields.removeById(f.id)
        app.save(col)
      }
    } catch (_) {}
  },
)
