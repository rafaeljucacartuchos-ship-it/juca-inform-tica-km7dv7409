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

        if (tipo === 'avaliacao_30min') {
          textBody =
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
            'Muito obrigado de coração!'
        } else if (tipo === 'pos_venda_7d') {
          var detailsLine = ''
          if (servicePart) {
            detailsLine = ', ' + servicePart + ','
          }
          textBody =
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
            'Qualquer coisa que precisar, é só responder por aqui. Estamos sempre prontos para te ajudar!'
        } else if (tipo === 'oferta_30d') {
          var prevContext = ''
          if (equip) {
            prevContext =
              'Já faz um mês que cuidamos do seu *' +
              equip +
              '*' +
              osPart +
              ' e esperamos que ele continue voando alto! 🚀\n\n'
          }
          textBody =
            'Oi, ' +
            firstName +
            '! Tudo bem? O *Juquinha* da JUCA Informática passando para te desejar um excelente dia! ✨\n\n' +
            prevContext +
            'Lembramos que manter seus equipamentos com manutenção preventiva em dia evita dores de cabeça e paradas indesejadas.\n\n' +
            'Se estiver precisando de recarga de cartuchos, toners, periféricos, SSD/memória ou uma nova revisão com condições especiais para clientes parceiros como você, conte com a gente!\n\n' +
            (techName
              ? 'O técnico *' + techName + '* e toda a nossa equipe mandam um grande abraço!'
              : 'Um grande abraço de toda a nossa equipe!')
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
