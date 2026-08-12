migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('users')
    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"
    col.createRule = ''
    col.updateRule = "@request.auth.role = 'admin' || id = @request.auth.id"
    col.deleteRule = "@request.auth.role = 'admin'"
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('users')
    col.listRule = 'id = @request.auth.id'
    col.viewRule = 'id = @request.auth.id'
    col.createRule = ''
    col.updateRule = 'id = @request.auth.id'
    col.deleteRule = 'id = @request.auth.id'
    app.save(col)
  },
)
