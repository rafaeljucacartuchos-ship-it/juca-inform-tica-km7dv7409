routerAdd('GET', '/backend/v1/os/{id}/share', (e) => {
  const id = e.request.pathValue('id')

  let record
  try {
    record = $app.findRecordById('service_orders', id)
  } catch (_) {
    return e.json(404, { error: 'Ordem de serviço não encontrada' })
  }

  let customer = null
  try {
    const custId = record.getString('customer')
    if (custId) {
      const cust = $app.findRecordById('customers', custId)
      const razao = cust.getString('razao_social')
      const fantasia = cust.getString('nome_fantasia')
      const legacyName = cust.getString('name')
      const celular = cust.getString('celular')
      const legacyPhone = cust.getString('phone')
      const endereco = cust.getString('endereco')
      const bairro = cust.getString('bairro')
      const legacyStreet = cust.getString('street')

      customer = {
        name: razao || fantasia || legacyName || '',
        razao_social: razao,
        nome_fantasia: fantasia,
        phone: celular || legacyPhone || '',
        celular: celular || legacyPhone || '',
        endereco: endereco || legacyStreet || '',
        bairro: bairro,
        cpf_cnpj: cust.getString('cpf_cnpj'),
        rg_ie: cust.getString('rg_ie'),
        email: cust.getString('email'),
        street: endereco || legacyStreet || '',
        number: cust.getString('number'),
        city: cust.getString('city'),
        state: cust.getString('state'),
        zip: cust.getString('zip'),
      }
    }
  } catch (_) {}

  let technician = null
  try {
    const techId = record.getString('technician')
    if (techId) {
      const tech = $app.findRecordById('users', techId)
      technician = {
        id: tech.id,
        name: tech.getString('name'),
        phone: tech.getString('phone'),
      }
    }
  } catch (_) {}

  let attendanceType = null
  try {
    const attTypeId = record.getString('attendance_type')
    if (attTypeId) {
      const attT = $app.findRecordById('service_types', attTypeId)
      attendanceType = {
        id: attT.id,
        name: attT.getString('name'),
      }
    }
  } catch (_) {}

  let equipmentRef = null
  try {
    const eqId = record.getString('equipment_ref')
    if (eqId) {
      const eq = $app.findRecordById('equipment', eqId)
      let eqPhotos = []
      try {
        eqPhotos = eq.get('photos') || []
      } catch (_) {}
      equipmentRef = {
        id: eq.id,
        name: eq.getString('name'),
        type: eq.getString('type'),
        brand: eq.getString('brand'),
        model: eq.getString('model'),
        serial_number: eq.getString('serial_number'),
        notes: eq.getString('notes'),
        photos: Array.isArray(eqPhotos) ? eqPhotos : eqPhotos ? [eqPhotos] : [],
      }
    }
  } catch (_) {}

  // Busca orçamento vinculado ativo
  let orcamento = null
  let orcamentoItens = []
  let orcamentoAnexos = []
  try {
    const orcs = $app.findRecordsByFilter('orcamentos', 'id_os = "' + id + '"', '-created', 1, 0)
    if (orcs && orcs.length > 0) {
      const o = orcs[0]
      orcamento = {
        id: o.id,
        numero_orcamento: o.getString('numero_orcamento'),
        status: o.getString('status'),
        validade: o.getInt('validade') || 15,
        observacoes: o.getString('observacoes'),
        forma_pagamento: o.getString('forma_pagamento'),
        parcelas: o.getInt('parcelas') || 1,
        entrada: o.getFloat('entrada') || 0,
        restante: o.getFloat('restante') || 0,
        subtotal: o.getFloat('subtotal') || 0,
        desconto_total_valor: o.getFloat('desconto_total_valor') || 0,
        desconto_total_tipo: o.getString('desconto_total_tipo'),
        desconto_total_percentual: o.getFloat('desconto_total_percentual') || 0,
        total_geral: o.getFloat('total_geral') || 0,
        assinatura_cliente: o.getString('assinatura_cliente'),
        assinatura_tecnico: o.getString('assinatura_tecnico'),
        data_assinatura_cliente: o.getString('data_assinatura_cliente'),
        data_assinatura_tecnico: o.getString('data_assinatura_tecnico'),
        token_acesso: o.getString('token_acesso'),
      }

      try {
        const oItList = $app.findRecordsByFilter(
          'orcamento_itens',
          'id_orcamento = "' + o.id + '"',
          'created',
          100,
          0,
        )
        orcamentoItens = oItList.map(function (it) {
          return {
            id: it.id,
            id_orcamento: o.id,
            tipo: it.getString('tipo'),
            descricao: it.getString('descricao'),
            quantidade: it.getFloat('quantidade') || 1,
            valor_unitario: it.getFloat('valor_unitario') || 0,
            desconto_item: it.getFloat('desconto_item') || 0,
            desconto_item_tipo: it.getString('desconto_item_tipo'),
            valor_total_item: it.getFloat('valor_total_item') || 0,
          }
        })
      } catch (_) {}

      try {
        const oAnList = $app.findRecordsByFilter(
          'orcamento_anexos',
          'id_orcamento = "' + o.id + '"',
          'created',
          50,
          0,
        )
        orcamentoAnexos = oAnList.map(function (an) {
          return {
            id: an.id,
            id_orcamento: o.id,
            tipo: an.getString('tipo'),
            caminho_arquivo: an.getString('caminho_arquivo'),
            legenda: an.getString('legenda'),
          }
        })
      } catch (_) {}
    }
  } catch (_) {}

  let items = []
  try {
    items = $app.findRecordsByFilter(
      'service_order_items',
      'service_order = "' + id + '"',
      'created',
      100,
      0,
    )
  } catch (_) {}

  let payments = []
  try {
    payments = $app.findRecordsByFilter(
      'payments',
      'service_order = "' + id + '"',
      '-created',
      100,
      0,
    )
  } catch (_) {}

  let statusHistory = []
  try {
    const shList = $app.findRecordsByFilter(
      'status_history',
      'service_order = "' + id + '"',
      'created',
      200,
      0,
    )
    for (var i = 0; i < shList.length; i++) {
      var h = shList[i]
      var cbName = ''
      try {
        var cbId = h.getString('changed_by')
        if (cbId) {
          var u = $app.findRecordById('users', cbId)
          cbName = u.getString('name')
        }
      } catch (_) {}
      statusHistory.push({
        status: h.getString('status'),
        note: h.getString('note'),
        changed_by: cbName,
        created: h.getString('created'),
      })
    }
  } catch (_) {}

  let attachments = []
  try {
    attachments = $app.findRecordsByFilter(
      'service_attachments',
      'service_order = "' + id + '"',
      'created',
      200,
      0,
    )
  } catch (_) {}

  let evaluation = null
  try {
    const evals = $app.findRecordsByFilter(
      'evaluations',
      'service_order = "' + id + '"',
      '-created',
      1,
      0,
    )
    if (evals && evals.length > 0) {
      const ev = evals[0]
      evaluation = {
        id: ev.id,
        rating: ev.get('rating'),
        satisfaction: ev.getString('satisfaction'),
        feedback: ev.getString('feedback'),
        created: ev.getString('created'),
      }
    }
  } catch (_) {}

  const response = {
    id: record.id,
    number: record.getString('number'),
    status: record.getString('status'),
    priority: record.getString('priority'),
    title: record.getString('title'),
    description: record.getString('description'),
    equipment: record.getString('equipment'),
    diagnostic: record.getString('diagnostic'),
    service_report: record.getString('service_report'),
    total: record.get('total') || 0,
    created: record.getString('created'),
    customer_signature: record.getString('customer_signature'),
    technician_signature: record.getString('technician_signature'),
    customer: customer,
    technician: technician,
    items: items.map(function (item) {
      return {
        description: item.getString('description'),
        quantity: item.get('quantity') || 0,
        unit_price: item.get('unit_price') || 0,
        total: item.get('total') || 0,
      }
    }),
    payments: payments.map(function (p) {
      return {
        amount: p.get('amount') || 0,
        method: p.getString('method'),
        status: p.getString('status'),
      }
    }),
    status_history: statusHistory,
    attachments: attachments.map(function (a) {
      return {
        id: a.id,
        file: a.getString('file'),
        caption: a.getString('caption'),
      }
    }),
    attendance_date: record.getString('attendance_date'),
    attendance_time: record.getString('attendance_time'),
    started_at: record.getString('started_at'),
    equipment_ref: record.getString('equipment_ref'),
    desconto: record.getFloat('desconto') || 0,
    acrescimo: record.getFloat('acrescimo') || 0,
    attendance_type_data: attendanceType,
    equipment_data: equipmentRef,
    orcamento: orcamento,
    orcamento_itens: orcamentoItens,
    orcamento_anexos: orcamentoAnexos,
    evaluation: evaluation,
  }

  return e.json(200, response)
})
