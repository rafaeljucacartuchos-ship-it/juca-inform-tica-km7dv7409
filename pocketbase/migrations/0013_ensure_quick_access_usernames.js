migrate(
  (app) => {
    var fixes = [
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

    for (var i = 0; i < fixes.length; i++) {
      var fix = fixes[i]
      var user = null

      try {
        user = app.findAuthRecordByEmail('users', fix.email)
      } catch (_) {}

      if (!user) {
        try {
          user = app.findFirstRecordByData('users', 'username', fix.username)
        } catch (_) {}
      }

      if (!user) {
        try {
          user = app.findFirstRecordByData('users', 'role', fix.role)
        } catch (_) {}
      }

      if (user) {
        user.set('username', fix.username)
        if (!user.getString('name')) {
          user.set('name', fix.name)
        }
        user.setPassword('12345678')
        user.setVerified(true)
        app.save(user)
      } else {
        try {
          var usersCol = app.findCollectionByNameOrId('users')
          var newUser = new Record(usersCol)
          newUser.setEmail(fix.email)
          newUser.set('username', fix.username)
          newUser.set('name', fix.name)
          newUser.set('role', fix.role)
          newUser.setPassword('12345678')
          newUser.setVerified(true)
          app.save(newUser)
        } catch (_) {}
      }
    }
  },
  (app) => {},
)
