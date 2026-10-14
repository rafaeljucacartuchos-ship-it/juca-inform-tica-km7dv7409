migrate((app) => {
  const col = new Collection({
    name: 'supplier_purchase_receipts', type: 'base',
    listRule: "@request.auth.role = 'admin'", viewRule: "@request.auth.role = 'admin'",
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: 'invoice_key', type: 'text', required: true, max: 44 },
      { name: 'canonical', type: 'text', required: true, max: 2097152 },
      { name: 'payload', type: 'json', required: true, maxSize: 2097152 },
      { name: 'result', type: 'json', required: true, maxSize: 2097152 },
      { name: 'actor', type: 'text', required: true },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_supplier_invoice_key ON supplier_purchase_receipts (invoice_key)'],
  })
  app.save(col)
}, () => { throw new Error('Recibos de compra preservados: reversão exige análise das entradas já realizadas.') })
