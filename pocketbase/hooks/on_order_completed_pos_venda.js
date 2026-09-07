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

    // Dados da O.S. para pré-gerar texto humanizado personalizado
    var custName =
      cust.getString('nome_fantasia') ||
      cust.getString('razao_social') ||
      cust.getString('name') ||
      'Cliente'
    var firstName = custName.split(' ')[0]

    var soNumber = e.record.getString('number') || ''
    var equip = e.record.getString('equipment') || ''
    var serviceReport =
      e.record.getString('service_report') || e.record.getString('description') || ''

    var techName = ''
    var techId = e.record.getString('technician')
    if (techId) {
      try {
        var tech = $app.findRecordById('users', techId)
        if (tech) {
          techName = tech.getString('name') || tech.getString('username') || ''
        }
      } catch (_) {}
    }

    var itemsSummary = ''
    try {
      var items = $app.findRecordsByFilter(
        'service_order_items',
        'service_order = "' + soId + '"',
        'created',
        5,
        0,
      )
      if (items && items.length > 0) {
        var itemNames = []
        for (var j = 0; j < items.length; j++) {
          var desc = items[j].getString('description')
          if (desc && desc.trim()) itemNames.push(desc.trim())
        }
        if (itemNames.length > 0) {
          itemsSummary = itemNames.slice(0, 3).join(', ')
        }
      }
    } catch (_) {}

    var googleReviewUrl = 'https://g.page/r/CfKb0UxVRFNsEAI/review'
    try {
      var setRecord = $app.findFirstRecordByData('settings', 'key', 'google_review_url')
      if (setRecord && setRecord.getString('value')) {
        googleReviewUrl = setRecord.getString('value').trim()
      }
    } catch (_) {}

    var rawPhone = cust.getString('celular') || cust.getString('phone') || ''
    var digits = rawPhone.replace(/\D/g, '')
    if (digits.startsWith('0')) digits = digits.substring(1)
    if (digits && !digits.startsWith('55')) digits = '55' + digits

    var header = '🛠️ *JUCA INFORMÁTICA*\n\n'
    var footer = '\n\n— *Juquinha — JUCA Informática*\n📞 (67) 3441-4981 | (67) 99654-4981'

    var equipPart = equip ? 'o seu *' + equip + '*' : 'o seu equipamento'
    var osPart = soNumber ? ' (O.S. *' + soNumber + '*)' : ''
    var techPart = techName
      ? 'cuidado com dedicação pelo nosso técnico *' + techName + '*'
      : 'cuidado com dedicação pela nossa equipe técnica'
    var servicePart = ''
    if (itemsSummary && serviceReport) {
      servicePart = 'após a realização de ' + serviceReport + ' e aplicação de ' + itemsSummary
    } else if (itemsSummary) {
      servicePart = 'após a realização do serviço com ' + itemsSummary
    } else if (serviceReport) {
      servicePart = 'após ' + serviceReport
    }

    // 1) Avaliação 30 min (30 * 60 * 1000 ms)
    var text30m =
      header +
      'Oi, ' +
      firstName +
      '! Tudo bem? Aqui é o *Juquinha* da JUCA Informática! 🙋‍♂️\n\n' +
      'Passando para agradecer pela confiança em trazer ' +
      equipPart +
      osPart +
      ', ' +
      techPart +
      (servicePart ? ' (' + servicePart + ')' : '') +
      '!\n\n' +
      'A sua opinião é fundamental para valorizar o trabalho do técnico e ajudar a JUCA a atender você cada vez melhor.\n\n' +
      'Você poderia nos dedicar 30 segundinhos para deixar uma avaliação rápida no Google? É bem rapidinho e nos ajuda muito! ⭐⭐⭐⭐⭐\n\n' +
      '👉 ' +
      googleReviewUrl +
      '\n\n' +
      'Muito obrigado de coração!' +
      footer

    var sched30m = new Date(nowMs + 30 * 60 * 1000).toISOString()
    var msg30m = new Record(col)
    msg30m.set('customer', custId)
    msg30m.set('service_order', soId)
    msg30m.set('tipo', 'avaliacao_30min')
    msg30m.set('status', 'pending')
    msg30m.set('scheduled_at', sched30m)
    msg30m.set('texto_gerado', text30m)
    if (digits) {
      msg30m.set('wa_me_link', 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text30m))
    }
    $app.save(msg30m)

    // 2) Pós-venda 7 dias (7 * 24 * 60 * 60 * 1000 ms)
    var detailsLine = ''
    if (servicePart) {
      detailsLine = ', ' + servicePart + ','
    }
    var text7d =
      header +
      'Olá, ' +
      firstName +
      '! Tudo bem com você? Aqui é o *Juquinha* da JUCA Informática! 🛠️\n\n' +
      'Como está ' +
      equipPart +
      ' que finalizamos na semana passada' +
      osPart +
      detailsLine +
      (techName ? ' com o técnico *' + techName + '*' : '') +
      '? Tudo funcionando perfeitamente por aí?\n\n' +
      'Ficou com alguma dúvida, precisa de algum ajuste ou suporte complementar?\n\n' +
      'Qualquer coisa que precisar, é só responder por aqui. Estamos sempre prontos para te ajudar!' +
      footer

    var sched7d = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString()
    var msg7d = new Record(col)
    msg7d.set('customer', custId)
    msg7d.set('service_order', soId)
    msg7d.set('tipo', 'pos_venda_7d')
    msg7d.set('status', 'pending')
    msg7d.set('scheduled_at', sched7d)
    msg7d.set('texto_gerado', text7d)
    if (digits) {
      msg7d.set('wa_me_link', 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text7d))
    }
    $app.save(msg7d)

    // 3) Oferta 30 dias (30 * 24 * 60 * 60 * 1000 ms)
    var prevContext = ''
    if (equip) {
      prevContext =
        'Já faz um mês que cuidamos do seu *' +
        equip +
        '*' +
        osPart +
        ' e esperamos que ele continue voando alto! 🚀\n\n'
    }
    var text30d =
      header +
      'Oi, ' +
      firstName +
      '! Tudo bem? O *Juquinha* da JUCA Informática passando para te desejar um excelente dia! ✨\n\n' +
      prevContext +
      'Lembramos que manter seus equipamentos com manutenção preventiva em dia evita dores de cabeça e paradas indesejadas.\n\n' +
      'Se estiver precisando de recarga de cartuchos, toners, periféricos, SSD/memória ou uma nova revisão com condições especiais para clientes parceiros como você, conte com a gente!\n\n' +
      (techName
        ? 'O técnico *' + techName + '* e toda a nossa equipe mandam um grande abraço!'
        : 'Um grande abraço de toda a nossa equipe!') +
      footer

    var sched30d = new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString()
    var msg30d = new Record(col)
    msg30d.set('customer', custId)
    msg30d.set('service_order', soId)
    msg30d.set('tipo', 'oferta_30d')
    msg30d.set('status', 'pending')
    msg30d.set('scheduled_at', sched30d)
    msg30d.set('texto_gerado', text30d)
    if (digits) {
      msg30d.set('wa_me_link', 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text30d))
    }
    $app.save(msg30d)

    $app
      .logger()
      .info('Juquinha: Mensagens de pós-venda agendadas com sucesso', 'service_order', soId)
  } catch (err) {
    $app.logger().error('Juquinha: Falha ao agendar mensagens de pós-venda', 'error', String(err))
  }

  return e.next()
}, 'service_orders')
