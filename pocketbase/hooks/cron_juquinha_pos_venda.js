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
        if (soId) {
          try {
            var so = $app.findRecordById('service_orders', soId)
            soNumber = so.getString('number') || ''
            equip = so.getString('equipment') || ''
          } catch (_) {}
        }

        var header = '🛠️ *JUCA INFORMÁTICA*\n\n'
        var footer = '\n\n— *Juquinha — JUCA Informática*\n📞 (67) 3441-4981 | (67) 99654-4981'
        var textBody = ''

        if (tipo === 'avaliacao_30min') {
          textBody =
            'Oi, ' +
            firstName +
            '! Aqui é o *Juquinha* da JUCA Informática! 🙋‍♂️\n\n' +
            'Passando para agradecer pela confiança no conserto do seu equipamento' +
            (equip ? ' (' + equip + ')' : '') +
            (soNumber ? ' na OS *' + soNumber + '*' : '') +
            '!\n\n' +
            'Sua opinião é fundamental para valorizar nosso técnico e nos ajudar a evoluir cada vez mais.\n\n' +
            'Você poderia nos dedicar 30 segundinhos para deixar uma avaliação rápida no Google? Isso faz toda a diferença para o nosso trabalho! ⭐⭐⭐⭐⭐\n\n' +
            '👉 ' +
            googleReviewUrl +
            '\n\n' +
            'Muito obrigado!'
        } else if (tipo === 'pos_venda_7d') {
          textBody =
            'Olá, ' +
            firstName +
            '! Tudo bem com você? Aqui é o *Juquinha* da JUCA Informática! 🛠️\n\n' +
            'Já faz uma semana que finalizamos a sua OS *' +
            soNumber +
            '*' +
            (equip ? ' referente ao seu ' + equip : '') +
            '.\n\n' +
            'Gostaria de saber se está tudo funcionando perfeitamente! Ficou com alguma dúvida ou precisa de algum ajuste ou suporte adicional?\n\n' +
            'Qualquer coisa que precisar, é só responder esta mensagem. Estamos sempre prontos para ajudar!'
        } else if (tipo === 'oferta_30d') {
          textBody =
            'Oi, ' +
            firstName +
            '! Tudo bem? O *Juquinha* da JUCA Informática passando para te desejar um excelente dia! ✨\n\n' +
            'Lembramos que manter seus equipamentos com manutenção preventiva em dia evita dores de cabeça e paradas indesejadas.\n\n' +
            'Se estiver precisando de recarga de cartuchos, toners, periféricos ou uma revisão com condições especiais para clientes parceiros como você, conte com a gente!\n\n' +
            'Um grande abraço!'
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
