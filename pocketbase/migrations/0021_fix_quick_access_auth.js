migrate(
  (app) => {
    var accounts = [
      {
        email: 'rafaeljucacartuchos@gmail.com',
        username: 'administrador',
        role: 'admin',
        name: 'Administrador',
      },
      {
        email: 'atendimento.ana@assistencia.com',
        username: 'atendente',
        role: 'attendant',
        name: 'Atendente',
      },
      {
        email: 'tecnico.carlos@assistencia.com',
        username: 'tecnico',
        role: 'technician',
        name: 'Tecnico',
      },
    ]

    var usersCol = app.findCollectionByNameOrId('users')

    // Step 1: Clear any duplicate usernames from other records so
    // setting the target username won't violate the unique constraint.
    for (var i = 0; i < accounts.length; i++) {
      var acc = accounts[i]
      try {
        var dups = app.findRecordsByFilter(
          'users',
          'username = {:uname} && email != {:email}',
          '',
          100,
          0,
          { uname: acc.username, email: acc.email },
        )
        for (var d = 0; d < dups.length; d++) {
          dups[d].set('username', '')
          app.save(dups[d])
        }
      } catch (e) {
        // No duplicates found — continue
      }
    }

    // Step 2: Ensure each account exists with the correct username,
    // email, password, role, name, and verified flag.
    for (var j = 0; j < accounts.length; j++) {
      var acc2 = accounts[j]
      var record = null

      try {
        record = app.findAuthRecordByEmail('users', acc2.email)
      } catch (e) {
        // Record not found — will create new below
      }

      if (record) {
        record.set('username', acc2.username)
        record.set('name', acc2.name)
        record.set('role', acc2.role)
        record.setEmail(acc2.email)
        record.setPassword('12345678')
        record.setVerified(true)
        app.save(record)
      } else {
        record = new Record(usersCol)
        record.set('username', acc2.username)
        record.set('name', acc2.name)
        record.set('role', acc2.role)
        record.setEmail(acc2.email)
        record.setPassword('12345678')
        record.setVerified(true)
        app.save(record)
      }

      console.log(
        'Account ensured: ' + acc2.email + ' | username=' + acc2.username + ' | id=' + record.id,
      )
    }

    // Step 3: Verification — re-read each record fresh and confirm
    // username, password, and role are all correct.
    for (var k = 0; k < accounts.length; k++) {
      var acc3 = accounts[k]
      var user = app.findAuthRecordByEmail('users', acc3.email)

      if (user.getString('username') !== acc3.username) {
        throw new Error(
          'Verification failed for ' +
            acc3.email +
            ': username expected "' +
            acc3.username +
            '", got "' +
            user.getString('username') +
            '"',
        )
      }
      if (!user.validatePassword('12345678')) {
        throw new Error(
          'Verification failed for ' + acc3.email + ': password "12345678" does not validate',
        )
      }
      if (user.getString('role') !== acc3.role) {
        throw new Error(
          'Verification failed for ' +
            acc3.email +
            ': role expected "' +
            acc3.role +
            '", got "' +
            user.getString('role') +
            '"',
        )
      }

      console.log(
        'Verified: ' +
          acc3.email +
          ' | username=' +
          user.getString('username') +
          ' | role=' +
          user.getString('role') +
          ' | password=OK',
      )
    }

    console.log('SUCCESS: All 3 quick-access accounts verified with username and password')
  },
  (app) => {},
)
