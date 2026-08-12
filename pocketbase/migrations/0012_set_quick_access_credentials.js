migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const fixes = [
      { email: 'rafaeljucacartuchos@gmail.com', username: 'administrador', name: 'Administrador' },
      { email: 'atendimento.ana@assistencia.com', username: 'atendente', name: 'Atendente' },
      { email: 'tecnico.carlos@assistencia.com', username: 'tecnico', name: 'Tecnico' },
    ]

    for (const fix of fixes) {
      try {
        const user = app.findAuthRecordByEmail('_pb_users_auth_', fix.email)
        user.set('username', fix.username)
        user.set('name', fix.name)
        user.setPassword('12345678')
        user.setVerified(true)
        app.save(user)
      } catch (_) {
        try {
          const user = app.findFirstRecordByData('users', 'username', fix.username)
          user.setPassword('12345678')
          user.setVerified(true)
          app.save(user)
        } catch (__) {}
      }
    }
  },
  (app) => {},
)
