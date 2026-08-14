onRecordUpdateRequest((e) => {
  var auth = e.auth
  var isSuper = auth ? auth.isSuperuser() : false
  var isAdmin = auth && auth.record ? auth.record.getString('role') === 'admin' : false

  // If performed by superuser or an admin user updating someone else or themselves, bypass numeric password check or handle cleanly
  if (!isSuper && !isAdmin) {
    var body = e.requestInfo().body
    if (body.password !== undefined && body.password !== '') {
      if (!/^[0-9]{4,8}$/.test(body.password)) {
        return e.badRequestError('A senha deve conter apenas numeros (4 a 8 digitos)')
      }
    }
  } else {
    var body = e.requestInfo().body
    if (body.password !== undefined && body.password !== '') {
      if (!/^[0-9]{4,8}$/.test(body.password)) {
        return e.badRequestError('A senha deve conter apenas numeros (4 a 8 digitos)')
      }
    }
  }
  e.next()
}, 'users')
