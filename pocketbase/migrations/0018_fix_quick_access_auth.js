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
      var record = null

      try {
        record = app.findAuthRecordByEmail('users', acc.email)
      } catch (e) {
        // Record not found — will create new below
      }

      if (record) {
        record.set('name', acc.name)
        record.set('role', acc.role)
        record.setEmail(acc.email)
        record.setPassword('12345678')
        record.setVerified(true)
        app.save(record)
      } else {
        record = new Record(usersCol)
        record.set('name', acc.name)
        record.set('role', acc.role)
        record.setEmail(acc.email)
        record.setPassword('12345678')
        record.setVerified(true)
        app.save(record)
      }

      console.log(
        'Quick-access account ensured: ' + acc.email + ' | role=' + acc.role + ' | id=' + record.id,
      )
    }

    // Verification — re-read each record fresh from the database.
    for (var j = 0; j < accounts.length; j++) {
      var acc2 = accounts[j]
      var user = app.findAuthRecordByEmail('users', acc2.email)

      if (user.getString('role') !== acc2.role) {
        throw new Error(
          'Verification failed for ' +
            acc2.email +
            ': role expected "' +
            acc2.role +
            '", got "' +
            user.getString('role') +
            '"',
        )
      }
      if (user.getString('name') !== acc2.name) {
        throw new Error(
          'Verification failed for ' +
            acc2.email +
            ': name expected "' +
            acc2.name +
            '", got "' +
            user.getString('name') +
            '"',
        )
      }
    }

    console.log('Verification passed: all 3 quick-access accounts confirmed')
  },
  (app) => {},
)
