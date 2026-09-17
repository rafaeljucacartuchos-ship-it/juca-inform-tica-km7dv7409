migrate(
  (app) => {
    // 1. Cria a coleção 'funcoes'
    const funcoes = new Collection({
      name: 'funcoes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_funcoes_nome ON funcoes (nome)'],
    })
    app.save(funcoes)

    // 2. Popula com as 3 funções padrão: Administrador, Técnico, Atendente
    const defaultFuncoes = ['Administrador', 'Técnico', 'Atendente']
    for (let i = 0; i < defaultFuncoes.length; i++) {
      const nome = defaultFuncoes[i]
      try {
        app.findFirstRecordByData('funcoes', 'nome', nome)
      } catch (_) {
        const rec = new Record(funcoes)
        rec.set('nome', nome)
        app.save(rec)
      }
    }

    // 3. Adiciona campo 'funcao' do tipo text na coleção 'users' para permitir nomes customizados
    // mantendo 'role' como 'admin' | 'attendant' | 'technician' para compatibilidade total de permissões/dashboard
    const usersCol = app.findCollectionByNameOrId('users')
    if (!usersCol.fields.getByName('funcao')) {
      usersCol.fields.add(new TextField({ name: 'funcao', required: false }))
      app.save(usersCol)
    }

    // 4. Preenche 'funcao' nos usuários existentes baseado em seu 'role'
    try {
      app
        .db()
        .newQuery(`
        UPDATE users 
        SET funcao = CASE 
          WHEN role = 'admin' THEN 'Administrador'
          WHEN role = 'attendant' THEN 'Atendente'
          ELSE 'Técnico'
        END
        WHERE funcao IS NULL OR funcao = ''
      `)
        .execute()
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('funcoes')
      app.delete(col)
    } catch (_) {}

    try {
      const usersCol = app.findCollectionByNameOrId('users')
      const field = usersCol.fields.getByName('funcao')
      if (field) {
        usersCol.fields.removeByName('funcao')
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
