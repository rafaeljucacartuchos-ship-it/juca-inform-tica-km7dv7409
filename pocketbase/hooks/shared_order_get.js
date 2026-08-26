routerAdd('GET', '/backend/v1/shared-order/{id}', (e) => {
  const id = e.request.pathValue('id')
  let record
  try {
    record = $app.findRecordById('service_orders', id)
  } catch (_) {
    return e.json(404, { error: 'Ordem não encontrada' })
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
      const legacyStreet = cust.getString('street')

      customer = {
        name: razao || fantasia || legacyName || '',
        phone: celular || legacyPhone || '',
        street: endereco || legacyStreet || '',
        number: cust.getString('number'),
        city: cust.getString('city'),
        state: cust.getString('state'),
      }
    }
  } catch (_) {}

  let equipment = null
  try {
    const eqId = record.getString('equipment_ref')
    if (eqId) {
      const eq = $app.findRecordById('equipment', eqId)
      equipment = {
        name: eq.getString('name'),
        brand: eq.getString('brand'),
        model: eq.getString('model'),
        type: eq.getString('type'),
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

  const result = {
    id: record.id,
    number: record.getString('number'),
    status: record.getString('status'),
    title: record.getString('title'),
    description: record.getString('description'),
    service_report: record.getString('service_report'),
    total: record.getFloat('total'),
    attendance_date: record.getString('attendance_date'),
    attendance_time: record.getString('attendance_time'),
    created: record.getString('created'),
    customer: customer,
    equipment: equipment,
    items: items.map(function (item) {
      return {
        description: item.getString('description'),
        quantity: item.getFloat('quantity'),
        unit_price: item.getFloat('unit_price'),
        total: item.getFloat('total'),
      }
    }),
    has_customer_signature: !!record.getString('customer_signature'),
  }

  return e.json(200, result)
})
