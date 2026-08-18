migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('service_orders')

    if (!col.fields.getByName('started_at')) {
      col.fields.add(new DateField({ name: 'started_at' }))
    }
    if (!col.fields.getByName('signed_at')) {
      col.fields.add(new DateField({ name: 'signed_at' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('service_orders')
    try {
      col.fields.remove('started_at')
    } catch (_) {}
    try {
      col.fields.remove('signed_at')
    } catch (_) {}
    app.save(col)
  },
)
