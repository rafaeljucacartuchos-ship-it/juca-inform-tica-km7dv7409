// Endpoint público para consulta e registro automático de Avaliação de Satisfação (0 a 5)
// GET  /backend/v1/avaliar/{token} -> Retorna dados seguros do atendimento e estado da avaliação
// POST /backend/v1/avaliar/{token} -> Grava nota e feedback na hora, alimenta evaluations, atualiza pos_venda_messages e dispara alertas sem intervenção humana

routerAdd('GET', '/backend/v1/avaliar/{token}', (e) => {
  const token = e.request.pathValue('token')
  if (!token || token.length < 8) {
    return e.json(400, { error: 'Token inválido' })
  }

  let message = null
  try {
    message = $app.findFirstRecordByData('pos_venda_messages', 'token_acesso', token)
  } catch (_) {
    // Fallback: se o token for o próprio id do registro de mensagem
    try {
      message = $app.findRecordById('pos_venda_messages', token)
    } catch (_) {}
  }

  if (!message) {
    return e.json(404, { error: 'Link de avaliação não encontrado ou expirado.' })
  }

  const custId = message.getString('customer')
  const soId = message.getString('service_order')

  let customerName = 'Cliente'
  if (custId) {
    try {
      const cust = $app.findRecordById('customers', custId)
      customerName =
        cust.getString('nome_fantasia') ||
        cust.getString('razao_social') ||
        cust.getString('name') ||
        'Cliente'
    } catch (_) {}
  }

  let so = null
  let technicianName = ''
  if (soId) {
    try {
      const soRecord = $app.findRecordById('service_orders', soId)
      so = {
        id: soRecord.id,
        number: soRecord.getString('number') || '',
        equipment: soRecord.getString('equipment') || '',
      }

      const techId = soRecord.getString('technician')
      if (techId) {
        try {
          const techRecord = $app.findRecordById('users', techId)
          technicianName = techRecord.getString('name') || ''
        } catch (_) {}
      }
    } catch (_) {}
  }

  // Google review link configured in system settings
  let googleReviewUrl = 'https://g.page/r/CfKb0UxVRFNsEAI/review'
  try {
    const setRecord = $app.findFirstRecordByData('settings', 'key', 'google_review_url')
    if (setRecord && setRecord.getString('value')) {
      googleReviewUrl = setRecord.getString('value').trim()
    }
  } catch (_) {}

  // Verifica se já foi avaliado
  const jaAvaliado =
    typeof message.get('nota_avaliacao') === 'number' && message.getInt('nota_avaliacao') >= 0

  return e.json(200, {
    id: message.id,
    token: message.getString('token_acesso') || message.id,
    customerName,
    firstName: customerName.trim().split(/\s+/)[0] || 'Cliente',
    orderNumber: so ? so.number : '',
    equipment: so ? so.equipment : '',
    technicianName,
    jaAvaliado,
    nota: jaAvaliado ? message.getInt('nota_avaliacao') : null,
    statusFunil: message.getString('status_funil') || 'aguardando_nota',
    googleReviewUrl,
  })
})

routerAdd('POST', '/backend/v1/avaliar/{token}', (e) => {
  const token = e.request.pathValue('token')
  if (!token || token.length < 8) {
    return e.json(400, { error: 'Token inválido' })
  }

  let message = null
  try {
    message = $app.findFirstRecordByData('pos_venda_messages', 'token_acesso', token)
  } catch (_) {
    try {
      message = $app.findRecordById('pos_venda_messages', token)
    } catch (_) {}
  }

  if (!message) {
    return e.json(404, { error: 'Link de avaliação não encontrado ou expirado.' })
  }

  // Proteção: verificar se já avaliou
  const currentNota = message.get('nota_avaliacao')
  if (typeof currentNota === 'number' && currentNota >= 0 && message.getBool('cliente_respondeu')) {
    return e.json(200, {
      alreadyEvaluated: true,
      nota: currentNota,
      statusFunil: message.getString('status_funil'),
      message: 'Esta avaliação já foi registrada anteriormente. Muito obrigado!',
    })
  }

  const body = e.requestInfo().body || {}
  const notaRaw = body.nota
  if (notaRaw === undefined || notaRaw === null || isNaN(Number(notaRaw))) {
    return e.json(400, { error: 'Nota é obrigatória (0 a 5).' })
  }

  const nota = Math.max(0, Math.min(5, Math.round(Number(notaRaw))))
  const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : ''

  const isSatisfied = nota >= 4
  const statusFunil = isSatisfied ? 'google_sugerido' : 'critica_contato_pendente'
  const nowIso = new Date().toISOString()

  // 1) Atualiza a mensagem no funil de pós-venda
  message.set('nota_avaliacao', nota)
  message.set('status_funil', statusFunil)
  message.set('cliente_respondeu', true)
  message.set('cliente_respondeu_em', nowIso)
  if (feedback) {
    message.set('feedback_cliente', feedback)
  }
  $app.save(message)

  const soId = message.getString('service_order')
  const custId = message.getString('customer')

  let customerName = 'Cliente'
  let rawPhone = ''
  if (custId) {
    try {
      const cust = $app.findRecordById('customers', custId)
      customerName =
        cust.getString('nome_fantasia') ||
        cust.getString('razao_social') ||
        cust.getString('name') ||
        'Cliente'
      rawPhone = cust.getString('celular') || cust.getString('phone') || ''
    } catch (_) {}
  }

  let soNumber = ''
  let techId = ''
  if (soId) {
    try {
      const soRecord = $app.findRecordById('service_orders', soId)
      soNumber = soRecord.getString('number') || ''
      techId = soRecord.getString('technician') || ''
    } catch (_) {}
  }

  // 2) Grava na coleção 'evaluations' para refletir no Relatório de Avaliações
  if (soId) {
    try {
      let satisfaction = 'excelente'
      if (nota >= 5) satisfaction = 'excelente'
      else if (nota === 4) satisfaction = 'bom'
      else if (nota >= 2) satisfaction = 'pode_melhorar'
      else satisfaction = 'nao_gostei'

      const existingEvals = $app.findRecordsByFilter(
        'evaluations',
        'service_order = "' + soId + '"',
        '-created',
        1,
        0,
      )

      const evalRating = Math.max(1, Math.min(5, nota === 0 ? 1 : nota))
      const autoComment =
        feedback ||
        (nota <= 3 ? 'Avaliação pós-venda: Nota ' + nota + '/5 registrada via link público.' : '')

      if (existingEvals && existingEvals.length > 0) {
        const ev = existingEvals[0]
        ev.set('rating', evalRating)
        ev.set('satisfaction', satisfaction)
        ev.set('feedback', autoComment)
        if (techId) {
          ev.set('technician', techId)
        }
        $app.save(ev)
      } else {
        const evalCol = $app.findCollectionByNameOrId('evaluations')
        const newEv = new Record(evalCol)
        newEv.set('service_order', soId)
        if (techId) {
          newEv.set('technician', techId)
        }
        newEv.set('rating', evalRating)
        newEv.set('satisfaction', satisfaction)
        newEv.set('feedback', autoComment)
        $app.save(newEv)
      }
    } catch (evalErr) {
      $app.logger().error('Juquinha: Erro ao registrar evaluation', 'error', String(evalErr))
    }
  }

  // 3) Se for crítica (nota 0 a 3), dispara notificação imediata para admin/atendentes
  if (!isSatisfied) {
    try {
      const notifCol = $app.findCollectionByNameOrId('notifications')
      const osLabel = soNumber ? 'OS #' + soNumber : 'O.S.'
      const notifTitle = '⚠️ Crítica de Pós-venda: Nota ' + nota + ' na ' + osLabel
      const notifMsg =
        customerName +
        (rawPhone ? ' (' + rawPhone + ')' : '') +
        ' avaliou com nota ' +
        nota +
        '/5 na ' +
        osLabel +
        '. Contato telefônico imediato requerido antes de avaliação pública!'

      const staffUsers = $app.findRecordsByFilter(
        'users',
        'role = "admin" || role = "attendant"',
        '',
        50,
        0,
      )

      for (let i = 0; i < staffUsers.length; i++) {
        const u = staffUsers[i]
        const nRec = new Record(notifCol)
        nRec.set('user', u.id)
        nRec.set('title', notifTitle)
        nRec.set('message', notifMsg)
        nRec.set('type', 'service_order')
        nRec.set('read', false)
        nRec.set('link', '/pos-venda')
        $app.save(nRec)
      }
    } catch (notifErr) {
      $app
        .logger()
        .error('Juquinha: Erro ao enviar notificação de crítica', 'error', String(notifErr))
    }
  }

  // Google review link configured
  let googleReviewUrl = 'https://g.page/r/CfKb0UxVRFNsEAI/review'
  try {
    const setRecord = $app.findFirstRecordByData('settings', 'key', 'google_review_url')
    if (setRecord && setRecord.getString('value')) {
      googleReviewUrl = setRecord.getString('value').trim()
    }
  } catch (_) {}

  return e.json(200, {
    success: true,
    nota,
    statusFunil,
    isSatisfied,
    googleReviewUrl,
    customerName,
    orderNumber: soNumber,
    message: isSatisfied
      ? 'Nota registrada com sucesso! Muito obrigado pelo carinho!'
      : 'Nota registrada com sucesso. Agradecemos pelo feedback sincero e entraremos em contato!',
  })
})
