routerAdd('POST', '/backend/v1/os/{id}/evaluate', (e) => {
  const id = e.request.pathValue('id')

  let record
  try {
    record = $app.findRecordById('service_orders', id)
  } catch (_) {
    return e.json(404, { error: 'Ordem de serviço não encontrada' })
  }

  // Check if evaluation already exists
  try {
    const existing = $app.findRecordsByFilter(
      'evaluations',
      'service_order = "' + id + '"',
      '-created',
      1,
      0,
    )
    if (existing && existing.length > 0) {
      return e.json(400, { error: 'Esta ordem de serviço já possui uma avaliação cadastrada.' })
    }
  } catch (_) {}

  const body = e.requestInfo().body || {}
  const rating = Number(body.rating) || 5
  const satisfaction = body.satisfaction || 'excelente'
  const feedback = body.feedback || ''

  const techId = record.getString('technician')

  let evalCol
  try {
    evalCol = $app.findCollectionByNameOrId('evaluations')
  } catch (_) {
    return e.json(500, { error: 'Coleção de avaliações não encontrada.' })
  }

  const newEval = new Record(evalCol)
  newEval.set('service_order', id)
  if (techId) {
    newEval.set('technician', techId)
  }
  newEval.set('rating', Math.max(1, Math.min(5, rating)))
  newEval.set('satisfaction', satisfaction)
  newEval.set('feedback', feedback)

  $app.save(newEval)

  return e.json(200, {
    success: true,
    evaluation: {
      id: newEval.id,
      rating: rating,
      satisfaction: satisfaction,
      feedback: feedback,
    },
  })
})
