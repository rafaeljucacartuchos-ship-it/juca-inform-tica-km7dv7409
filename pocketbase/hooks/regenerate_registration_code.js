routerAdd(
  'POST',
  '/backend/v1/users/{id}/regenerate-code',
  (e) => {
    if (!e.auth || e.auth.getString('role') !== 'admin') {
      return e.forbiddenError('Apenas administradores podem regenerar logins')
    }

    var id = e.request.pathValue('id')

    var record
    try {
      record = $app.findRecordById('users', id)
    } catch (_) {
      return e.json(404, { error: 'Usuario nao encontrado' })
    }

    var name = record.getString('name')
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
        var existing = $app.findFirstRecordByData('users', 'username', username)
        if (existing && existing.id === record.id) {
          break
        }
        attempts++
        username = baseUsername + (attempts + 1)
      } catch (_) {
        break
      }
    }

    record.set('username', username)
    $app.save(record)

    return e.json(200, { username: username })
  },
  $apis.requireAuth(),
)
