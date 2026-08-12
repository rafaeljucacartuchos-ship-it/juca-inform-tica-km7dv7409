routerAdd('GET', '/backend/v1/os/{id}/share', (e) => {
  const id = e.request.pathValue('id')

  let record
  try {
    record = $app.findRecordById('service_orders', id)
  } catch (_) {
    return e.json(404, { error: 'Ordem de serviço não encontrada' })
  }

  try {
    $app.expandRecord(record, ['customer', 'technician'])
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

  const customer = record.expanded('customer')
  const technician = record.expanded('technician')

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
    customer: customer
      ? {
          name: customer.getString('name'),
          phone: customer.getString('phone'),
          email: customer.getString('email'),
          street: customer.getString('street'),
          number: customer.getString('number'),
          city: customer.getString('city'),
          state: customer.getString('state'),
          zip: customer.getString('zip'),
        }
      : null,
    technician: technician
      ? {
          name: technician.getString('name'),
          phone: technician.getString('phone'),
        }
      : null,
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
  }

  return e.json(200, response)
})
