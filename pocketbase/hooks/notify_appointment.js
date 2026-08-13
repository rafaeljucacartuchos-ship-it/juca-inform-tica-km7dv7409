onRecordAfterCreateSuccess((e) => {
  var technician = e.record.getString('technician')
  if (!technician) return e.next()

  var date = e.record.getString('date')
  var startTime = e.record.getString('start_time')

  try {
    var notifCol = $app.findCollectionByNameOrId('notifications')
    var notif = new Record(notifCol)
    notif.set('user', technician)
    notif.set('title', 'Novo agendamento atribuído')
    notif.set('message', 'Visita agendada para ' + date + (startTime ? ' às ' + startTime : ''))
    notif.set('type', 'appointment')
    notif.set('read', false)
    notif.set('link', '/agendamentos')
    $app.save(notif)
  } catch (err) {
    $app.logger().error('Failed to create appointment notification', 'error', String(err))
  }

  return e.next()
}, 'appointments')

onRecordAfterUpdateSuccess((e) => {
  var technician = e.record.getString('technician')
  if (!technician) return e.next()

  var prevTech = e.record.original().getString('technician')
  var prevDate = e.record.original().getString('date')
  var prevStart = e.record.original().getString('start_time')
  var currDate = e.record.getString('date')
  var currStart = e.record.getString('start_time')

  var techChanged = technician !== prevTech
  var dateChanged = currDate !== prevDate || currStart !== prevStart

  if (!techChanged && !dateChanged) return e.next()

  var date = e.record.getString('date')
  var startTime = e.record.getString('start_time')
  var msg = ''

  if (techChanged) {
    msg = 'Agendamento atribuído a você para ' + date + (startTime ? ' às ' + startTime : '')
  } else {
    msg = 'Agendamento atualizado para ' + date + (startTime ? ' às ' + startTime : '')
  }

  try {
    var notifCol = $app.findCollectionByNameOrId('notifications')
    var notif = new Record(notifCol)
    notif.set('user', technician)
    notif.set('title', 'Atualização de agendamento')
    notif.set('message', msg)
    notif.set('type', 'appointment')
    notif.set('read', false)
    notif.set('link', '/agendamentos')
    $app.save(notif)
  } catch (err) {
    $app.logger().error('Failed to create appointment update notification', 'error', String(err))
  }

  return e.next()
}, 'appointments')
