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
        try {
          record = app.findFirstRecordByData('users', 'username', acc.username)
        } catch (e2) {
          // Record not found by email or username — will create new below
        }
      }

      // If a DIFFERENT record holds the target username, clear it via raw SQL
      // so the unique constraint won't fail when we set it on the target record.
      if (record) {
        try {
          var holder = app.findFirstRecordByData('users', 'username', acc.username)
          if (holder && holder.id !== record.id) {
            app
              .db()
              .newQuery("UPDATE users SET username = '' WHERE id = {:id}")
              .bind({ id: holder.id })
              .execute()
          }
        } catch (e) {
          // No other record holds this username — nothing to clear
        }
      }

      // Save the record WITHOUT setting username — validation/hooks may
      // strip it. Password hashing requires app.save (not saveNoValidate).
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

      // Set username via raw SQL — bypasses validation hooks that may
      // clear the field during the normal save cycle.
      app
        .db()
        .newQuery('UPDATE users SET username = {:u} WHERE id = {:id}')
        .bind({ u: acc.username, id: record.id })
        .execute()

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

    // Verification — re-read each record fresh from the database.
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
