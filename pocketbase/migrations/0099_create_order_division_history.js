/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const serviceOrdersCol = app.findCollectionByNameOrId('service_orders')

    const collection = new Collection({
      name: 'order_division_history',
      type: 'base',
      system: false,
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        {
          name: 'service_order',
          type: 'relation',
          required: true,
          collectionId: serviceOrdersCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'user',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'user_name',
          type: 'text',
          required: false,
        },
        {
          name: 'action',
          type: 'text',
          required: false,
        },
        {
          name: 'reason',
          type: 'text',
          required: false,
        },
        {
          name: 'previous_state',
          type: 'json',
          required: false,
        },
        {
          name: 'new_state',
          type: 'json',
          required: false,
        },
        {
          name: 'previous_details',
          type: 'json',
          required: false,
        },
        {
          name: 'new_details',
          type: 'json',
          required: false,
        },
        {
          name: 'order_status_at_change',
          type: 'text',
          required: false,
        },
      ],
      indexes: [
        'CREATE INDEX idx_odh_so ON order_division_history (service_order)',
        'CREATE INDEX idx_odh_user ON order_division_history (user)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('order_division_history')
      if (col) {
        app.delete(col)
      }
    } catch (err) {
      // Ignore rollback error if not exists
    }
  },
)
