onRecordCreate((e) => {
  if (!e.record.getString('username')) {
    var name = e.record.getString('name')
    if (!name) {
      name = 'usuario'
    }

    var baseUsername = name
      .toLowerCase()
      .replace(/[áàâãä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôõö]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '')

    if (!baseUsername) {
      baseUsername = 'usuario'
    }

    var username = baseUsername
    var attempts = 0
    while (attempts < 100) {
      try {
        $app.findFirstRecordByData('users', 'username', username)
        attempts++
        username = baseUsername + (attempts + 1)
      } catch (_) {
        break
      }
    }
    e.record.set('username', username)
  }
  e.next()
}, 'users')
