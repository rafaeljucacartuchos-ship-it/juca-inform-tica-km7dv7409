routerAdd('GET', '/backend/v1/proposta/{token}', (e) => {
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

  // Busca dados da O.S.
  let os = null
  let customer = null
  let technician = null
  let equipment = null

  try {
    const osId = orcamento.getString('id_os')
    if (osId) {
      const osRecord = $app.findRecordById('service_orders', osId)
      os = {
        id: osRecord.id,
        number: osRecord.getString('number'),
        title: osRecord.getString('title'),
        description: osRecord.getString('description'),
        equipment: osRecord.getString('equipment'),
        status: osRecord.getString('status'),
        diagnostic: osRecord.getString('diagnostic'),
        service_report: osRecord.getString('service_report'),
        notes: osRecord.getString('notes'),
        priority: osRecord.getString('priority'),
        created: osRecord.getString('created'),
        attendance_date: osRecord.getString('attendance_date'),
        attendance_time: osRecord.getString('attendance_time'),
        started_at: osRecord.getString('started_at'),
      }

      // Cliente da OS
      const custId = osRecord.getString('customer')
      if (custId) {
        try {
          const custRecord = $app.findRecordById('customers', custId)
          customer = {
            id: custRecord.id,
            name:
              custRecord.getString('razao_social') ||
              custRecord.getString('nome_fantasia') ||
              custRecord.getString('name') ||
              '',
            phone: custRecord.getString('celular') || custRecord.getString('phone') || '',
            cpf_cnpj: custRecord.getString('cpf_cnpj') || '',
            street: custRecord.getString('endereco') || custRecord.getString('street') || '',
            number: custRecord.getString('number') || '',
            city: custRecord.getString('city') || '',
            state: custRecord.getString('state') || '',
          }
        } catch (_) {}
      }

      // Técnico da OS
      const techId = osRecord.getString('technician')
      if (techId) {
        try {
          const techRecord = $app.findRecordById('users', techId)
          technician = {
            id: techRecord.id,
            name: techRecord.getString('name') || '',
          }
        } catch (_) {}
      }

      // Equipamento ref
      const eqId = osRecord.getString('equipment_ref')
      if (eqId) {
        try {
          const eqRecord = $app.findRecordById('equipment', eqId)
          equipment = {
            id: eqRecord.id,
            name: eqRecord.getString('name') || '',
            brand: eqRecord.getString('brand') || '',
            model: eqRecord.getString('model') || '',
            type: eqRecord.getString('type') || '',
          }
        } catch (_) {}
      }
    } else {
      // Orçamento independente (sem OS):
      // Cliente (cadastrado ou livre)
      const directCustId = orcamento.getString('cliente_id')
      if (directCustId) {
        try {
          const custRecord = $app.findRecordById('customers', directCustId)
          customer = {
            id: custRecord.id,
            name:
              custRecord.getString('razao_social') ||
              custRecord.getString('nome_fantasia') ||
              custRecord.getString('name') ||
              '',
            phone: custRecord.getString('celular') || custRecord.getString('phone') || '',
            cpf_cnpj: custRecord.getString('cpf_cnpj') || '',
            street: custRecord.getString('endereco') || custRecord.getString('street') || '',
            number: custRecord.getString('number') || '',
            city: custRecord.getString('city') || '',
            state: custRecord.getString('state') || '',
          }
        } catch (_) {}
      } else {
        const nomeLivre = orcamento.getString('nome_cliente_livre')
        const telLivre = orcamento.getString('telefone_cliente_livre')
        if (nomeLivre || telLivre) {
          customer = {
            id: '',
            name: nomeLivre || 'Cliente',
            phone: telLivre || '',
          }
        }
      }

      // Responsável (técnico ou vendedor) do orçamento independente
      const respId =
        orcamento.getString('responsavel_id') || orcamento.getString('id_usuario_criador')
      if (respId) {
        try {
          const respRecord = $app.findRecordById('users', respId)
          technician = {
            id: respRecord.id,
            name: respRecord.getString('name') || '',
          }
        } catch (_) {}
      }

      // Equipamento e defeito independentes opcionais
      const eqIndep = orcamento.getString('equipamento_independente')
      const defIndep = orcamento.getString('defeito_independente')
      if (eqIndep) {
        equipment = {
          id: '',
          name: eqIndep,
          brand: '',
          model: '',
          type: 'other',
        }
      }
      if (eqIndep || defIndep) {
        os = {
          id: '',
          number: '',
          title: 'Orçamento Independente',
          description: defIndep || '',
          equipment: eqIndep || '',
          status: '',
        }
      }
    }
  } catch (_) {}

  // Itens do orçamento
  let items = []
  try {
    const itemRecords = $app.findRecordsByFilter(
      'orcamento_itens',
      'id_orcamento = "' + orcamento.id + '"',
      'created',
      200,
      0,
    )
    items = itemRecords.map((it) => {
      return {
        id: it.id,
        tipo: it.getString('tipo'),
        descricao: it.getString('descricao'),
        quantidade: it.getFloat('quantidade'),
        valor_unitario: it.getFloat('valor_unitario'),
        desconto_item: it.getFloat('desconto_item'),
        desconto_item_tipo: it.getString('desconto_item_tipo'),
        valor_total_item: it.getFloat('valor_total_item'),
      }
    })
  } catch (_) {}

  // Anexos / fotos do orçamento
  let anexos = []
  try {
    const anexoRecords = $app.findRecordsByFilter(
      'orcamento_anexos',
      'id_orcamento = "' + orcamento.id + '"',
      'created',
      100,
      0,
    )
    anexos = anexoRecords.map((an) => {
      const fileName = an.getString('caminho_arquivo')
      // URL para download do PocketBase: /api/files/orcamento_anexos/<id>/<filename>
      const url = '/api/files/' + an.collection().id + '/' + an.id + '/' + fileName
      return {
        id: an.id,
        tipo: an.getString('tipo'),
        legenda: an.getString('legenda'),
        caminho_arquivo: fileName,
        url: url,
      }
    })
  } catch (_) {}

  // Assinatura do cliente existente (se houver)
  let assinaturaClienteUrl = null
  const assCli = orcamento.getString('assinatura_cliente')
  if (assCli) {
    assinaturaClienteUrl =
      '/api/files/' + orcamento.collection().id + '/' + orcamento.id + '/' + assCli
  }

  // Assinatura do técnico existente (se houver)
  let assinaturaTecnicoUrl = null
  const assTec = orcamento.getString('assinatura_tecnico')
  if (assTec) {
    assinaturaTecnicoUrl =
      '/api/files/' + orcamento.collection().id + '/' + orcamento.id + '/' + assTec
  }

  const result = {
    id: orcamento.id,
    token_acesso: token,
    numero_orcamento: orcamento.getString('numero_orcamento'),
    status: orcamento.getString('status'),
    validade: orcamento.getInt('validade'),
    observacoes: orcamento.getString('observacoes'),
    created: orcamento.getString('created'),
    updated: orcamento.getString('updated'),
    forma_pagamento: orcamento.getString('forma_pagamento'),
    parcelas: orcamento.getInt('parcelas') || 1,
    entrada: orcamento.getFloat('entrada') || 0,
    restante: orcamento.getFloat('restante') || 0,
    status_pagamento: orcamento.getString('status_pagamento'),
    subtotal: orcamento.getFloat('subtotal') || 0,
    desconto_total_valor: orcamento.getFloat('desconto_total_valor') || 0,
    desconto_total_tipo: orcamento.getString('desconto_total_tipo'),
    desconto_total_percentual: orcamento.getFloat('desconto_total_percentual') || 0,
    total_geral: orcamento.getFloat('total_geral') || 0,
    data_assinatura_cliente: orcamento.getString('data_assinatura_cliente'),
    ip_dispositivo: orcamento.getString('ip_dispositivo'),
    motivo_rejeicao: orcamento.getString('motivo_rejeicao'),
    assinatura_cliente_url: assinaturaClienteUrl,
    assinatura_tecnico_url: assinaturaTecnicoUrl,
    data_assinatura_tecnico: orcamento.getString('data_assinatura_tecnico'),
    has_customer_signature: !!assCli,
    has_technician_signature: !!assTec,
    os: os,
    customer: customer,
    technician: technician,
    equipment: equipment,
    items: items,
    anexos: anexos,
  }

  return e.json(200, result)
})
