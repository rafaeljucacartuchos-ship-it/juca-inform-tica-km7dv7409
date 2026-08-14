migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // Make sure users collection updateRule allows admins or self
    usersCol.updateRule = "@request.auth.role = 'admin' || id = @request.auth.id"
    app.save(usersCol)

    // Target usernames and passwords reset
    const targets = [
      { name: 'ROBERT MATIAS SENA', username: 'tecnico' },
      { name: 'JOÃO VICTOR SIMÕES DA SILVA', username: 'tecnico2' },
      { name: 'Administrador', username: 'administrador' },
      { name: 'Atendente', username: 'atendente' },
    ]

    for (const t of targets) {
      try {
        // Find by name or username
        let user = null
        try {
          user = app.findFirstRecordByData('users', 'name', t.name)
        } catch (_) {
          try {
            user = app.findFirstRecordByData('users', 'username', t.username)
          } catch (__) {}
        }

        if (user) {
          user.set('username', t.username)
          user.setPassword('12345678')
          user.setVerified(true)
          app.save(user)
        }
      } catch (e) {
        console.log('Error updating user ' + t.username + ': ' + e)
      }
    }
  },
  (app) => {},
)
