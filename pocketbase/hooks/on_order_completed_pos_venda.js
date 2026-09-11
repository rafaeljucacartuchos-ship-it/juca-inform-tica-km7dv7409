// Schedule post-sale messages (Juquinha) when a service order is marked as "completed"
// Nova Sequência v0.0.180 em 2 etapas:
// Etapa 1: Check-in de Atendimento ('checkin_pos_venda') agendado para ~30 min após conclusão (dentro do horário comercial)
// Pós-venda 7 dias ('pos_venda_7d') e Oferta 30 dias ('oferta_30d') continuam agendados normalmente.
// Quando o check-in for enviado e o cliente responder, são liberadas as 2 avaliações separadas:
// 'avaliacao_tecnico' (⭐) e 'avaliacao_google' (🌐).
onRecordAfterUpdateSuccess((e) => {
  var currStatus = e.record.getString('status')
  if (currStatus !== 'completed') return e.next()

  // Evita re-agendar se já tiver mensagens de checkin ou pos-venda cadastradas para esta OS
  var soId = e.record.id
  var custId = e.record.getString('customer')
  if (!custId) return e.next()

  try {
    // Verifica se o cliente autorizou mensagens via WhatsApp (LGPD)
    var cust = $app.findRecordById('customers', custId)
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
      'service_order = "' + soId + '" && (tipo = "checkin_pos_venda" || tipo = "avaliacao_30min")',
      '',
      1,
      0,
    )
    if (existing && existing.length > 0) {
      return e.next()
    }

    var col = $app.findCollectionByNameOrId('pos_venda_messages')
    var nowMs = new Date().getTime()

    // Dados da O.S. para pré-gerar texto humanizado e conversacional
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

    var rawPhone = cust.getString('celular') || cust.getString('phone') || ''
    var digits = rawPhone.replace(/\D/g, '')
    if (digits.startsWith('0')) digits = digits.substring(1)
    if (digits && !digits.startsWith('55')) digits = '55' + digits

    var header = '🛠️ *JUCA INFORMÁTICA*\n\n'
    var footer = '\n\n— *Juquinha — JUCA Informática*\n📞 (67) 3441-4981 | (67) 99654-4981'

    var equipPart = equip ? 'o seu *' + equip + '*' : 'o seu equipamento'
    var osPart = soNumber ? ' (O.S. *' + soNumber + '*)' : ''
    var techMention = techName ? ' e o técnico *' + techName + '*' : ''

    // 1) ETAPA 1: CHECK-IN DE ATENDIMENTO (~30 min após conclusão)
    // Conversa amigável de vendedor/técnico perguntando se o cliente está GOSTANDO do serviço/produto
    var textCheckin =
      header +
      'Oi, ' +
      firstName +
      '! Tudo bem com você? Aqui é o *Juquinha* da JUCA Informática! 😄🙋‍♂️\n\n' +
      'Passando rapidinho para bater um papo e saber: como está ' +
      equipPart +
      osPart +
      '?\n\n' +
      'Você já teve um tempinho de testar? Está gostando do serviço que fizemos por aqui? Ficou tudo 100% como você esperava?\n\n' +
      'Eu' +
      techMention +
      ' ficamos muito felizes em te atender! Se tiver qualquer dúvida, detalhe ou precisar de um ajuste, é só me responder por aqui que estou à sua disposição!' +
      footer

    var schedCheckin = new Date(nowMs + 30 * 60 * 1000).toISOString()
    var msgCheckin = new Record(col)
    msgCheckin.set('customer', custId)
    msgCheckin.set('service_order', soId)
    msgCheckin.set('tipo', 'checkin_pos_venda')
    msgCheckin.set('status', 'pending')
    msgCheckin.set('scheduled_at', schedCheckin)
    msgCheckin.set('texto_gerado', textCheckin)
    if (digits) {
      msgCheckin.set(
        'wa_me_link',
        'https://wa.me/' + digits + '?text=' + encodeURIComponent(textCheckin),
      )
    }
    $app.save(msgCheckin)

    // 2) Pós-venda 7 dias (7 * 24 * 60 * 60 * 1000 ms) - Tom conversacional e caloroso
    var detailsLine = ''
    if (serviceReport) {
      detailsLine = ' após o serviço de ' + serviceReport
    } else if (itemsSummary) {
      detailsLine = ' após ' + itemsSummary
    }

    var text7d =
      header +
      'Olá, ' +
      firstName +
      '! Tudo ótimo por aí? Aqui é o *Juquinha* da JUCA Informática novamente! 🛠️👋\n\n' +
      'Já se passou uma semaninha desde que finalizamos ' +
      equipPart +
      osPart +
      detailsLine +
      (techName ? ' com o nosso técnico *' + techName + '*' : '') +
      '.\n\n' +
      'Como tem sido o uso no dia a dia? O equipamento está respondendo direitinho, rápido e sem nenhum problema?\n\n' +
      'Conta para mim! Se precisar de qualquer suporte complementar ou orientação, nós estamos por aqui para te dar total apoio!' +
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

    // 3) Oferta / Revisão 30 dias (30 * 24 * 60 * 60 * 1000 ms) - Tom amigável e atencioso
    var text30d =
      header +
      'Oi, ' +
      firstName +
      '! Como você está? Aqui é o *Juquinha* da JUCA Informática passando para te dar um alô! ✨😊\n\n' +
      'Já faz 1 mês que cuidamos de ' +
      equipPart +
      osPart +
      ' e esperamos que tudo continue funcionando perfeitamente por aí!\n\n' +
      'Você já sabe: manutenção preventiva e cuidado contínuo evitam surpresas e mantêm seu trabalho sempre fluindo.\n\n' +
      'Se estiver precisando de recarga de cartuchos, toners, cabos, SSD/memória ou um check-up com descontos especiais de cliente parceiro, me dá um toque aqui no WhatsApp!\n\n' +
      (techName
        ? 'O técnico *' + techName + '* e toda a nossa família JUCA mandam aquele abraço forte!'
        : 'Toda a nossa equipe da JUCA manda aquele abraço forte!') +
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
      .info(
        'Juquinha: Sequência de pós-venda v0.0.180 agendada com sucesso (check-in + 7d + 30d)',
        'service_order',
        soId,
      )
  } catch (err) {
    $app.logger().error('Juquinha: Falha ao agendar mensagens de pós-venda', 'error', String(err))
  }

  return e.next()
}, 'service_orders')
