// CANDIDATO: obter o link sem expor a memória privada nem substituir tokens existentes.
routerAdd('POST', '/backend/v1/rental-proposal/{id}/share', (e) => {
  e.response.header().set('Cache-Control', 'no-store')
  const info = e.requestInfo()
  const auth = e.auth || info.auth
  const actor = auth && typeof auth.getString === 'function' ? auth : auth && auth.record
  if (!actor || !actor.id) return e.json(403, { error: 'Entre com uma conta autorizada.' })
  const id = e.request.pathValue('id')
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id))
    return e.json(400, { error: 'Proposta inválida.' })
  let token
  try {
    e.app.runInTransaction((tx) => {
      const quote = tx.findRecordById('rental_quotes', id)
      if (!tx.canAccessRecord(quote, info, quote.collection().viewRule))
        throw new Error('ACCESS_DENIED')
      token = quote.getString('token_acesso')
      if (!token) {
        token = $security.randomString(48)
        quote.set('token_acesso', token)
        tx.save(quote)
      }
    })
  } catch (_) {
    return e.json(403, { error: 'Não foi possível obter um link válido para esta proposta.' })
  }
  return e.json(200, { id, token })
})
