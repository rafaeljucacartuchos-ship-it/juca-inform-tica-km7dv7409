migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('users')
    if (!col.fields.getByName('permissions')) {
      col.fields.add(new JSONField({ name: 'permissions' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('users')
    const f = col.fields.getByName('permissions')
    if (f) col.fields.remove(f)
    app.save(col)
  },
)
