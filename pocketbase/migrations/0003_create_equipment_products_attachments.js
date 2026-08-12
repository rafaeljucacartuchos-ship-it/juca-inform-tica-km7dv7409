migrate(
  (app) => {
    const customersCol = app.findCollectionByNameOrId('customers')
    const soCol = app.findCollectionByNameOrId('service_orders')

    var equipment = new Collection({
      name: 'equipment',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'customer',
          type: 'relation',
          required: true,
          collectionId: customersCol.id,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          values: [
            'notebook',
            'desktop',
            'monitor',
            'printer',
            'smartphone',
            'tablet',
            'network',
            'other',
          ],
          maxSelect: 1,
        },
        { name: 'brand', type: 'text' },
        { name: 'model', type: 'text' },
        { name: 'serial_number', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_equipment_customer ON equipment (customer)',
        'CREATE INDEX idx_equipment_name ON equipment (name)',
      ],
    })
    app.save(equipment)

    var products = new Collection({
      name: 'products',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'sku', type: 'text' },
        { name: 'price', type: 'number' },
        { name: 'stock_quantity', type: 'number' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_products_sku ON products (sku)',
        'CREATE INDEX idx_products_name ON products (name)',
      ],
    })
    app.save(products)

    if (!soCol.fields.getByName('equipment_ref')) {
      soCol.fields.add(
        new RelationField({ name: 'equipment_ref', collectionId: equipment.id, maxSelect: 1 }),
      )
    }
    if (!soCol.fields.getByName('service_report')) {
      soCol.fields.add(new TextField({ name: 'service_report' }))
    }
    if (!soCol.fields.getByName('technician_signature')) {
      soCol.fields.add(
        new FileField({
          name: 'technician_signature',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
        }),
      )
    }
    if (!soCol.fields.getByName('customer_signature')) {
      soCol.fields.add(
        new FileField({
          name: 'customer_signature',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
        }),
      )
    }
    soCol.addIndex('idx_so_equipment_ref', false, 'equipment_ref', '')
    app.save(soCol)

    var serviceAttachments = new Collection({
      name: 'service_attachments',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'service_order',
          type: 'relation',
          required: true,
          collectionId: soCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'file',
          type: 'file',
          required: true,
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
        },
        { name: 'caption', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_sa_so ON service_attachments (service_order)'],
    })
    app.save(serviceAttachments)
  },
  (app) => {
    var names = ['service_attachments', 'products', 'equipment']
    for (var i = 0; i < names.length; i++) {
      try {
        app.delete(app.findCollectionByNameOrId(names[i]))
      } catch (_) {}
    }
    try {
      var soCol = app.findCollectionByNameOrId('service_orders')
      var fieldNames = [
        'equipment_ref',
        'service_report',
        'technician_signature',
        'customer_signature',
      ]
      for (var j = 0; j < fieldNames.length; j++) {
        var f = soCol.fields.getByName(fieldNames[j])
        if (f) soCol.fields.remove(f)
      }
      soCol.removeIndex('idx_so_equipment_ref')
      app.save(soCol)
    } catch (_) {}
  },
)
