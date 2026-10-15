migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('impressoras')
    if (!col.fields.getByName('premissas_precificacao')) {
      col.fields.add(
        new JSONField({
          name: 'premissas_precificacao',
          maxSize: 2000000,
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('impressoras')
    col.fields.removeByName('premissas_precificacao')
    app.save(col)
  },
)
