migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('impressoras')
    if (!col.fields.getByName('custo_mensal_software')) {
      col.fields.add(
        new NumberField({
          name: 'custo_mensal_software',
          min: 0,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('impressoras')
    const field = col.fields.getByName('custo_mensal_software')
    if (field) {
      col.fields.remove(field)
      app.save(col)
    }
  },
)
