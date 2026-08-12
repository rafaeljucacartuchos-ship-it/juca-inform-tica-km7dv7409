migrate(
  (app) => {
    var accounts = [
      {
        username: 'administrador',
        email: 'rafaeljucacartuchos@gmail.com',
        role: 'admin',
        name: 'Administrador',
      },
      {
        username: 'atendente',
        email: 'atendimento.ana@assistencia.com',
        role: 'attendant',
        name: 'Atendente',
      },
      {
        username: 'tecnico',
        email: 'tecnico.carlos@assistencia.com',
        role: 'technician',
        name: 'Tecnico',
      },
    ]

    var usersCol = app.findCollectionByNameOrId('users')

    for (var i = 0; i < accounts.length; i++) {
      var acc = accounts[i]
      var user = null

      try {
        user = app.findFirstRecordByData('users', 'username', acc.username)
      } catch (_) {}

      if (!user) {
        try {
          user = app.findAuthRecordByEmail('users', acc.email)
        } catch (_) {}
      }

      if (!user) {
        try {
          user = app.findFirstRecordByData('users', 'role', acc.role)
        } catch (_) {}
      }

      if (user) {
        user.set('username', acc.username)
        user.set('role', acc.role)
        if (!user.getString('name')) {
          user.set('name', acc.name)
        }
        user.setPassword('12345678')
        user.setVerified(true)
        app.save(user)
      } else {
        try {
          var newUser = new Record(usersCol)
          newUser.setEmail(acc.email)
          newUser.set('username', acc.username)
          newUser.set('name', acc.name)
          newUser.set('role', acc.role)
          newUser.setPassword('12345678')
          newUser.setVerified(true)
          app.save(newUser)
        } catch (_) {}
      }
    }
  },
  (app) => {},
)
