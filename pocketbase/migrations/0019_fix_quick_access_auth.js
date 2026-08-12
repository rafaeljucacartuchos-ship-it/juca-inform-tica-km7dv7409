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

      // findRecordsByFilter returns [] (does NOT throw) when no match — safe without try/catch
      var byEmail = app.findRecordsByFilter('users', "email = '" + acc.email + "'", 'created', 1, 0)

      var record
      if (byEmail.length > 0) {
        record = byEmail[0]
      } else {
        // Fallback: try by username in case email was changed by a prior broken migration
        var byUsername = app.findRecordsByFilter(
          'users',
          "username = '" + acc.username + "'",
          'created',
          1,
          0,
        )
        if (byUsername.length > 0) {
          record = byUsername[0]
        } else {
          // Neither email nor username found — create a brand-new record
          record = new Record(usersCol)
        }
      }

      // Resolve username conflicts: any OTHER user (different email) holding our target username
      // must be renamed so the unique tokenKey constraint is not violated.
      var conflicts = app.findRecordsByFilter(
        'users',
        "username = '" + acc.username + "' && email != '" + acc.email + "'",
        'created',
        100,
        0,
      )
      for (var c = 0; c < conflicts.length; c++) {
        var conflictUser = conflicts[c]
        var safeName = (conflictUser.getString('name') || 'usuario')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 10)
        if (!safeName) safeName = 'usuario'
        conflictUser.set('username', safeName + '_' + conflictUser.id.slice(-4))
        app.save(conflictUser)
      }

      // Set all required fields on the target record
      record.set('username', acc.username)
      record.set('name', acc.name)
      record.set('role', acc.role)
      record.setEmail(acc.email)
      record.setPassword('12345678')
      record.setVerified(true)

      // Save — NO try/catch: if this fails the error must be visible
      app.save(record)

      console.log(
        'Account ensured: ' +
          acc.email +
          ' | username=' +
          acc.username +
          ' | role=' +
          acc.role +
          ' | id=' +
          record.id,
      )
    }

    // ---- Verification phase — re-read each account and validate every field + password ----
    for (var j = 0; j < accounts.length; j++) {
      var acc2 = accounts[j]
      var verify = app.findRecordsByFilter('users', "email = '" + acc2.email + "'", 'created', 1, 0)

      if (verify.length === 0) {
        throw new Error('Verification FAILED: account not found after save for email ' + acc2.email)
      }

      var u = verify[0]

      if (u.getString('username') !== acc2.username) {
        throw new Error(
          'Verification FAILED for ' +
            acc2.email +
            ': username expected "' +
            acc2.username +
            '", got "' +
            u.getString('username') +
            '"',
        )
      }
      if (u.getString('role') !== acc2.role) {
        throw new Error(
          'Verification FAILED for ' +
            acc2.email +
            ': role expected "' +
            acc2.role +
            '", got "' +
            u.getString('role') +
            '"',
        )
      }
      if (u.getString('name') !== acc2.name) {
        throw new Error(
          'Verification FAILED for ' +
            acc2.email +
            ': name expected "' +
            acc2.name +
            '", got "' +
            u.getString('name') +
            '"',
        )
      }
      if (!u.validatePassword('12345678')) {
        throw new Error(
          'Verification FAILED for ' +
            acc2.email +
            ': password "12345678" does not validate against the stored hash',
        )
      }

      console.log(
        'Verified: ' +
          acc2.email +
          ' | username=' +
          u.getString('username') +
          ' | role=' +
          u.getString('role') +
          ' | password=OK',
      )
    }

    console.log('SUCCESS: All 3 quick-access accounts verified and ready for login')
  },
  (app) => {},
)
