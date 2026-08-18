migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('products')

    if (!col.fields.getByName('cost')) {
      col.fields.add(new NumberField({ name: 'cost' }))
    }
    if (!col.fields.getByName('category')) {
      col.fields.add(new TextField({ name: 'category' }))
    }
    if (!col.fields.getByName('photo')) {
      col.fields.add(new URLField({ name: 'photo' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('products')
    try {
      col.fields.remove('cost')
    } catch (_) {}
    try {
      col.fields.remove('category')
    } catch (_) {}
    try {
      col.fields.remove('photo')
    } catch (_) {}
    app.save(col)
  },
)
