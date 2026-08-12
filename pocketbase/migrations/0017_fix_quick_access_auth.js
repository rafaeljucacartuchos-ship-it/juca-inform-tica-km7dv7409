migrate(
  (app) => {
    var accounts = [
      {
        email: 'rafaeljucacartuchos@gmail.com',
        role: 'admin',
        name: 'Administrador',
      },
      {
        email: 'atendimento.ana@assistencia.com',
        role: 'attendant',
        name: 'Atendente',
      },
      {
        email: 'tecnico.carlos@assistencia.com',
        role: 'technician',
        name: 'Tecnico',
      },
    ]

    var usersCol = app.findCollectionByNameOrId('users')

    for (var a = 0; a < accounts.length; a++) {
      var acc = accounts[a]

      var existing = []
      try {
        existing = app.findRecordsByFilter('users', "email = '" + acc.email + "'", 'created', 1, 0)
      } catch (e) {}

      var record
      if (existing.length > 0) {
        record = existing[0]
      } else {
        record = new Record(usersCol)
      }

      record.set('name', acc.name)
      record.set('role', acc.role)
      record.setEmail(acc.email)
      record.setPassword('12345678')
      record.setVerified(true)

      app.save(record)

      console.log('Quick-access account ensured: ' + acc.email + ' (id: ' + record.id + ')')
    }

    var verify = []
    try {
      verify = app.findRecordsByFilter(
        'users',
        "email = 'rafaeljucacartuchos@gmail.com' || email = 'atendimento.ana@assistencia.com' || email = 'tecnico.carlos@assistencia.com'",
        'created',
        3,
        0,
      )
    } catch (e) {}

    if (verify.length < 3) {
      throw new Error(
        'Verification failed: expected 3 quick-access accounts, found ' + verify.length,
      )
    }
    console.log('Verification passed: ' + verify.length + ' quick-access accounts confirmed')
  },
  (app) => {},
)
