migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('impressoras')
    if (!col.fields.getByName('preco_oficial')) {
      col.fields.add(
        new NumberField({
          name: 'preco_oficial',
          min: 0,
        }),
      )
    }
    if (!col.fields.getByName('margem_referencia')) {
      col.fields.add(
        new NumberField({
          name: 'margem_referencia',
          min: 0,
          max: 100,
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('impressoras')
    col.fields.removeByName('preco_oficial')
    col.fields.removeByName('margem_referencia')
    app.save(col)
  },
)
