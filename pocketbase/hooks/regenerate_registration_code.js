routerAdd(
  'POST',
  '/backend/v1/users/{id}/regenerate-code',
  (e) => {
    if (!e.auth || e.auth.getString('role') !== 'admin') {
      return e.forbiddenError('Apenas administradores podem regenerar codigos')
    }

    var id = e.request.pathValue('id')

    var record
    try {
      record = $app.findRecordById('users', id)
    } catch (_) {
      return e.json(404, { error: 'Usuario nao encontrado' })
    }

    var digits = '0123456789'
    var code = ''
    var attempts = 0
    while (attempts < 100) {
      code = $security.randomStringWithAlphabet(6, digits)
      try {
        $app.findFirstRecordByData('users', 'username', code)
        attempts++
      } catch (_) {
        break
      }
    }

    record.set('username', code)
    $app.save(record)

    return e.json(200, { username: code })
  },
  $apis.requireAuth(),
)
