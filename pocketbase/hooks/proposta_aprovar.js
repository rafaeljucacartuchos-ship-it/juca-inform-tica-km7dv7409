routerAdd('POST', '/backend/v1/proposta/{token}/aprovar', (e) => {
  const token = e.request.pathValue('token')
  if (!token || token.length < 10) {
    return e.json(400, { error: 'Token inválido' })
  }

  let orcamento
  try {
    orcamento = $app.findFirstRecordByData('orcamentos', 'token_acesso', token)
  } catch (_) {
    return e.json(404, { error: 'Proposta não encontrada' })
  }

  // Idempotência: se já aprovado, retorna sucesso informando a data da aprovação
  const currentStatus = orcamento.getString('status')
  if (currentStatus === 'aprovado' || currentStatus === 'faturado') {
    return e.json(200, {
      alreadyApproved: true,
      status: currentStatus,
      data_assinatura_cliente: orcamento.getString('data_assinatura_cliente'),
      message: 'Proposta já aprovada em ' + (orcamento.getString('data_assinatura_cliente') || ''),
    })
  }

  // Se substituído ou rejeitado, bloqueia aprovação
  if (currentStatus === 'substituido') {
    return e.json(400, {
      error: 'Esta proposta foi substituída por uma nova versão e não pode ser aprovada.',
    })
  }
  if (currentStatus === 'rejeitado') {
    return e.json(400, {
      error: 'Esta proposta consta como rejeitada e não pode ser aprovada.',
    })
  }

  // Verifica validade (se vencido)
  const createdStr = orcamento.getString('created')
  const validadeDias = orcamento.getInt('validade') || 15
  if (createdStr) {
    const createdDate = new Date(createdStr.replace(' ', 'T') + 'Z')
    const now = new Date()
    const diffMs = now.getTime() - createdDate.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffDays > validadeDias) {
      return e.json(400, {
        error:
          'Esta proposta ultrapassou a validade de ' +
          validadeDias +
          ' dias. Entre em contato com a JUCA Informática para atualizá-la.',
      })
    }
  }

  const body = e.requestInfo().body || {}
  let signature = body.signature || ''
  const hasExistingSig = !!orcamento.getString('assinatura_cliente')

  if (!signature && !hasExistingSig) {
    return e.json(400, {
      error: 'Assinatura é obrigatória para aprovar a proposta.',
    })
  }

  // IP do dispositivo
  const clientIp =
    e.request.header.get('x-forwarded-for') ||
    e.request.header.get('cf-connecting-ip') ||
    e.realIP() ||
    ''

  const nowIso = new Date().toISOString()

  // Se foi enviada nova assinatura base64, salva o arquivo
  if (signature) {
    const commaIdx = signature.indexOf(',')
    if (commaIdx >= 0) {
      signature = signature.substring(commaIdx + 1)
    }

    const base64ToByteArray = function (base64String) {
      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      base64String = base64String.replace(/\s/g, '').replace(/=/g, '')
      while (base64String.length % 4 !== 0) {
        base64String += 'A'
      }
      var byteArray = new Uint8Array((base64String.length * 3) / 4)
      var byteIndex = 0
      var charIndex = 0
      while (charIndex < base64String.length) {
        var enc1 = chars.indexOf(base64String.charAt(charIndex++))
        var enc2 = chars.indexOf(base64String.charAt(charIndex++))
        var enc3 = chars.indexOf(base64String.charAt(charIndex++))
        var enc4 = chars.indexOf(base64String.charAt(charIndex++))
        if (enc1 === -1 || enc2 === -1 || enc3 === -1 || enc4 === -1) {
          throw new Error('Caractere inválido na base64 da assinatura')
        }
        var bits24 = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4
        byteArray[byteIndex++] = (bits24 >> 16) & 0xff
        if (enc3 !== 64) {
          byteArray[byteIndex++] = (bits24 >> 8) & 0xff
          if (enc4 !== 64) {
            byteArray[byteIndex++] = bits24 & 0xff
          }
        }
      }
      return byteArray.subarray(0, byteIndex)
    }

    var bytes
    try {
      bytes = base64ToByteArray(signature)
    } catch (_) {
      return e.json(400, { error: 'Assinatura base64 inválida' })
    }

    if (!bytes || bytes.length === 0) {
      return e.json(400, { error: 'Assinatura vazia' })
    }

    var file = $filesystem.fileFromBytes(bytes, 'assinatura_cliente.png')
    orcamento.set('assinatura_cliente', file)
  }

  orcamento.set('status', 'aprovado')
  orcamento.set('data_assinatura_cliente', nowIso)
  if (clientIp) {
    orcamento.set('ip_dispositivo', clientIp.split(',')[0].trim())
  }
  $app.save(orcamento)

  const osId = orcamento.getString('id_os')
  const numOrc = orcamento.getString('numero_orcamento')

  // Aplica efeitos na O.S. (muda status para in_progress e cria status_history)
  let osNumber = ''
  let custName = ''
  let equipName = ''
  let techId = ''

  if (osId) {
    try {
      const osRecord = $app.findRecordById('service_orders', osId)
      osNumber = osRecord.getString('number')
      equipName = osRecord.getString('equipment')
      techId = osRecord.getString('technician')

      osRecord.set('status', 'in_progress')
      $app.save(osRecord)

      // Histórico de status
      const shCol = $app.findCollectionByNameOrId('status_history')
      const shRecord = new Record(shCol)
      shRecord.set('service_order', osId)
      shRecord.set('status', 'in_progress')
      shRecord.set(
        'note',
        'Orçamento ' +
          numOrc +
          ' aprovado e assinado online pelo cliente (IP: ' +
          (clientIp.split(',')[0].trim() || 'remoto') +
          ').',
      )
      $app.save(shRecord)

      // Busca dados do cliente para registrar no pos_venda_messages e notificação
      const custId = osRecord.getString('customer')
      if (custId) {
        try {
          const custRecord = $app.findRecordById('customers', custId)
          custName =
            custRecord.getString('razao_social') ||
            custRecord.getString('nome_fantasia') ||
            custRecord.getString('name') ||
            'Cliente'

          // Registra log do sistema no histórico do cliente (pos_venda_messages)
          const pvmCol = $app.findCollectionByNameOrId('pos_venda_messages')
          const pvmRecord = new Record(pvmCol)
          pvmRecord.set('customer', custId)
          pvmRecord.set('service_order', osId)
          pvmRecord.set('tipo', 'resumo_finalizacao')
          pvmRecord.set('status', 'sent')
          pvmRecord.set('scheduled_at', nowIso)
          pvmRecord.set('sent_at', nowIso)
          pvmRecord.set(
            'texto_gerado',
            'Proposta ' +
              numOrc +
              ' aprovada e assinada online pelo cliente. O.S. #' +
              osNumber +
              ' iniciada.',
          )
          pvmRecord.set('channel', 'sistema')
          $app.save(pvmRecord)

          // Prepara a mensagem de AGRADECIMENTO ao cliente (Juquinha) para disparo automático
          // pelo painel do técnico via WhatsApp (wa.me)
          const rawPhone = custRecord.getString('celular') || custRecord.getString('phone') || ''
          let digits = rawPhone.replace(/\D/g, '')
          if (digits.startsWith('0')) digits = digits.substring(1)
          if (digits && !digits.startsWith('55')) digits = '55' + digits

          const firstName = custName.split(' ')[0] || custName
          const equipPart = equipName ? ' da sua *' + equipName + '*' : ''
          const msgAgradecimento =
            '🛠️ *JUCA CARTUCHOS E INFORMÁTICA*\n\n' +
            'Olá, *' +
            firstName +
            '*! 🎉 Que alegria que a proposta *' +
            numOrc +
            '* foi aprovada!\n\n' +
            'O reparo' +
            equipPart +
            ' já está em boas mãos com a equipe JUCA. Muito obrigado pela confiança — a gente cuida de tudo pra você! 💙\n\n' +
            'Juca Informática\n' +
            '(67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981'

          const waUrl = digits
            ? 'https://wa.me/' + digits + '?text=' + encodeURIComponent(msgAgradecimento)
            : ''

          const pvmAgradecimento = new Record(pvmCol)
          pvmAgradecimento.set('customer', custId)
          pvmAgradecimento.set('service_order', osId)
          pvmAgradecimento.set('tipo', 'resumo_finalizacao')
          // Status 'ready' aguardando disparo automático pelo app do técnico
          pvmAgradecimento.set('status', 'ready')
          pvmAgradecimento.set('scheduled_at', nowIso)
          pvmAgradecimento.set('texto_gerado', msgAgradecimento)
          pvmAgradecimento.set('wa_me_link', waUrl)
          pvmAgradecimento.set('channel', 'whatsapp')
          $app.save(pvmAgradecimento)
        } catch (_) {}
      }
    } catch (_) {}
  }

  // Notificação no sistema para técnicos/atendentes
  try {
    const notifCol = $app.findCollectionByNameOrId('notifications')
    const notifTitle = '🎉 Proposta Aprovada: ' + numOrc
    const notifMsg =
      'O cliente ' +
      (custName || 'do atendimento') +
      ' aprovou e assinou o orçamento ' +
      numOrc +
      ' da O.S. #' +
      osNumber +
      '!'

    // Se temos técnico atribuído, notifica ele diretamente
    if (techId) {
      const nRec = new Record(notifCol)
      nRec.set('user', techId)
      nRec.set('title', notifTitle)
      nRec.set('message', notifMsg)
      nRec.set('type', 'service_order')
      nRec.set('read', false)
      nRec.set('link', '/orcamentos/' + orcamento.id)
      $app.save(nRec)
    }

    // Também cria notificação para os administradores do sistema
    const adminUsers = $app.findRecordsByFilter(
      'users',
      'role = "admin" && id != "' + (techId || '') + '"',
      '',
      10,
      0,
    )
    for (var i = 0; i < adminUsers.length; i++) {
      const aRec = new Record(notifCol)
      aRec.set('user', adminUsers[i].id)
      aRec.set('title', notifTitle)
      aRec.set('message', notifMsg)
      aRec.set('type', 'service_order')
      aRec.set('read', false)
      aRec.set('link', '/orcamentos/' + orcamento.id)
      $app.save(aRec)
    }
  } catch (_) {}

  return e.json(200, {
    success: true,
    status: 'aprovado',
    data_assinatura_cliente: nowIso,
    numero_orcamento: numOrc,
    os_number: osNumber,
    customer_name: custName,
    equipment_name: equipName,
  })
})
