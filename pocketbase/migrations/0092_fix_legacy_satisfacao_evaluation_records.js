migrate(
  (app) => {
    // 1) Busca registros de avaliacao_satisfacao cujo wa_me_link ainda não contenha /avaliar/
    let records = []
    try {
      records = app.findRecordsByFilter(
        'pos_venda_messages',
        'tipo = "avaliacao_satisfacao" && (wa_me_link !~ "/avaliar/" || token_acesso = null || token_acesso = "")',
        'created',
        500,
        0,
      )
    } catch (_) {
      return
    }

    if (!records || records.length === 0) {
      return
    }

    for (const rec of records) {
      let token = rec.getString('token_acesso')
      if (!token) {
        token = $security.randomString(32)
        rec.set('token_acesso', token)
      }

      const custId = rec.getString('customer')
      const soId = rec.getString('service_order')

      let custName = 'Cliente'
      let phone = ''
      let soNumber = ''
      let techName = 'nossa equipe técnica'

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

      if (soId) {
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
      }

      const firstName = custName.trim().split(/\s+/)[0] || 'Cliente'
      const tech = techName.trim() || 'da nossa equipe técnica'
      const osLabel = soNumber.trim() ? soNumber.trim() : 'sua O.S.'
      const evalPath = `/avaliar/${token}`

      // Mensagem oficial do funil de satisfação (buildAvaliacaoSatisfacaoMessage)
      const textSatisfacao =
        `🔧 *JUCA CARTUCHOS E INFORMÁTICA*\n\n` +
        `Oi, ${firstName}! *Juquinha* aqui de novo! 😊\n\n` +
        `Seu equipamento foi atendido pelo técnico ${tech} e encerramos a O.S. ${osLabel} hoje.\n\n` +
        `*De 0 a 5, como você avalia o atendimento que recebeu?*\n\n` +
        `Toque na sua nota aqui 👉 ${evalPath}\n\n` +
        `Qualquer dúvida, estamos sempre à disposição!`

      let waLink = ''
      const cleanPhone = phone.replace(/\D/g, '')
      if (cleanPhone) {
        const fullPhone = cleanPhone.startsWith('55')
          ? cleanPhone
          : cleanPhone.startsWith('0')
            ? '55' + cleanPhone.substring(1)
            : '55' + cleanPhone
        waLink = `https://wa.me/${fullPhone}?text=${encodeURIComponent(textSatisfacao)}`
      } else {
        waLink = `https://wa.me/?text=${encodeURIComponent(textSatisfacao)}`
      }

      rec.set('texto_gerado', textSatisfacao)
      rec.set('wa_me_link', waLink)
      app.save(rec)
    }
  },
  () => {
    // Reversão vazia - os textos preservam o padrão do funil
  },
)
