/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('users')
    // Apenas administradores autenticados podem criar novos usuários
    col.createRule = "@request.auth.role = 'admin'"
    // Apenas administradores autenticados podem excluir usuários
    col.deleteRule = "@request.auth.role = 'admin'"
    // Administrador pode atualizar qualquer usuário; o próprio usuário pode atualizar apenas seus próprios dados (nome, telefone, avatar, senha), mas NÃO a sua função/role
    // Caso não seja admin, impede alteração do campo 'role'
    col.updateRule =
      "@request.auth.role = 'admin' || (id = @request.auth.id && @request.body.role:isset = false)"
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('users')
    col.createRule = ''
    col.deleteRule = "@request.auth.role = 'admin'"
    col.updateRule = "@request.auth.role = 'admin' || id = @request.auth.id"
    app.save(col)
  },
)
