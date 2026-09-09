/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('ativo')) {
      usersCol.fields.add(new BoolField({ name: 'ativo' }))
    }
    app.save(usersCol)

    // Preenche todos os usuários existentes como ativos (ativo = 1 / true)
    app.db().newQuery('UPDATE users SET ativo = 1 WHERE ativo IS NULL OR ativo = 0').execute()
  },
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const field = usersCol.fields.getByName('ativo')
    if (field) {
      usersCol.fields.removeByName('ativo')
      app.save(usersCol)
    }
  },
)
