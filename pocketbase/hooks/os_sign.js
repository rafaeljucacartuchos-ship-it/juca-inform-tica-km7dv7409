routerAdd('POST', '/backend/v1/os/{id}/sign', (e) => {
  const id = e.request.pathValue('id')

  let record
  try {
    record = $app.findRecordById('service_orders', id)
  } catch (_) {
    return e.json(404, { error: 'Ordem de serviço não encontrada' })
  }

  const uploadedFiles = e.findUploadedFiles('signature')
  if (!uploadedFiles || uploadedFiles.length === 0) {
    return e.json(400, { error: 'Assinatura é obrigatória' })
  }

  const file = $filesystem.fileFromMultipart(uploadedFiles[0])
  record.set('customer_signature', file)
  $app.save(record)

  return e.json(200, { success: true })
})
