migrate(
  (app) => {
    var knownAccounts = [
      { email: 'rafaeljucacartuchos@gmail.com', code: '100001', pass: '12345678' },
      { email: 'atendimento.ana@assistencia.com', code: '200002', pass: '12345678' },
      { email: 'tecnico.carlos@assistencia.com', code: '300003', pass: '12345678' },
    ]

    for (var i = 0; i < knownAccounts.length; i++) {
      var acc = knownAccounts[i]
      try {
        var user = app.findAuthRecordByEmail('users', acc.email)
        if (!user.getString('username')) {
          user.set('username', acc.code)
          user.setPassword(acc.pass)
          app.save(user)
        }
      } catch (_) {}
    }

    var allUsers = app.findRecordsByFilter('users', "id != ''", 'created', 500, 0)
    for (var j = 0; j < allUsers.length; j++) {
      var u = allUsers[j]
      if (!u.getString('username')) {
        var code = ''
        var attempts = 0
        while (attempts < 100) {
          code = $security.randomStringWithAlphabet(6, '0123456789')
          try {
            app.findFirstRecordByData('users', 'username', code)
            attempts++
          } catch (_) {
            break
          }
        }
        u.set('username', code)
        app.save(u)
      }
    }
  },
  (app) => {
    var allUsers = app.findRecordsByFilter('users', "id != ''", 'created', 500, 0)
    for (var i = 0; i < allUsers.length; i++) {
      allUsers[i].set('username', '')
      app.save(allUsers[i])
    }
  },
)
