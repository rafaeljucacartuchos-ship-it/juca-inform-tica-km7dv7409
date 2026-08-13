migrate(
  (app) => {
    var notifications = new Collection({
      name: 'notifications',
      type: 'base',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: null,
      updateRule: 'user = @request.auth.id',
      deleteRule: null,
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'message', type: 'text' },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['service_order', 'appointment', 'payment', 'system'],
          maxSelect: 1,
        },
        { name: 'read', type: 'bool' },
        { name: 'link', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_notifications_user ON notifications (user)',
        'CREATE INDEX idx_notifications_read ON notifications (read)',
        'CREATE INDEX idx_notifications_created ON notifications (created)',
      ],
    })
    app.save(notifications)

    var servicesCol = app.findCollectionByNameOrId('services')
    if (!servicesCol.fields.getByName('category')) {
      servicesCol.fields.add(
        new SelectField({
          name: 'category',
          required: true,
          values: ['hardware', 'software', 'rede', 'manutencao_preventiva', 'instalacao', 'outros'],
          maxSelect: 1,
        }),
      )
      app.save(servicesCol)
      app
        .db()
        .newQuery("UPDATE services SET category = 'outros' WHERE category IS NULL OR category = ''")
        .execute()
    }

    var soCol = app.findCollectionByNameOrId('service_orders')
    soCol.addIndex('idx_so_created', false, 'created', '')
    app.save(soCol)
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('notifications')
      app.delete(col)
    } catch (_) {}

    try {
      var servicesCol = app.findCollectionByNameOrId('services')
      var catField = servicesCol.fields.getByName('category')
      if (catField) {
        servicesCol.fields.remove(catField)
        app.save(servicesCol)
      }
    } catch (_) {}

    try {
      var soCol = app.findCollectionByNameOrId('service_orders')
      soCol.removeIndex('idx_so_created')
      app.save(soCol)
    } catch (_) {}
  },
)
