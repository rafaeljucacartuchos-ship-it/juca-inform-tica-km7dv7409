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

    // Step 1: Clear conflicting usernames on records whose email does NOT
    // match the expected one. We fetch all users and check in JS — never
    // use "username" inside a filter expression (PocketBase rejects it
    // with "unknown field username" on this collection).
    var allUsers = app.findRecordsByFilter('users', "id != ''", 'created', 500, 0)
    for (var i = 0; i < allUsers.length; i++) {
      var u = allUsers[i]
      var uName = u.getString('username')
      if (!uName) continue

      for (var j = 0; j < accounts.length; j++) {
        if (uName === accounts[j].username) {
          var uEmail = u.getString('email')
          if (uEmail !== accounts[j].email) {
            u.set('username', $security.randomString(16))
            app.save(u)
            console.log(
              'Cleared conflicting username "' +
                uName +
                '" from record ' +
                u.id +
                ' (email: ' +
                uEmail +
                ')',
            )
          }
        }
      }
    }

    // Step 2: Ensure each account has the correct username, name, role,
    // email, password, and verified flag. Use findAuthRecordByEmail for
    // lookups — it does NOT use filter expressions.
    for (var k = 0; k < accounts.length; k++) {
      var acc = accounts[k]
      var record = null

      try {
        record = app.findAuthRecordByEmail('users', acc.email)
      } catch (e) {
        // Record not found — will create new below
      }

      if (record) {
        record.set('username', acc.username)
        record.set('name', acc.name)
        record.set('role', acc.role)
        record.setEmail(acc.email)
        record.setPassword('12345678')
        record.setVerified(true)
        app.save(record)
        console.log(
          'Updated account: ' +
            acc.email +
            ' | username=' +
            record.getString('username') +
            ' | role=' +
            acc.role +
            ' | id=' +
            record.id,
        )
      } else {
        record = new Record(usersCol)
        record.set('username', acc.username)
        record.set('name', acc.name)
        record.set('role', acc.role)
        record.setEmail(acc.email)
        record.setPassword('12345678')
        record.setVerified(true)
        app.save(record)
        console.log(
          'Created account: ' +
            acc.email +
            ' | username=' +
            record.getString('username') +
            ' | role=' +
            acc.role +
            ' | id=' +
            record.id,
        )
      }
    }

    // Step 3: Verification — re-read each record fresh from the database
    // and confirm every field is correct. Any mismatch throws and fails
    // the migration (no silent suppression).
    for (var m = 0; m < accounts.length; m++) {
      var acc2 = accounts[m]
      var user = app.findAuthRecordByEmail('users', acc2.email)

      if (user.getString('username') !== acc2.username) {
        throw new Error(
          'Verification failed for ' +
            acc2.email +
            ': username expected "' +
            acc2.username +
            '", got "' +
            user.getString('username') +
            '"',
        )
      }
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
      if (!user.validatePassword('12345678')) {
        throw new Error(
          'Verification failed for ' + acc2.email + ': password "12345678" does not validate',
        )
      }

      console.log(
        'Verified: ' +
          acc2.email +
          ' | username=' +
          user.getString('username') +
          ' | role=' +
          user.getString('role') +
          ' | password=OK',
      )
    }

    console.log('SUCCESS: All 3 quick-access accounts verified and ready for login')
  },
  (app) => {},
)
