routerAdd('POST', '/backend/v1/shared-order/{id}/sign', (e) => {
  const id = e.request.pathValue('id')

  const uploaded = e.findUploadedFiles('signature')
  if (!uploaded || uploaded.length === 0) {
    return e.badRequestError('Assinatura é obrigatória')
  }

  let record
  try {
    record = $app.findRecordById('service_orders', id)
  } catch (_) {
    return e.json(404, { error: 'Ordem não encontrada' })
  }

  const file = $filesystem.fileFromMultipart(uploaded[0])
  record.set('customer_signature', file)
  $app.save(record)

  return e.json(200, { success: true, message: 'Assinatura salva com sucesso!' })
})
