// Collection writes from browsers cannot bypass server-side commercial calculation.
onRecordCreateRequest((e) => {
  const a = e.auth
  if (!a || (!a.isSuperuser() && a.getString('role') !== 'admin'))
    throw new ForbiddenError('Utilize o simulador comercial para gerar uma proposta.')
  return e.next()
}, 'rental_quotes')
onRecordUpdateRequest((e) => {
  const a = e.auth
  if (!a || (!a.isSuperuser() && a.getString('role') !== 'admin'))
    throw new ForbiddenError('Alteração de preços da proposta reservada ao administrador.')
  return e.next()
}, 'rental_quotes')
onRecordUpdateRequest((e) => {
  if (
    e.record.getString('key').startsWith('rental_') ||
    e.record.original().getString('key').startsWith('rental_')
  ) {
    const a = e.auth
    if (!a || (!a.isSuperuser() && a.getString('role') !== 'admin'))
      throw new ForbiddenError('Configuração de locação reservada ao administrador.')
  }
  return e.next()
}, 'settings')
onRecordDeleteRequest((e) => {
  if (e.record.getString('key').startsWith('rental_')) {
    const a = e.auth
    if (!a || (!a.isSuperuser() && a.getString('role') !== 'admin'))
      throw new ForbiddenError('Configuração de locação reservada ao administrador.')
  }
  return e.next()
}, 'settings')
onRecordCreateRequest((e) => {
  if (e.record.getString('key').startsWith('rental_')) {
    const a = e.auth
    if (!a || (!a.isSuperuser() && a.getString('role') !== 'admin'))
      throw new ForbiddenError('Configuração de locação reservada ao administrador.')
  }
  return e.next()
}, 'settings')
