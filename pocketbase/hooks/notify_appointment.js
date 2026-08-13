onRecordAfterCreateSuccess((e) => {
  var technician = e.record.getString('technician')
  var date = e.record.getString('date')
  var startTime = e.record.getString('start_time')
  var customerId = e.record.getString('customer')

  if (customerId) {
    try {
      var rec = $app.findRecordById('appointments', e.record.id)
      $app.expandRecord(rec, ['customer'])
      var cust = rec.expanded('customer')
      if (cust) {
        var phone = cust.getString('phone')
        if (phone) {
          var msg =
            'Olá ' +
            cust.getString('name') +
            '! Sua visita técnica foi agendada para ' +
            date +
            (startTime ? ' às ' + startTime : '') +
            '.\n\nJuca Cartuchos e Informática Ltda\n(67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981'
          var waUrl =
            'https://wa.me/' + phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg)
          $http.send({ url: waUrl, method: 'GET', timeout: 10 })
          $app
            .logger()
            .info(
              'WhatsApp notification attempted for appointment creation',
              'date',
              date,
              'phone',
              phone,
            )
        }
      }
    } catch (err) {
      $app.logger().error('WhatsApp auto-send failed (non-blocking)', 'error', String(err))
    }
  }

  if (!technician) return e.next()

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
  var prevTech = e.record.original().getString('technician')
  var prevDate = e.record.original().getString('date')
  var prevStart = e.record.original().getString('start_time')
  var currDate = e.record.getString('date')
  var currStart = e.record.getString('start_time')
  var customerId = e.record.getString('customer')

  var techChanged = technician !== prevTech
  var dateChanged = currDate !== prevDate || currStart !== prevStart

  if (dateChanged && customerId) {
    try {
      var rec = $app.findRecordById('appointments', e.record.id)
      $app.expandRecord(rec, ['customer'])
      var cust = rec.expanded('customer')
      if (cust) {
        var phone = cust.getString('phone')
        if (phone) {
          var msg =
            'Olá ' +
            cust.getString('name') +
            '! Seu agendamento foi atualizado para ' +
            currDate +
            (currStart ? ' às ' + currStart : '') +
            '.\n\nJuca Cartuchos e Informática Ltda\n(67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981'
          var waUrl =
            'https://wa.me/' + phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg)
          $http.send({ url: waUrl, method: 'GET', timeout: 10 })
          $app
            .logger()
            .info(
              'WhatsApp notification attempted for appointment update',
              'date',
              currDate,
              'phone',
              phone,
            )
        }
      }
    } catch (err) {
      $app.logger().error('WhatsApp auto-send failed (non-blocking)', 'error', String(err))
    }
  }

  if (!techChanged && !dateChanged) return e.next()

  var msg = ''
  if (techChanged) {
    msg = 'Agendamento atribuído a você para ' + currDate + (currStart ? ' às ' + currStart : '')
  } else {
    msg = 'Agendamento atualizado para ' + currDate + (currStart ? ' às ' + currStart : '')
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
