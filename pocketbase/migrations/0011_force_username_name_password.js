migrate(
  (app) => {
    var knownAccounts = [
      { email: 'rafaeljucacartuchos@gmail.com', username: 'administrador', pass: '12345678' },
      { email: 'atendimento.ana@assistencia.com', username: 'atendente', pass: '12345678' },
      { email: 'tecnico.carlos@assistencia.com', username: 'tecnico', pass: '12345678' },
    ]

    for (var i = 0; i < knownAccounts.length; i++) {
      var acc = knownAccounts[i]
      try {
        var user = app.findAuthRecordByEmail('users', acc.email)
        user.set('username', acc.username)
        user.setPassword(acc.pass)
        app.save(user)
      } catch (_) {}
    }

    var knownEmails = {}
    for (var k = 0; k < knownAccounts.length; k++) {
      knownEmails[knownAccounts[k].email] = true
    }

    var allUsers = app.findRecordsByFilter('users', "id != ''", 'created', 500, 0)
    for (var j = 0; j < allUsers.length; j++) {
      var u = allUsers[j]
      var email = u.getString('email')
      if (knownEmails[email]) continue

      var name = u.getString('name')
      if (!name) name = 'usuario'

      var baseUsername = name
        .toLowerCase()
        .replace(/[áàâãä]/g, 'a')
        .replace(/[éèêë]/g, 'e')
        .replace(/[íìîï]/g, 'i')
        .replace(/[óòôõö]/g, 'o')
        .replace(/[úùûü]/g, 'u')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]/g, '')

      if (!baseUsername) baseUsername = 'usuario'

      var username = baseUsername
      var attempts = 0
      while (attempts < 100) {
        try {
          var existing = app.findFirstRecordByData('users', 'username', username)
          if (existing && existing.id === u.id) break
          attempts++
          username = baseUsername + (attempts + 1)
        } catch (_) {
          break
        }
      }

      u.set('username', username)
      u.setPassword('12345678')
      app.save(u)
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
