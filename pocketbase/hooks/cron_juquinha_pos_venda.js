// Cron: Processa mensagens de pós-venda agendadas pelo Juquinha
// Executa a cada minuto ('* * * * *')
// Verifica itens com status='pending' cujo scheduled_at <= agora
// Gera o texto personalizado e o link wa.me respeitando horário comercial (08:00 às 18:00 Brasil/MS UTC-4)
cronAdd('juquinha_pos_venda_cron', '* * * * *', () => {
  try {
    var now = new Date()
    var nowIso = now.toISOString()

    // Busca até 50 mensagens pendentes com scheduled_at atingido
    var pending = $app.findRecordsByFilter(
      'pos_venda_messages',
      'status = "pending" && scheduled_at <= "' + nowIso + '"',
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
        // Pega primeiro nome para tom mais próximo e pessoal
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

        // Formatação humanizada e acolhedora dos dados reais
        var equipPart = equip ? 'o seu *' + equip + '*' : 'o seu equipamento'
        var osPart = soNumber ? ' (O.S. *' + soNumber + '*)' : ''
        var techMention = techName ? ' e o técnico *' + techName + '*' : ''

        var servicePart = ''
        if (itemsSummary && serviceReport) {
          servicePart = 'após a realização de ' + serviceReport + ' e aplicação de ' + itemsSummary
        } else if (itemsSummary) {
          servicePart = 'após a realização do serviço com ' + itemsSummary
        } else if (serviceReport) {
          servicePart = 'após ' + serviceReport
        }

        if (tipo === 'checkin_pos_venda') {
          // ETAPA 1: Check-in de atendimento — Tom conversacional perguntando se o cliente está GOSTANDO
          textBody =
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
            ' ficamos muito felizes em te atender! Se tiver qualquer dúvida, detalhe ou precisar de um ajuste, é só me responder por aqui que estou à sua disposição!'
        } else if (tipo === 'avaliacao_tecnico') {
          // ETAPA 2 (A): Avaliação do Técnico — Mensagem simpática, curta e focada no técnico
          var techLabel = techName ? '*' + techName + '*' : 'nosso técnico'
          textBody =
            'Oi, ' +
            firstName +
            '! Que bom falar com você! Aqui é o *Juquinha* da JUCA! ⭐\n\n' +
            'Como você achou o atendimento e a atenção do técnico ' +
            techLabel +
            (osPart ? ' na sua ' + osPart : '') +
            '?\n\n' +
            'De 1 a 5 estrelas ⭐, como você avalia o trabalho dele? Se puder responder com uma nota ou uma palavrinha sobre o que achou, ficamos imensamente gratos!'
        } else if (tipo === 'avaliacao_google') {
          // ETAPA 2 (B): Avaliação no Google — Mensagem separada, direta, com o link
          var googleLinkSection = googleReviewUrl
            ? '\n\n👉 ' + googleReviewUrl + '\n\n'
            : '\n\n(Acesse nossa página no Google e deixe seu comentário!)\n\n'

          textBody =
            'Oi, ' +
            firstName +
            '! *Juquinha* por aqui mais uma vez! 🌐✨\n\n' +
            'A sua opinião no Google é muito importante para nós e ajuda outros clientes a conhecerem a dedicação da nossa equipe.\n\n' +
            'Poderia dedicar 30 segundinhos para deixar uma avaliação 5 estrelas no nosso perfil do Google?' +
            googleLinkSection +
            'Muito obrigado pela parceria e carinho de sempre! 🚀'
        } else if (tipo === 'avaliacao_30min') {
          // Legado mantido compatível com tom melhorado
          textBody =
            'Oi, ' +
            firstName +
            '! Tudo bem? Aqui é o *Juquinha* da JUCA Informática! 🙋‍♂️\n\n' +
            'Passando para agradecer pela confiança em trazer ' +
            equipPart +
            osPart +
            '!\n\n' +
            'A sua opinião é fundamental para nós. Se puder deixar uma avaliação rápida no Google, nos ajuda muito: ⭐⭐⭐⭐⭐\n\n' +
            '👉 ' +
            googleReviewUrl +
            '\n\n' +
            'Muito obrigado de coração!'
        } else if (tipo === 'pos_venda_7d') {
          var detailsLine = ''
          if (servicePart) {
            detailsLine = ' após o serviço de ' + servicePart
          }
          textBody =
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
            'Conta para mim! Se precisar de qualquer suporte complementar ou orientação, nós estamos por aqui para te dar total apoio!'
        } else if (tipo === 'oferta_30d') {
          textBody =
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
              ? 'O técnico *' +
                techName +
                '* e toda a nossa família JUCA mandam aquele abraço forte!'
              : 'Toda a nossa equipe da JUCA manda aquele abraço forte!')
        }

        var fullMessage = header + textBody + footer
        var waLink = 'https://wa.me/' + digits + '?text=' + encodeURIComponent(fullMessage)

        msgRec.set('texto_gerado', fullMessage)
        msgRec.set('wa_me_link', waLink)
        msgRec.set('status', 'ready')
        $app.save(msgRec)

        $app
          .logger()
          .info(
            'Juquinha: Mensagem gerada e pronta para disparo humano',
            'tipo',
            tipo,
            'customer',
            customerName,
          )
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
