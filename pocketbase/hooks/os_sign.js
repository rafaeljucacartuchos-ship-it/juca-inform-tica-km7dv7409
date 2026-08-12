routerAdd('POST', '/backend/v1/os/{id}/sign', (e) => {
  const id = e.request.pathValue('id')

  let record
  try {
    record = $app.findRecordById('service_orders', id)
  } catch (_) {
    return e.json(404, { error: 'Ordem de serviço não encontrada' })
  }

  if (record.getString('customer_signature')) {
    return e.json(400, { error: 'Esta ordem de serviço já foi assinada pelo cliente' })
  }

  const uploadedFiles = e.findUploadedFiles('signature')
  if (!uploadedFiles || uploadedFiles.length === 0) {
    return e.json(400, { error: 'Assinatura é obrigatória' })
  }

  const file = $filesystem.fileFromMultipart(uploadedFiles[0])
  record.set('customer_signature', file)

  var now = new Date()
  var year = now.getFullYear()
  var month = now.getMonth() + 1
  var day = now.getDate()
  var dateStr =
    year + '-' + (month < 10 ? '0' + month : '' + month) + '-' + (day < 10 ? '0' + day : '' + day)
  var hours = now.getHours()
  var minutes = now.getMinutes()
  var timeStr =
    (hours < 10 ? '0' + hours : '' + hours) + ':' + (minutes < 10 ? '0' + minutes : '' + minutes)
  record.set('attendance_date', dateStr)
  record.set('attendance_time', timeStr)

  $app.save(record)

  return e.json(200, { success: true })
})
