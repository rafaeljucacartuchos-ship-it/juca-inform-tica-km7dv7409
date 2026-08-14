migrate(
  (app) => {
    // ----------------------------------------------------------------
    // Step 1: Enable username authentication on the `users` auth collection.
    //
    // The collection must (a) actually have a `username` text field and
    // (b) be configured to accept `username` as a password-auth identity
    // field. Without both, `authWithPassword("administrador", ...)` fails
    // because PocketBase only looks at `email`.
    // ----------------------------------------------------------------
    var usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!usersCol.fields.getByName('username')) {
      usersCol.fields.add(new TextField({ name: 'username' }))
    }

    // A UNIQUE index is required for a field to be usable as an identity
    // field. Use addIndex (idempotent) on the column so PocketBase accepts
    // it in passwordAuth.identityFields below.
    usersCol.addIndex('idx_username__pb_users_auth_', true, 'username', "username != ''")

    // Tell PocketBase that both `email` and `username` are valid identities
    // for password auth. passwordAuth is { enabled, identityFields }.
    usersCol.passwordAuth = {
      enabled: true,
      identityFields: ['email', 'username'],
    }

    app.save(usersCol)

    // ----------------------------------------------------------------
    // Step 2: Define usernames and reset passwords for the 4 known users.
    // No try/catch around the lookups — if a record is missing we want
    // the migration to fail loudly with the real error.
    // ----------------------------------------------------------------
    var accounts = [
      { email: 'rafaeljucacartuchos@gmail.com', username: 'administrador' },
      { email: 'atendimento.ana@assistencia.com', username: 'atendente' },
      { email: 'tecnico.carlos@assistencia.com', username: 'tecnico' },
      { email: 'ASSISTENCIATECNICAJUCACARTUCHO@GMAIL.COM', username: 'tecnico2' },
    ]

    for (var i = 0; i < accounts.length; i++) {
      var acc = accounts[i]
      var record = app.findAuthRecordByEmail('users', acc.email)

      record.set('username', acc.username)
      record.setPassword('12345678')

      // Ensure JOÃO VICTOR is verified (his row currently has verified=false).
      record.setVerified(true)

      app.save(record)
    }

    // ----------------------------------------------------------------
    // Step 3: Verify — re-read each record fresh and confirm username +
    // password + verified are correct. Any mismatch throws and fails the
    // migration (no silent suppression).
    // ----------------------------------------------------------------
    for (var k = 0; k < accounts.length; k++) {
      var a = accounts[k]
      var u = app.findAuthRecordByEmail('users', a.email)

      if (u.getString('username') !== a.username) {
        throw new Error(
          'Verification failed for ' +
            a.email +
            ': username expected "' +
            a.username +
            '", got "' +
            u.getString('username') +
            '"',
        )
      }
      if (!u.validatePassword('12345678')) {
        throw new Error(
          'Verification failed for ' + a.email + ': password "12345678" does not validate',
        )
      }
      if (!u.getBool('verified')) {
        throw new Error('Verification failed for ' + a.email + ': verified is false')
      }

      console.log(
        'Verified: ' +
          a.email +
          ' | username=' +
          u.getString('username') +
          ' | password=OK | verified=true',
      )
    }

    console.log('SUCCESS: username auth enabled and all 4 accounts verified')
  },
  (app) => {},
)
