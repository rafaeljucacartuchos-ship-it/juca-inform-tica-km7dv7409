migrate(
  (app) => {
    var accounts = [
      {
        username: 'administrador',
        email: 'rafaeljucacartuchos@gmail.com',
        role: 'admin',
        name: 'administrador',
      },
      {
        username: 'atendente',
        email: 'atendimento.ana@assistencia.com',
        role: 'attendant',
        name: 'atendente',
      },
      {
        username: 'tecnico',
        email: 'tecnico.carlos@assistencia.com',
        role: 'technician',
        name: 'tecnico',
      },
    ]

    var usersCol = app.findCollectionByNameOrId('users')

    for (var a = 0; a < accounts.length; a++) {
      var acc = accounts[a]

      var existing = null
      try {
        existing = app.findFirstRecordByData('users', 'username', acc.username)
      } catch (_) {
        try {
          existing = app.findAuthRecordByEmail('users', acc.email)
        } catch (_) {}
      }

      if (existing) {
        existing.set('username', acc.username)
        existing.set('name', acc.name)
        existing.set('role', acc.role)
        existing.setEmail(acc.email)
        existing.setPassword('12345678')
        existing.setVerified(true)
        app.save(existing)
      } else {
        var record = new Record(usersCol)
        record.setEmail(acc.email)
        record.set('username', acc.username)
        record.set('name', acc.name)
        record.set('role', acc.role)
        record.setPassword('12345678')
        record.setVerified(true)
        app.save(record)
      }
    }
  },
  (app) => {},
)
