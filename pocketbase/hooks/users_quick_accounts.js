routerAdd('GET', '/backend/v1/users/quick-accounts', (e) => {
  let records = []
  try {
    records = $app.findRecordsByFilter(
      'users',
      'role = "admin" || role = "attendant" || role = "technician"',
      'name',
      0,
      0,
    )
  } catch (_) {
    return e.json(200, [])
  }

  const result = records.map(function (r) {
    return {
      id: r.id,
      username: r.getString('username'),
      name: r.getString('name'),
      role: r.getString('role'),
    }
  })

  return e.json(200, result)
})
