migrate(
  (app) => {
    var reservedUsernames = ['administrador', 'atendente', 'tecnico']
    var reservedEmails = [
      'rafaeljucacartuchos@gmail.com',
      'atendimento.ana@assistencia.com',
      'tecnico.carlos@assistencia.com',
    ]

    // Step 1: List all users and delete any whose username or email
    // conflicts with the reserved quick access accounts, guaranteeing
    // uniqueness before recreating them.
    var allUsers = app.findRecordsByFilter('users', "id != ''", 'created', 500, 0)
    for (var i = 0; i < allUsers.length; i++) {
      var u = allUsers[i]
      var uname = u.getString('username')
      var email = u.getString('email')
      var shouldDelete = false

      for (var j = 0; j < reservedUsernames.length; j++) {
        if (uname === reservedUsernames[j]) {
          shouldDelete = true
          break
        }
      }

      if (!shouldDelete) {
        for (var k = 0; k < reservedEmails.length; k++) {
          if (email === reservedEmails[k]) {
            shouldDelete = true
            break
          }
        }
      }

      if (shouldDelete) {
        app.delete(u)
      }
    }

    // Step 2: Create the three quick access accounts from scratch.
    var accounts = [
      {
        username: 'administrador',
        email: 'rafaeljucacartuchos@gmail.com',
        role: 'admin',
        name: 'administrador',
      },
      {
        username: 'atendente',
        email: 'atendimento.ana@assistencia.com',
        role: 'attendant',
        name: 'atendente',
      },
      {
        username: 'tecnico',
        email: 'tecnico.carlos@assistencia.com',
        role: 'technician',
        name: 'tecnico',
      },
    ]

    var usersCol = app.findCollectionByNameOrId('users')

    for (var a = 0; a < accounts.length; a++) {
      var acc = accounts[a]
      var record = new Record(usersCol)
      record.setEmail(acc.email)
      record.set('username', acc.username)
      record.set('name', acc.name)
      record.set('role', acc.role)
      record.setPassword('12345678')
      record.setVerified(true)
      app.save(record)
    }
  },
  (app) => {
    var reservedUsernames = ['administrador', 'atendente', 'tecnico']
    var allUsers = app.findRecordsByFilter('users', "id != ''", 'created', 500, 0)
    for (var i = 0; i < allUsers.length; i++) {
      var u = allUsers[i]
      var uname = u.getString('username')
      for (var j = 0; j < reservedUsernames.length; j++) {
        if (uname === reservedUsernames[j]) {
          app.delete(u)
          break
        }
      }
    }
  },
)
