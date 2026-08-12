onRecordCreate((e) => {
  if (!e.record.get('number')) {
    const count = $app.countRecords('service_orders') + 1
    const pad = String(count).padStart(4, '0')
    e.record.set('number', 'OS-' + pad)
  }
  e.next()
}, 'service_orders')
