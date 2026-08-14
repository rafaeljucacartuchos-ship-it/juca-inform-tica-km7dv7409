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
      customer = {
        name: cust.getString('name'),
        phone: cust.getString('phone'),
        email: cust.getString('email'),
        street: cust.getString('street'),
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
    evaluation: evaluation,
  }

  return e.json(200, response)
})
