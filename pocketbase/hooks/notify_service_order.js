onRecordAfterCreateSuccess((e) => {
  var technician = e.record.getString('technician')
  if (!technician) return e.next()

  var number = e.record.getString('number')
  var title = e.record.getString('title')

  try {
    var notifCol = $app.findCollectionByNameOrId('notifications')
    var notif = new Record(notifCol)
    notif.set('user', technician)
    notif.set('title', 'Nova OS atribuída: ' + number)
    notif.set('message', title || 'Você tem uma nova ordem de serviço')
    notif.set('type', 'service_order')
    notif.set('read', false)
    notif.set('link', '/ordens/' + e.record.id)
    $app.save(notif)
  } catch (err) {
    $app.logger().error('Failed to create SO notification', 'error', String(err))
  }

  return e.next()
}, 'service_orders')

onRecordAfterUpdateSuccess((e) => {
  var technician = e.record.getString('technician')
  if (!technician) return e.next()

  var prevTech = e.record.original().getString('technician')
  var prevStatus = e.record.original().getString('status')
  var currStatus = e.record.getString('status')
  var techChanged = technician !== prevTech
  var statusChanged = currStatus !== prevStatus

  if (!techChanged && !statusChanged) return e.next()

  var number = e.record.getString('number')
  var title = e.record.getString('title')
  var msg = ''

  if (techChanged) {
    msg = 'OS ' + number + ' foi atribuída a você'
  } else if (statusChanged) {
    msg = 'OS ' + number + ' teve o status alterado para: ' + currStatus
  }

  try {
    var notifCol = $app.findCollectionByNameOrId('notifications')
    var notif = new Record(notifCol)
    notif.set('user', technician)
    notif.set('title', 'Atualização da OS: ' + number)
    notif.set('message', msg || title || 'Ordem de serviço atualizada')
    notif.set('type', 'service_order')
    notif.set('read', false)
    notif.set('link', '/ordens/' + e.record.id)
    $app.save(notif)
  } catch (err) {
    $app.logger().error('Failed to create SO update notification', 'error', String(err))
  }

  return e.next()
}, 'service_orders')
