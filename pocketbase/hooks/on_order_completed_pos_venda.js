// Schedule post-sale messages (Juquinha) when a service order is marked as "completed" or "closed"
// Sequência automática no servidor (4 etapas completas, idempotente e protegida contra concorrência):
// 1) Check-in de Atendimento ('checkin_pos_venda') agendado para ~30 min após conclusão
// 2) Pós-venda 7 dias ('pos_venda_7d') agendado para 7 dias após a conclusão da O.S.
// 3) Avaliação de satisfação ('avaliacao_satisfacao') unificada 0-5 com token único /avaliar/:token
// 4) Oferta / Revisão 30 dias ('oferta_30d') agendado para 30 dias após a conclusão da O.S.

onRecordAfterUpdateSuccess((e) => {
  var record = e.record
  var currStatus = record.getString('status')
  if (currStatus !== 'completed' && currStatus !== 'closed') return e.next()

  try {
    var prevStatus = record.original().getString('status')
    if (prevStatus === currStatus) return e.next()
  } catch (_) {}

  var soId = record.id
  var custId = record.getString('customer')
  if (!custId) return e.next()

  try {
    // 1) Respeita consentimento LGPD do cliente
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

    var col = $app.findCollectionByNameOrId('pos_venda_messages')
    var nowMs = new Date().getTime()

    // 2) Idempotência preventiva: busca todas as mensagens já existentes para esta OS
    var existingRecords = []
    try {
      existingRecords = $app.findRecordsByFilter(
        'pos_venda_messages',
        'service_order = "' + soId + '"',
        'created',
        50,
        0,
      )
    } catch (_) {}

    var existingTypes = {}
    for (var k = 0; k < existingRecords.length; k++) {
      existingTypes[existingRecords[k].getString('tipo')] = true
    }

    // Se já existem as 4 etapas, nada mais a fazer
    if (
      (existingTypes['checkin_pos_venda'] || existingTypes['avaliacao_30min']) &&
      existingTypes['pos_venda_7d'] &&
      (existingTypes['avaliacao_satisfacao'] ||
        existingTypes['avaliacao_tecnico'] ||
        existingTypes['avaliacao_google']) &&
      existingTypes['oferta_30d']
    ) {
      return e.next()
    }

    // Dados da O.S. e cliente para textos humanizados
    var custName =
      cust.getString('nome_fantasia') ||
      cust.getString('razao_social') ||
      cust.getString('name') ||
      'Cliente'
    var firstName = custName.split(' ')[0]

    var soNumber = record.getString('number') || ''
    var equip = record.getString('equipment') || ''
    var serviceReport = record.getString('service_report') || record.getString('description') || ''

    var techName = ''
    var techId = record.getString('technician')
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

    var cleanEquip = equip ? equip.trim() : ''
    var upperEquip = cleanEquip.toUpperCase()
    if (
      !cleanEquip ||
      upperEquip === 'SEM MARCA' ||
      upperEquip === 'NÃO INFORMADO' ||
      upperEquip === 'NAO INFORMADO' ||
      upperEquip === 'OUTRO' ||
      upperEquip === 'OUTROS' ||
      upperEquip === 'EQUIPAMENTO'
    ) {
      cleanEquip = ''
    }

    var lowerEquip = cleanEquip.toLowerCase()
    var isFem =
      lowerEquip.startsWith('impressora') ||
      lowerEquip.startsWith('multifuncional') ||
      lowerEquip.startsWith('placa') ||
      lowerEquip.startsWith('fonte') ||
      lowerEquip.startsWith('tela') ||
      lowerEquip.startsWith('tv') ||
      lowerEquip.startsWith('máquina') ||
      lowerEquip.startsWith('maquina')

    var equipPart = cleanEquip
      ? isFem
        ? 'a sua *' + cleanEquip + '*'
        : 'o seu *' + cleanEquip + '*'
      : 'o seu equipamento'
    var osPart = soNumber ? ' (O.S. *' + soNumber + '*)' : ''
    var techMention = techName ? ' e o técnico *' + techName + '*' : ''

    // 1) ETAPA 1: CHECK-IN DE ATENDIMENTO (~30 min após conclusão)
    if (!existingTypes['checkin_pos_venda'] && !existingTypes['avaliacao_30min']) {
      try {
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
        msgCheckin.set('channel', 'whatsapp')
        if (digits) {
          msgCheckin.set(
            'wa_me_link',
            'https://wa.me/' + digits + '?text=' + encodeURIComponent(textCheckin),
          )
        }
        $app.save(msgCheckin)
        existingTypes['checkin_pos_venda'] = true
      } catch (errStep1) {
        $app
          .logger()
          .warn('Juquinha: etapa checkin ignorada (duplicata ou erro)', 'err', String(errStep1))
      }
    }

    // 2) ETAPA 2: PÓS-VENDA 7 DIAS
    if (!existingTypes['pos_venda_7d']) {
      try {
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
        msg7d.set('channel', 'whatsapp')
        if (digits) {
          msg7d.set('wa_me_link', 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text7d))
        }
        $app.save(msg7d)
        existingTypes['pos_venda_7d'] = true
      } catch (errStep2) {
        $app
          .logger()
          .warn(
            'Juquinha: etapa pos_venda_7d ignorada (duplicata ou erro)',
            'err',
            String(errStep2),
          )
      }
    }

    // 3) ETAPA 3: AVALIAÇÃO DE SATISFAÇÃO UNIFICADA (0 a 5 com link /avaliar/:token)
    if (
      !existingTypes['avaliacao_satisfacao'] &&
      !existingTypes['avaliacao_tecnico'] &&
      !existingTypes['avaliacao_google']
    ) {
      try {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        var token = ''
        for (var tIdx = 0; tIdx < 32; tIdx++) {
          var randIdx = Math.floor(Math.random() * chars.length)
          token += chars.charAt(randIdx)
        }

        var techLabel = techName || 'da nossa equipe técnica'
        var osLabel = soNumber ? soNumber : 'sua O.S.'

        var originUrl =
          'https://assistencia-tecnica-movel-86527--skip-app.shrd00.internal.goskip.dev'
        var envPublic = $os.getenv('APP_PUBLIC_URL') || $os.getenv('FRONTEND_URL') || ''
        if (envPublic) originUrl = envPublic.replace(/\/+$/, '')

        var evalUrl = originUrl + '/avaliar/' + token

        var textSatisfacao =
          header +
          'Oi, ' +
          firstName +
          '! *Juquinha* aqui de novo! 😊\n\n' +
          'Seu equipamento foi atendido pelo técnico ' +
          techLabel +
          ' e encerramos a O.S. ' +
          osLabel +
          ' hoje.\n\n' +
          '*De 0 a 5, como você avalia o atendimento que recebeu?*\n\n' +
          'Toque na sua nota aqui 👉 ' +
          evalUrl +
          footer

        var schedEval = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString()
        var msgEval = new Record(col)
        msgEval.set('customer', custId)
        msgEval.set('service_order', soId)
        msgEval.set('tipo', 'avaliacao_satisfacao')
        msgEval.set('status', 'pending')
        msgEval.set('status_funil', 'aguardando_nota')
        msgEval.set('scheduled_at', schedEval)
        msgEval.set('texto_gerado', textSatisfacao)
        msgEval.set('channel', 'whatsapp')
        msgEval.set('token_acesso', token)
        if (digits) {
          msgEval.set(
            'wa_me_link',
            'https://wa.me/' + digits + '?text=' + encodeURIComponent(textSatisfacao),
          )
        }
        $app.save(msgEval)
        existingTypes['avaliacao_satisfacao'] = true
      } catch (errStep3) {
        $app
          .logger()
          .warn(
            'Juquinha: etapa avaliacao_satisfacao ignorada (duplicata ou erro)',
            'err',
            String(errStep3),
          )
      }
    }

    // 4) ETAPA 4: OFERTA / REVISÃO 30 DIAS
    if (!existingTypes['oferta_30d']) {
      try {
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
        msg30d.set('channel', 'whatsapp')
        if (digits) {
          msg30d.set(
            'wa_me_link',
            'https://wa.me/' + digits + '?text=' + encodeURIComponent(text30d),
          )
        }
        $app.save(msg30d)
        existingTypes['oferta_30d'] = true
      } catch (errStep4) {
        $app
          .logger()
          .warn('Juquinha: etapa oferta_30d ignorada (duplicata ou erro)', 'err', String(errStep4))
      }
    }

    $app
      .logger()
      .info(
        'Juquinha: Sequência completa de 4 etapas agendada no servidor com sucesso (checkin + 7d + satisfacao 0-5 + oferta 30d)',
        'service_order',
        soId,
      )
  } catch (err) {
    $app
      .logger()
      .error('Juquinha: Falha ao agendar mensagens de pós-venda no servidor', 'error', String(err))
  }

  return e.next()
}, 'service_orders')
