onRecordAfterCreateSuccess((e) => {
  var number = e.record.getString('number')
  var title = e.record.getString('title')
  var customerId = e.record.getString('customer')

  if (customerId) {
    try {
      var rec = $app.findRecordById('service_orders', e.record.id)
      $app.expandRecord(rec, ['customer'])
      var cust = rec.expanded('customer')
      if (cust) {
        var phone = cust.getString('phone')
        if (phone) {
          var siteUrl = ($secrets.get('SITE_URL') || '').replace(/\/$/, '')
          var shareUrl = siteUrl + '/share/' + e.record.id
          var msg =
            'Olá ' +
            cust.getString('name') +
            '! Sua Ordem de Serviço ' +
            number +
            ' foi criada com status: Aberta.\n\nAcompanhe os detalhes e assine digitalmente: ' +
            shareUrl +
            '\n\nJuca Cartuchos e Informática Ltda\n(67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981'
          var waUrl =
            'https://wa.me/' + phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg)
          $http.send({ url: waUrl, method: 'GET', timeout: 10 })
          $app
            .logger()
            .info('WhatsApp notification attempted for OS creation', 'os', number, 'phone', phone)
        }
      }
    } catch (err) {
      $app.logger().error('WhatsApp auto-send failed (non-blocking)', 'error', String(err))
    }
  }

  var technician = e.record.getString('technician')
  if (!technician) return e.next()

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
  var number = e.record.getString('number')
  var title = e.record.getString('title')
  var prevTech = e.record.original().getString('technician')
  var prevStatus = e.record.original().getString('status')
  var currStatus = e.record.getString('status')
  var techChanged = technician !== prevTech
  var statusChanged = currStatus !== prevStatus

  if (statusChanged) {
    try {
      var rec = $app.findRecordById('service_orders', e.record.id)
      $app.expandRecord(rec, ['customer'])
      var cust = rec.expanded('customer')
      if (cust) {
        var phone = cust.getString('phone')
        if (phone) {
          var siteUrl = ($secrets.get('SITE_URL') || '').replace(/\/$/, '')
          var shareUrl = siteUrl + '/share/' + e.record.id
          var statusLabels = {
            open: 'Aberta',
            in_progress: 'Em Andamento',
            waiting_parts: 'Aguardando Peças',
            completed: 'Concluída',
            closed: 'Fechada',
            cancelled: 'Cancelada',
          }
          var statusText = statusLabels[currStatus] || currStatus
          var msg =
            'Olá ' +
            cust.getString('name') +
            '! Sua Ordem de Serviço ' +
            number +
            ' foi atualizada para: ' +
            statusText +
            '.\n\nAcompanhe os detalhes e assine digitalmente: ' +
            shareUrl +
            '\n\nJuca Cartuchos e Informática Ltda\n(67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981'
          var waUrl =
            'https://wa.me/' + phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg)
          $http.send({ url: waUrl, method: 'GET', timeout: 10 })
          $app
            .logger()
            .info(
              'WhatsApp notification attempted for OS status change',
              'os',
              number,
              'status',
              currStatus,
              'phone',
              phone,
            )
        }
      }
    } catch (err) {
      $app.logger().error('WhatsApp auto-send failed (non-blocking)', 'error', String(err))
    }
  }

  if (!techChanged && !statusChanged) return e.next()

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
