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

    // Step 1: Ensure each account has the correct name, role, email,
    // password, and verified flag. Use findAuthRecordByEmail for
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
        record.set('name', acc.name)
        record.set('role', acc.role)
        record.setEmail(acc.email)
        record.setPassword('12345678')
        record.setVerified(true)
        app.save(record)
        console.log('Updated account: ' + acc.email + ' | role=' + acc.role + ' | id=' + record.id)
      } else {
        record = new Record(usersCol)
        record.set('name', acc.name)
        record.set('role', acc.role)
        record.setEmail(acc.email)
        record.setPassword('12345678')
        record.setVerified(true)
        app.save(record)
        console.log('Created account: ' + acc.email + ' | role=' + acc.role + ' | id=' + record.id)
      }
    }

    // Step 2: Verification — re-read each record fresh from the database
    // and confirm every field is correct. Any mismatch throws and fails
    // the migration (no silent suppression).
    for (var m = 0; m < accounts.length; m++) {
      var acc2 = accounts[m]
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
      if (!user.validatePassword('12345678')) {
        throw new Error(
          'Verification failed for ' + acc2.email + ': password "12345678" does not validate',
        )
      }

      console.log(
        'Verified: ' + acc2.email + ' | role=' + user.getString('role') + ' | password=OK',
      )
    }

    console.log('SUCCESS: All 3 quick-access accounts verified and ready for login')
  },
  (app) => {},
)
