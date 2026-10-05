onRecordCreate((e) => {
  var existingNumber = e.record.getString('number')
  if (existingNumber && existingNumber.trim()) {
    return e.next()
  }

  // 1. Extrair o maior sufixo numérico existente de todos os service_order_number já cadastrados
  var maxNum = 0
  try {
    // Busca registros ordenados por número decrescente ou criados recentemente
    var records = $app.findRecordsByFilter('service_orders', "number != ''", '-created', 500, 0)
    var regex = /OS-(\d+)/i
    for (var i = 0; i < records.length; i++) {
      var numStr = records[i].getString('number')
      if (numStr) {
        var match = numStr.match(regex)
        if (match && match[1]) {
          var val = parseInt(match[1], 10)
          if (!isNaN(val) && val > maxNum) {
            maxNum = val
          }
        }
      }
    }
  } catch (err) {
    // Fallback: se a busca falhar, tenta usar a contagem
    try {
      maxNum = $app.countRecords('service_orders')
    } catch (_) {
      maxNum = 0
    }
  }

  // 2. Garante que nunca é inferior à contagem total
  try {
    var totalCount = $app.countRecords('service_orders')
    if (totalCount > maxNum) {
      maxNum = totalCount
    }
  } catch (_) {}

  // 3. Incrementa e verifica se o número gerado está realmente livre
  var candidateNum = maxNum + 1
  var foundFree = false
  var attempts = 0
  var maxAttempts = 50

  while (!foundFree && attempts < maxAttempts) {
    attempts++
    var pad = String(candidateNum).padStart(4, '0')
    var candidateFormatted = 'OS-' + pad

    try {
      var existing = $app.findFirstRecordByData('service_orders', 'number', candidateFormatted)
      if (existing && existing.id) {
        // Já existe esse número, tenta o próximo
        candidateNum++
      } else {
        foundFree = true
        e.record.set('number', candidateFormatted)
      }
    } catch (_) {
      // findFirstRecordByData lança se não encontrar ("sql: no rows in result set")
      // Portanto, o número está livre!
      foundFree = true
      e.record.set('number', candidateFormatted)
    }
  }

  if (!foundFree) {
    // Fallback de segurança se exceder as tentativas
    var fallbackPad = String(candidateNum).padStart(4, '0')
    e.record.set('number', 'OS-' + fallbackPad)
  }

  e.next()
}, 'service_orders')

// Criação opcional: OS e vínculo são confirmados juntos, somente por ação explícita.
routerAdd(
  'POST',
  '/api/juca/orcamentos/{id}/criar-os',
  (e) => {
    var info = e.requestInfo()
    var quoteId = e.request.pathValue('id')
    var result
    e.app.runInTransaction((tx) => {
      var quote = tx.findRecordById('orcamentos', quoteId)
      if (
        !tx.canAccessRecord(quote, info, quote.collection().viewRule) ||
        !tx.canAccessRecord(quote, info, quote.collection().updateRule)
      ) {
        throw new ForbiddenError('Sem permissão para este orçamento.')
      }
      var linkedId = quote.getString('id_os')
      if (linkedId) {
        var linked = tx.findRecordById('service_orders', linkedId)
        if (!tx.canAccessRecord(linked, info, linked.collection().viewRule)) {
          throw new ForbiddenError('Sem permissão para a OS vinculada.')
        }
        result = { id: linked.id, number: linked.getString('number'), alreadyLinked: true }
        return
      }
      if (quote.getString('status') !== 'aprovado') {
        throw new BadRequestError('Aprove o orçamento antes de abrir uma OS.')
      }
      var customerId = quote.getString('cliente_id')
      if (!customerId)
        throw new BadRequestError('Selecione e salve o cliente no orçamento primeiro.')
      var customer = tx.findRecordById('customers', customerId)
      if (!tx.canAccessRecord(customer, info, customer.collection().viewRule)) {
        throw new ForbiddenError('Sem permissão para o cliente deste orçamento.')
      }
      var orderCollection = tx.findCollectionByNameOrId('service_orders')
      var itemCollection = tx.findCollectionByNameOrId('service_order_items')
      if (orderCollection.createRule === null || itemCollection.createRule === null) {
        throw new ForbiddenError('Criação de OS ou itens indisponível para este acesso.')
      }
      var orders = tx.findRecordsByFilter('service_orders', 'number != ""', '', 0, 0)
      var maxNumber = 0
      for (var existing of orders) {
        var match = existing.getString('number').match(/^OS-(\d+)$/i)
        if (match) maxNumber = Math.max(maxNumber, Number(match[1]))
      }
      var order = new Record(orderCollection)
      var orderData = {
        number: 'OS-' + String(maxNumber + 1).padStart(4, '0'),
        customer: customerId,
        technician: quote.getString('responsavel_id'),
        status: 'orcamento_aprovado',
        priority: 'medium',
        title: 'Serviço do orçamento ' + quote.getString('numero_orcamento'),
        description: quote.getString('defeito_independente'),
        equipment: quote.getString('equipamento_independente'),
        notes:
          'Origem: orçamento ' +
          quote.getString('numero_orcamento') +
          '\n' +
          quote.getString('observacoes'),
        desconto: quote.getFloat('desconto_total_valor'),
        acrescimo: 0,
        total: quote.getFloat('total_geral'),
      }
      for (var key in orderData) order.set(key, orderData[key])
      tx.save(order)
      info.body = orderData
      if (!tx.canAccessRecord(order, info, orderCollection.createRule)) {
        throw new ForbiddenError('Sem permissão para criar esta OS.')
      }
      var items = tx.findRecordsByFilter('orcamento_itens', 'id_orcamento = {:quote}', '', 0, 0, {
        quote: quote.id,
      })
      for (var source of items) {
        if (!tx.canAccessRecord(source, info, source.collection().viewRule)) {
          throw new ForbiddenError('Sem permissão para os itens deste orçamento.')
        }
        var item = new Record(itemCollection)
        var itemData = {
          service_order: order.id,
          description: source.getString('descricao'),
          quantity: source.getFloat('quantidade'),
          unit_price: source.getFloat('valor_unitario'),
          total: source.getFloat('valor_total_item'),
          product: source.getString('id_produto'),
        }
        for (var field in itemData) item.set(field, itemData[field])
        tx.save(item)
        info.body = itemData
        if (!tx.canAccessRecord(item, info, itemCollection.createRule)) {
          throw new ForbiddenError('Sem permissão para criar os itens da OS.')
        }
      }
      info.body = { id_os: order.id }
      quote.set('id_os', order.id)
      tx.save(quote)
      if (!tx.canAccessRecord(quote, info, quote.collection().updateRule)) {
        throw new ForbiddenError('Sem permissão para vincular esta OS.')
      }
      result = { id: order.id, number: order.getString('number'), alreadyLinked: false }
    })
    return e.json(200, result)
  },
  $apis.requireAuth('users'),
)

// Estrutura aditiva do dossiê; executada somente se ainda não estiver instalada.
onBootstrap((e) => {
  e.next()
  var col = e.app.findCollectionByNameOrId('rental_documents')
  if (col.fields.getByName('file') && col.fields.getByName('uploaded_by')) return
  var contracts = e.app.findCollectionByNameOrId('rental_contracts')
  var users = e.app.findCollectionByNameOrId('users')
  col.fields.add(
    new RelationField({
      name: 'contract',
      collectionId: contracts.id,
      maxSelect: 1,
      required: true,
      cascadeDelete: false,
    }),
  )
  col.fields.add(
    new FileField({
      name: 'file',
      required: true,
      maxSelect: 1,
      maxSize: 20971520,
      protected: true,
      mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    }),
  )
  col.fields.add(new TextField({ name: 'title', required: true, max: 180 }))
  col.fields.add(
    new SelectField({
      name: 'category',
      required: true,
      maxSelect: 1,
      values: ['contrato_assinado', 'documento_cliente', 'aditivo_assinado', 'entrega', 'outro'],
    }),
  )
  col.fields.add(
    new RelationField({
      name: 'uploaded_by',
      collectionId: users.id,
      maxSelect: 1,
      required: true,
      cascadeDelete: false,
    }),
  )
  col.listRule = "@request.auth.role = 'admin' && @request.auth.ativo = true"
  col.viewRule = col.listRule
  col.createRule = col.listRule + ' && @request.body.uploaded_by = @request.auth.id'
  col.updateRule = null
  col.deleteRule = null
  col.addIndex('idx_rental_documents_contract', false, 'contract', '')
  e.app.save(col)
})
