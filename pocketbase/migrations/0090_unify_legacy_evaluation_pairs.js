migrate(
  (app) => {
    // 1) Busca todas as mensagens de avaliação
    let allEvalMessages = []
    try {
      allEvalMessages = app.findRecordsByFilter(
        'pos_venda_messages',
        'tipo = "avaliacao_satisfacao" || tipo = "avaliacao_tecnico" || tipo = "avaliacao_google"',
        'created',
        1000,
        0,
      )
    } catch (_) {
      return
    }

    if (!allEvalMessages || allEvalMessages.length === 0) {
      return
    }

    const posVendaCol = app.findCollectionByNameOrId('pos_venda_messages')

    // 2) Agrupa mensagens por service_order
    const byOrder = {}
    for (const msg of allEvalMessages) {
      const soId = msg.getString('service_order')
      if (!soId) continue
      if (!byOrder[soId]) byOrder[soId] = []
      byOrder[soId].push(msg)
    }

    const nowIso = new Date().toISOString()

    for (const soId in byOrder) {
      const msgs = byOrder[soId]

      // Se já existe card unificado de satisfação para esta OS, ignora
      const hasSatisfacao = msgs.some((m) => m.getString('tipo') === 'avaliacao_satisfacao')
      if (hasSatisfacao) {
        continue
      }

      // Encontra legados pendentes
      const pendingLegacy = msgs.filter((m) => {
        const t = m.getString('tipo')
        const s = m.getString('status')
        return (t === 'avaliacao_tecnico' || t === 'avaliacao_google') && s === 'pending'
      })

      if (pendingLegacy.length === 0) {
        continue
      }

      const refMsg = pendingLegacy[0]
      const custId = refMsg.getString('customer')
      let custName = 'Cliente'
      let phone = ''
      let soNumber = ''
      let techName = 'nossa equipe técnica'

      // Busca dados do cliente para humanizar mensagem
      if (custId) {
        try {
          const custRec = app.findFirstRecordByData('customers', 'id', custId)
          custName =
            custRec.getString('name') ||
            custRec.getString('razao_social') ||
            custRec.getString('nome_fantasia') ||
            'Cliente'
          phone = custRec.getString('celular') || custRec.getString('telefone') || ''
        } catch (_) {}
      }

      // Busca dados da OS e do técnico
      try {
        const soRec = app.findFirstRecordByData('service_orders', 'id', soId)
        soNumber = soRec.getString('number') || ''
        const techId = soRec.getString('technician')
        if (techId) {
          try {
            const techRec = app.findFirstRecordByData('users', 'id', techId)
            const tName = techRec.getString('name')
            if (tName) techName = tName
          } catch (_) {}
        }
      } catch (_) {}

      const firstName = custName.trim().split(' ')[0] || 'Cliente'
      const osText = soNumber ? ` referente à Ordem de Serviço #${soNumber}` : ''
      const textSatisfacao = `Olá, *${firstName}*! Tudo bem? Aqui é da *JUCA INFORMÁTICA* 😊\n\nPassando para saber como ficou o serviço${osText} realizado pelo técnico *${techName}*.\n\nDe *0 a 5*, qual nota você daria para o nosso atendimento e para a qualidade do serviço prestado?\n\nSua opinião é fundamental para continuarmos melhorando! ⭐`

      let waLink = ''
      const cleanPhone = phone.replace(/\D/g, '')
      if (cleanPhone) {
        const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
        waLink = `https://wa.me/${fullPhone}?text=${encodeURIComponent(textSatisfacao)}`
      }

      const isAlreadyResponded = msgs.some(
        (m) => m.getBool('cliente_respondeu') || m.getBool('avaliacoes_liberadas'),
      )

      // Cria a mensagem unificada
      const newRec = new Record(posVendaCol)
      newRec.set('customer', custId)
      newRec.set('service_order', soId)
      newRec.set('tipo', 'avaliacao_satisfacao')
      newRec.set('status', isAlreadyResponded ? 'ready' : 'pending')
      newRec.set('status_funil', 'aguardando_nota')
      newRec.set('scheduled_at', refMsg.getString('scheduled_at') || nowIso)
      newRec.set('texto_gerado', textSatisfacao)
      newRec.set('wa_me_link', waLink)
      newRec.set('channel', 'whatsapp')
      app.save(newRec)

      // Desativa logicamente os pares legados pendentes (status dismissed)
      for (const leg of pendingLegacy) {
        try {
          leg.set('status', 'dismissed')
          leg.set('feedback_cliente', 'Substituído por card unificado de satisfação (0-5)')
          app.save(leg)
        } catch (_) {}
      }
    }
  },
  () => {
    // Reversão não é necessária pois os registros substituídos preservam seu conteúdo original
  },
)
