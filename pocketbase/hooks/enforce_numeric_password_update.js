onRecordUpdateRequest((e) => {
  var body = e.requestInfo().body
  if (body.password !== undefined && body.password !== '') {
    if (!/^[0-9]{4,8}$/.test(body.password)) {
      return e.badRequestError('A senha deve conter apenas numeros (4 a 8 digitos)')
    }
  }
  e.next()
}, 'users')
