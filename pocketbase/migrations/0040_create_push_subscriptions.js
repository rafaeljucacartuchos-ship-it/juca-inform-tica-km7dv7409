migrate(
  (app) => {
    const collection = new Collection({
      name: 'push_subscriptions',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          system: false,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          minSelect: 1,
          maxSelect: 1,
        },
        {
          name: 'endpoint',
          type: 'text',
          required: true,
          system: false,
          min: 1,
          max: 2048,
        },
        {
          name: 'p256dh',
          type: 'text',
          required: true,
          system: false,
          min: 1,
          max: 512,
        },
        {
          name: 'auth',
          type: 'text',
          required: true,
          system: false,
          min: 1,
          max: 256,
        },
        {
          name: 'active',
          type: 'bool',
          required: false,
          system: false,
        },
        {
          name: 'created',
          type: 'autodate',
          required: false,
          system: false,
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          required: false,
          system: false,
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_push_subs_endpoint ON push_subscriptions (endpoint)',
        'CREATE INDEX idx_push_subs_user_active ON push_subscriptions (user, active)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('push_subscriptions')
      app.delete(collection)
    } catch (e) {}
  },
)
