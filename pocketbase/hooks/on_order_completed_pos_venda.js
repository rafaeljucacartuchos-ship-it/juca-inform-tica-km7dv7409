// Schedule post-sale messages (Juquinha) when a service order is marked as "completed"
// 1) 30 min: Pedido de avaliação no Google
// 2) 7 dias: Pós-venda e verificação de funcionamento
// 3) 30 dias: Oferta de suprimentos e manutenção
onRecordAfterUpdateSuccess((e) => {
  var currStatus = e.record.getString('status')
  if (currStatus !== 'completed') return e.next()

  // Evita re-agendar se já tiver mensagens cadastradas para esta OS
  var soId = e.record.id
  var custId = e.record.getString('customer')
  if (!custId) return e.next()

  try {
    // Verifica se o cliente autorizou mensagens via WhatsApp (LGPD)
    var cust = $app.findRecordById('customers', custId)
    // Se o cliente explicitamente recusou whatsapp (campo whatsapp_consent === false)
    if (cust && cust.get('whatsapp_consent') === false) {
      $app
        .logger()
        .info(
          'Juquinha: Cliente optou por não receber mensagens WhatsApp (LGPD)',
          'customer',
          custId,
        )
      return e.next()
    }

    var existing = $app.findRecordsByFilter(
      'pos_venda_messages',
      'service_order = "' + soId + '" && tipo = "avaliacao_30min"',
      '',
      1,
      0,
    )
    if (existing && existing.length > 0) {
      return e.next()
    }

    var col = $app.findCollectionByNameOrId('pos_venda_messages')
    var nowMs = new Date().getTime()

    // 1) Avaliação 30 min (30 * 60 * 1000 ms)
    var sched30m = new Date(nowMs + 30 * 60 * 1000).toISOString()
    var msg30m = new Record(col)
    msg30m.set('customer', custId)
    msg30m.set('service_order', soId)
    msg30m.set('tipo', 'avaliacao_30min')
    msg30m.set('status', 'pending')
    msg30m.set('scheduled_at', sched30m)
    $app.save(msg30m)

    // 2) Pós-venda 7 dias (7 * 24 * 60 * 60 * 1000 ms)
    var sched7d = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString()
    var msg7d = new Record(col)
    msg7d.set('customer', custId)
    msg7d.set('service_order', soId)
    msg7d.set('tipo', 'pos_venda_7d')
    msg7d.set('status', 'pending')
    msg7d.set('scheduled_at', sched7d)
    $app.save(msg7d)

    // 3) Oferta 30 dias (30 * 24 * 60 * 60 * 1000 ms)
    var sched30d = new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString()
    var msg30d = new Record(col)
    msg30d.set('customer', custId)
    msg30d.set('service_order', soId)
    msg30d.set('tipo', 'oferta_30d')
    msg30d.set('status', 'pending')
    msg30d.set('scheduled_at', sched30d)
    $app.save(msg30d)

    $app
      .logger()
      .info('Juquinha: Mensagens de pós-venda agendadas com sucesso', 'service_order', soId)
  } catch (err) {
    $app.logger().error('Juquinha: Falha ao agendar mensagens de pós-venda', 'error', String(err))
  }

  return e.next()
}, 'service_orders')
