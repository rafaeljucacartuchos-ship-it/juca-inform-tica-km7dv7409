onRecordCreate((e) => {
  if (!e.record.getString('username')) {
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
    e.record.set('username', code)
  }
  e.next()
}, 'users')
