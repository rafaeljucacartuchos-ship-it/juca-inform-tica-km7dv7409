migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('role')) {
      usersCol.fields.add(
        new SelectField({
          name: 'role',
          required: true,
          values: ['admin', 'attendant', 'technician'],
          maxSelect: 1,
        }),
      )
    }
    if (!usersCol.fields.getByName('phone')) {
      usersCol.fields.add(new TextField({ name: 'phone' }))
    }
    app.save(usersCol)

    const customers = new Collection({
      name: 'customers',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'email' },
        { name: 'phone', type: 'text', required: true },
        { name: 'street', type: 'text' },
        { name: 'number', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        { name: 'zip', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_customers_name ON customers (name)',
        'CREATE INDEX idx_customers_phone ON customers (phone)',
      ],
    })
    app.save(customers)

    const appointments = new Collection({
      name: 'appointments',
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
          collectionId: customers.id,
          maxSelect: 1,
        },
        {
          name: 'technician',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'date', type: 'date', required: true },
        { name: 'start_time', type: 'text' },
        { name: 'end_time', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'],
          maxSelect: 1,
        },
        { name: 'address_note', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_appointments_date ON appointments (date)',
        'CREATE INDEX idx_appointments_status ON appointments (status)',
        'CREATE INDEX idx_appointments_tech ON appointments (technician)',
      ],
    })
    app.save(appointments)

    const serviceOrders = new Collection({
      name: 'service_orders',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'number', type: 'text', required: true },
        {
          name: 'customer',
          type: 'relation',
          required: true,
          collectionId: customers.id,
          maxSelect: 1,
        },
        { name: 'technician', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'appointment', type: 'relation', collectionId: appointments.id, maxSelect: 1 },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['open', 'in_progress', 'waiting_parts', 'completed', 'closed', 'cancelled'],
          maxSelect: 1,
        },
        {
          name: 'priority',
          type: 'select',
          required: true,
          values: ['low', 'medium', 'high', 'urgent'],
          maxSelect: 1,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'equipment', type: 'text' },
        { name: 'diagnostic', type: 'text' },
        { name: 'estimated_cost', type: 'number' },
        { name: 'total', type: 'number' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_so_number ON service_orders (number)',
        'CREATE INDEX idx_so_status ON service_orders (status)',
        'CREATE INDEX idx_so_customer ON service_orders (customer)',
        'CREATE INDEX idx_so_technician ON service_orders (technician)',
      ],
    })
    app.save(serviceOrders)

    const services = new Collection({
      name: 'services',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'price', type: 'number' },
        { name: 'estimated_duration', type: 'number' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(services)

    const serviceOrderItems = new Collection({
      name: 'service_order_items',
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
          collectionId: serviceOrders.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'service', type: 'relation', collectionId: services.id, maxSelect: 1 },
        { name: 'description', type: 'text' },
        { name: 'quantity', type: 'number' },
        { name: 'unit_price', type: 'number' },
        { name: 'total', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_soi_so ON service_order_items (service_order)'],
    })
    app.save(serviceOrderItems)

    const statusHistory = new Collection({
      name: 'status_history',
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
          collectionId: serviceOrders.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['open', 'in_progress', 'waiting_parts', 'completed', 'closed', 'cancelled'],
          maxSelect: 1,
        },
        { name: 'note', type: 'text' },
        { name: 'changed_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_sh_so ON status_history (service_order)'],
    })
    app.save(statusHistory)

    const payments = new Collection({
      name: 'payments',
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
          collectionId: serviceOrders.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'amount', type: 'number', required: true },
        {
          name: 'method',
          type: 'select',
          values: ['cash', 'pix', 'credit_card', 'debit_card', 'transfer'],
          maxSelect: 1,
        },
        { name: 'status', type: 'select', values: ['pending', 'paid', 'refunded'], maxSelect: 1 },
        { name: 'paid_at', type: 'date' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_pay_so ON payments (service_order)'],
    })
    app.save(payments)
  },
  (app) => {
    const names = [
      'payments',
      'status_history',
      'service_order_items',
      'services',
      'service_orders',
      'appointments',
      'customers',
    ]
    for (const n of names) {
      try {
        const col = app.findCollectionByNameOrId(n)
        app.delete(col)
      } catch (_) {}
    }
  },
)
