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

    for (var a = 0; a < accounts.length; a++) {
      var acc = accounts[a]

      var filter = "username = '" + acc.username + "' || email = '" + acc.email + "'"
      var existing = app.findRecordsByFilter('users', filter, 'created', 1, 0)

      var record
      if (existing.length > 0) {
        record = existing[0]
      } else {
        record = new Record(usersCol)
      }

      var emailHolders = app.findRecordsByFilter(
        'users',
        "email = '" + acc.email + "'",
        'created',
        50,
        0,
      )
      for (var h = 0; h < emailHolders.length; h++) {
        if (emailHolders[h].id !== record.id) {
          emailHolders[h].setEmail('')
          app.save(emailHolders[h])
          console.log('Cleared email "' + acc.email + '" from user: ' + emailHolders[h].id)
        }
      }

      var usernameHolders = app.findRecordsByFilter(
        'users',
        "username = '" + acc.username + "'",
        'created',
        50,
        0,
      )
      for (var u = 0; u < usernameHolders.length; u++) {
        if (usernameHolders[u].id !== record.id) {
          usernameHolders[u].set('username', '')
          app.save(usernameHolders[u])
          console.log('Cleared username "' + acc.username + '" from user: ' + usernameHolders[u].id)
        }
      }

      record.set('username', acc.username)
      record.set('name', acc.name)
      record.set('role', acc.role)
      record.setEmail(acc.email)
      record.setPassword('12345678')
      record.setVerified(true)

      app.save(record)

      console.log('Quick-access account ensured: ' + acc.username + ' (id: ' + record.id + ')')
    }

    var verify = app.findRecordsByFilter(
      'users',
      "username = 'administrador' || username = 'atendente' || username = 'tecnico'",
      'created',
      3,
      0,
    )
    if (verify.length < 3) {
      throw new Error(
        'Verification failed: expected 3 quick-access accounts, found ' + verify.length,
      )
    }
    console.log('Verification passed: ' + verify.length + ' quick-access accounts confirmed')
  },
  (app) => {},
)
