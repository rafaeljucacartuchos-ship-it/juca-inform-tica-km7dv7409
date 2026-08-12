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

      // Lookup: find existing record by email (preferred) or by username.
      // try/catch is used ONLY for existence checking — not for swallowing
      // errors during the corrective save below.
      try {
        record = app.findAuthRecordByEmail('users', acc.email)
      } catch (e) {
        try {
          record = app.findFirstRecordByData('users', 'username', acc.username)
        } catch (e2) {
          // Record not found by email or username — will create new below
        }
      }

      // If a DIFFERENT record holds the target username, clear it so the
      // save on the target record does not fail the unique constraint.
      if (record) {
        try {
          var holder = app.findFirstRecordByData('users', 'username', acc.username)
          if (holder && holder.id !== record.id) {
            holder.set('username', '')
            app.save(holder)
          }
        } catch (e) {
          // No other record holds this username — nothing to clear
        }
      }

      // Corrective logic — NO try/catch. Any error here must surface.
      if (record) {
        record.set('username', acc.username)
        record.set('name', acc.name)
        record.set('role', acc.role)
        record.setEmail(acc.email)
        record.setPassword('12345678')
        record.setVerified(true)
        app.save(record)
      } else {
        record = new Record(usersCol)
        record.set('username', acc.username)
        record.set('name', acc.name)
        record.set('role', acc.role)
        record.setEmail(acc.email)
        record.setPassword('12345678')
        record.setVerified(true)
        app.save(record)
      }

      console.log(
        'Quick-access account ensured: ' +
          acc.email +
          ' | username=' +
          acc.username +
          ' | role=' +
          acc.role +
          ' | id=' +
          record.id,
      )
    }

    // Verification — fail loudly if any account is missing or incorrect.
    // No try/catch: findAuthRecordByEmail throws if not found.
    for (var j = 0; j < accounts.length; j++) {
      var acc2 = accounts[j]
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
    }

    console.log('Verification passed: all 3 quick-access accounts confirmed')
  },
  (app) => {},
)
