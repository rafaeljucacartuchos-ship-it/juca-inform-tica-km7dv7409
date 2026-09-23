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

    function sanitizeEquipment(eq) {
      if (!eq) return 'seu equipamento'
      var trimmed = eq.trim()
      if (!trimmed) return 'seu equipamento'
      var up = trimmed.toUpperCase()
      if (
        up === 'SEM MARCA' ||
        up === 'NÃO INFORMADO' ||
        up === 'NAO INFORMADO' ||
        up === 'OUTRO' ||
        up === 'OUTROS' ||
        up === 'EQUIPAMENTO' ||
        up === 'DESCONHECIDO'
      ) {
        return 'seu equipamento'
      }
      return trimmed
    }

    function buildEquipPhrase(eq, prefix) {
      var s = sanitizeEquipment(eq)
      if (s === 'seu equipamento') {
        if (prefix === 'do') return 'do seu equipamento'
        if (prefix === 'o') return 'o seu equipamento'
        return 'de seu equipamento'
      }
      var low = s.toLowerCase()
      var isFem =
        low.startsWith('impressora') ||
        low.startsWith('multifuncional') ||
        low.startsWith('placa') ||
        low.startsWith('fonte') ||
        low.startsWith('tela') ||
        low.startsWith('caixa') ||
        low.startsWith('tv') ||
        low.startsWith('máquina') ||
        low.startsWith('maquina')
      if (prefix === 'do') {
        return isFem ? 'da sua *' + s + '*' : 'do seu *' + s + '*'
      }
      if (prefix === 'o') {
        return isFem ? 'a sua *' + s + '*' : 'o seu *' + s + '*'
      }
      return isFem ? 'da sua *' + s + '*' : 'do seu *' + s + '*'
    }

    var equipPhraseDo = buildEquipPhrase(equip, 'do')
    var techPart = techName ? ' pelo técnico *' + techName + '*' : ''

    // Determina a URL base pública da aplicação
    var originUrl = 'https://assistencia-tecnica-movel-86527--skip-app.shrd00.internal.goskip.dev'
    var envPublic = $os.getenv('APP_PUBLIC_URL') || $os.getenv('FRONTEND_URL') || ''
    if (envPublic) originUrl = envPublic.replace(/\/+$/, '')

    function buildEvalLinkBlock(url) {
      if (url && url.trim()) {
        return '\n\nDe 0 a 5, como você avalia? Toque na sua nota aqui 👉 ' + url.trim()
      }
      return '\n\nDe 0 a 5, como você avalia? Se puder responder com a sua nota, ficamos imensamente gratos! 🙏'
    }

    function generateToken() {
      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      var token = ''
      for (var tIdx = 0; tIdx < 32; tIdx++) {
        var randIdx = Math.floor(Math.random() * chars.length)
        token += chars.charAt(randIdx)
      }
      return token
    }

    // 1) ETAPA 1: CHECK-IN DE ATENDIMENTO (~30 min após conclusão)
    if (!existingTypes['checkin_pos_venda'] && !existingTypes['avaliacao_30min']) {
      try {
        var tokenCheckin = generateToken()
        var evalUrlCheckin = originUrl + '/avaliar/' + tokenCheckin
        var evalLinkBlockCheckin = buildEvalLinkBlock(evalUrlCheckin)

        var bodyCheckin =
          'Oi, ' +
          firstName +
          '! Tudo bem com você? 😄\n\n' +
          'Passando rapidinho para saber: como está o funcionamento ' +
          equipPhraseDo +
          '?\n\n' +
          'Já conseguiu testar no dia a dia? Ficou tudo 100% como você esperava?\n\n' +
          (techName ? 'O atendimento foi realizado com toda dedicação' + techPart + '. ' : '') +
          'Se tiver qualquer dúvida ou precisar de um ajuste, estamos à sua inteira disposição!' +
          evalLinkBlockCheckin

        var textCheckin = header + bodyCheckin + footer

        var schedCheckin = new Date(nowMs + 30 * 60 * 1000).toISOString()
        var msgCheckin = new Record(col)
        msgCheckin.set('customer', custId)
        msgCheckin.set('service_order', soId)
        msgCheckin.set('tipo', 'checkin_pos_venda')
        msgCheckin.set('status', 'pending')
        msgCheckin.set('scheduled_at', schedCheckin)
        msgCheckin.set('texto_gerado', textCheckin)
        msgCheckin.set('channel', 'whatsapp')
        msgCheckin.set('token_acesso', tokenCheckin)
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
        var token7d = generateToken()
        var evalUrl7d = originUrl + '/avaliar/' + token7d
        var evalLinkBlock7d = buildEvalLinkBlock(evalUrl7d)

        var detailsLine = ''
        if (serviceReport) {
          detailsLine = ' após ' + serviceReport
        } else if (itemsSummary) {
          detailsLine = ' após ' + itemsSummary
        }

        var body7d =
          'Olá, ' +
          firstName +
          '! Tudo bem? 🛠️\n\n' +
          'Já se passou uma semaninha desde o serviço ' +
          equipPhraseDo +
          detailsLine +
          techPart +
          '.\n\n' +
          'Como tem sido o uso na rotina? O equipamento está respondendo rápido e perfeitamente?\n\n' +
          'Conta para a gente! Se precisar de qualquer orientação complementar, estamos por aqui!' +
          evalLinkBlock7d

        var text7d = header + body7d + footer

        var sched7d = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString()
        var msg7d = new Record(col)
        msg7d.set('customer', custId)
        msg7d.set('service_order', soId)
        msg7d.set('tipo', 'pos_venda_7d')
        msg7d.set('status', 'pending')
        msg7d.set('scheduled_at', sched7d)
        msg7d.set('texto_gerado', text7d)
        msg7d.set('channel', 'whatsapp')
        msg7d.set('token_acesso', token7d)
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
        var token = generateToken()
        var evalUrl = originUrl + '/avaliar/' + token
        var techLabel = techName ? '*' + techName + '*' : 'da nossa equipe técnica'

        var textSatisfacao =
          header +
          'Oi, ' +
          firstName +
          '! Que bom falar com você! 😊\n\n' +
          'O atendimento ' +
          equipPhraseDo +
          ' foi realizado pelo técnico ' +
          techLabel +
          '.\n\n' +
          'Como você avalia o serviço e a atenção dele?\n\n' +
          'De 0 a 5, como você avalia? Toque na sua nota aqui 👉 ' +
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
        var body30d =
          'Oi, ' +
          firstName +
          '! Como você está? ✨😊\n\n' +
          'Já faz 1 mês que cuidamos ' +
          equipPhraseDo +
          ' e esperamos que tudo continue funcionando perfeitamente por aí!\n\n' +
          'Manutenção preventiva e cuidado contínuo evitam surpresas e mantêm seu trabalho sempre fluindo.\n\n' +
          'Se estiver precisando de recarga de cartuchos, toners, cabos, SSD/memória ou um check-up com condições especiais de cliente parceiro, me dá um toque aqui no WhatsApp!\n\n' +
          (techName
            ? 'O técnico *' + techName + '* e toda a nossa equipe mandam aquele abraço!'
            : 'Toda a nossa equipe da JUCA manda aquele abraço!')

        var text30d = header + body30d + footer

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
