// Cron: Processa mensagens de pós-venda agendadas pelo Juquinha
// Executa a cada minuto ('* * * * *')
// Verifica itens com status='pending' cujo scheduled_at <= agora
// IMPORTANTE (v0.0.183): avaliações (avaliacao_tecnico e avaliacao_google) que estejam pending
// NÃO são promovidas automaticamente por tempo, pois aguardam o cliente responder!
// Apenas checkin_pos_venda, pos_venda_7d, oferta_30d e legado são promovidos por tempo.

cronAdd('juquinha_pos_venda_cron', '* * * * *', () => {
  try {
    var now = new Date()
    var nowIso = now.toISOString()

    // Busca até 50 mensagens pendentes com scheduled_at atingido (ou sem scheduled_at)
    // Exclui avaliações do avanço automático por tempo, pois dependem de 'Cliente respondeu'
    var pending = $app.findRecordsByFilter(
      'pos_venda_messages',
      'status = "pending" && tipo != "avaliacao_satisfacao" && tipo != "avaliacao_tecnico" && tipo != "avaliacao_google" && (scheduled_at = null || scheduled_at = "" || scheduled_at <= "' +
        nowIso +
        '")',
      'scheduled_at',
      50,
      0,
    )

    if (!pending || pending.length === 0) return

    // Busca google_review_url configurada
    var googleReviewUrl = 'https://g.page/r/CfKb0UxVRFNsEAI/review'
    try {
      var setRecord = $app.findFirstRecordByData('settings', 'key', 'google_review_url')
      if (setRecord && setRecord.getString('value')) {
        googleReviewUrl = setRecord.getString('value').trim()
      }
    } catch (_) {}

    for (var i = 0; i < pending.length; i++) {
      var msgRec = pending[i]
      try {
        var custId = msgRec.getString('customer')
        var soId = msgRec.getString('service_order')
        var tipo = msgRec.getString('tipo')

        var cust = null
        try {
          cust = $app.findRecordById('customers', custId)
        } catch (_) {}

        if (!cust) {
          msgRec.set('status', 'dismissed')
          $app.save(msgRec)
          continue
        }

        // Verifica consentimento LGPD do cliente
        if (cust.get('whatsapp_consent') === false) {
          msgRec.set('status', 'dismissed')
          $app.save(msgRec)
          continue
        }

        var rawPhone = cust.getString('celular') || cust.getString('phone') || ''
        var digits = rawPhone.replace(/\D/g, '')
        if (!digits) {
          msgRec.set('status', 'dismissed')
          $app.save(msgRec)
          continue
        }
        if (digits.startsWith('0')) digits = digits.substring(1)
        if (!digits.startsWith('55')) digits = '55' + digits

        var customerName =
          cust.getString('nome_fantasia') ||
          cust.getString('razao_social') ||
          cust.getString('name') ||
          'Cliente'
        var firstName = customerName.split(' ')[0]

        var soNumber = ''
        var equip = ''
        var serviceReport = ''
        var techName = ''
        var itemsSummary = ''

        if (soId) {
          try {
            var so = $app.findRecordById('service_orders', soId)
            soNumber = so.getString('number') || ''
            equip = so.getString('equipment') || ''
            serviceReport = so.getString('service_report') || so.getString('description') || ''

            var techId = so.getString('technician')
            if (techId) {
              try {
                var tech = $app.findRecordById('users', techId)
                if (tech) {
                  techName = tech.getString('name') || tech.getString('username') || ''
                }
              } catch (_) {}
            }

            // Buscar itens/peças/serviços da O.S.
            try {
              var soItems = $app.findRecordsByFilter(
                'service_order_items',
                'service_order = "' + soId + '"',
                'created',
                5,
                0,
              )
              if (soItems && soItems.length > 0) {
                var itemNames = []
                for (var j = 0; j < soItems.length; j++) {
                  var desc = soItems[j].getString('description')
                  if (desc && desc.trim()) {
                    itemNames.push(desc.trim())
                  }
                }
                if (itemNames.length > 0) {
                  itemsSummary = itemNames.slice(0, 3).join(', ')
                }
              }
            } catch (_) {}
          } catch (_) {}
        }

        var header = '🛠️ *JUCA INFORMÁTICA*\n\n'
        var footer = '\n\n— *Juquinha — JUCA Informática*\n📞 (67) 3441-4981 | (67) 99654-4981'
        var textBody = ''

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

        var originUrl =
          'https://assistencia-tecnica-movel-86527--skip-app.shrd00.internal.goskip.dev'
        var envPublic = $os.getenv('APP_PUBLIC_URL') || $os.getenv('FRONTEND_URL') || ''
        if (envPublic) originUrl = envPublic.replace(/\/+$/, '')

        // Se a mensagem já tiver token_acesso, reaproveita; senão gera token seguro
        var token = msgRec.getString('token_acesso')
        if (!token) {
          var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
          token = ''
          for (var tIdx = 0; tIdx < 32; tIdx++) {
            var randIdx = Math.floor(Math.random() * chars.length)
            token += chars.charAt(randIdx)
          }
          msgRec.set('token_acesso', token)
        }
        var evalUrl = originUrl + '/avaliar/' + token

        function buildEvalLinkBlock(url) {
          if (url && url.trim()) {
            return '\n\nDe 0 a 5, como você avalia? Toque na sua nota aqui 👉 ' + url.trim()
          }
          return '\n\nDe 0 a 5, como você avalia? Se puder responder com a sua nota, ficamos imensamente gratos! 🙏'
        }

        var evalLinkBlock = buildEvalLinkBlock(evalUrl)

        if (tipo === 'checkin_pos_venda') {
          textBody =
            'Oi, ' +
            firstName +
            '! Tudo bem com você? 😄\n\n' +
            'Passando rapidinho para saber: como está o funcionamento ' +
            equipPhraseDo +
            '?\n\n' +
            'Já conseguiu testar no dia a dia? Ficou tudo 100% como você esperava?\n\n' +
            (techName ? 'O atendimento foi realizado com toda dedicação' + techPart + '. ' : '') +
            'Se tiver qualquer dúvida ou precisar de um ajuste, estamos à sua inteira disposição!' +
            evalLinkBlock
        } else if (tipo === 'pos_venda_7d') {
          var detailsLine = ''
          if (serviceReport) {
            detailsLine = ' após ' + serviceReport
          } else if (itemsSummary) {
            detailsLine = ' após ' + itemsSummary
          }
          textBody =
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
            evalLinkBlock
        } else if (tipo === 'oferta_30d') {
          textBody =
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
        } else if (tipo === 'avaliacao_30min') {
          textBody =
            'Oi, ' +
            firstName +
            '! Tudo bem? 😊\n\n' +
            'Passando para agradecer pela confiança no atendimento ' +
            equipPhraseDo +
            '!\n\n' +
            'A sua opinião é fundamental para nós.' +
            evalLinkBlock
        } else if (tipo === 'avaliacao_satisfacao' || tipo === 'avaliacao_tecnico') {
          var techLabel = techName ? '*' + techName + '*' : 'da nossa equipe técnica'
          textBody =
            'Oi, ' +
            firstName +
            '! Que bom falar com você! 😊\n\n' +
            'O atendimento ' +
            equipPhraseDo +
            ' foi realizado pelo técnico ' +
            techLabel +
            '.\n\n' +
            'Como você avalia o serviço e a atenção dele?' +
            evalLinkBlock
        }

        var fullMessage = header + textBody + footer
        var waLink = 'https://wa.me/' + digits + '?text=' + encodeURIComponent(fullMessage)

        msgRec.set('texto_gerado', fullMessage)
        msgRec.set('wa_me_link', waLink)
        msgRec.set('status', 'ready')
        $app.save(msgRec)

        $app
          .logger()
          .info('Juquinha: Mensagem promovida para ready', 'tipo', tipo, 'customer', customerName)
      } catch (itemErr) {
        $app
          .logger()
          .error('Juquinha: Erro ao processar mensagem', 'id', msgRec.id, 'error', String(itemErr))
      }
    }
  } catch (err) {
    $app.logger().error('Juquinha: Falha no cron de pós-venda', 'error', String(err))
  }
})
