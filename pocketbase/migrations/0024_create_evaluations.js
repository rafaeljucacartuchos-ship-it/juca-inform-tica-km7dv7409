migrate(
  (app) => {
    const collection = new Collection({
      name: 'evaluations',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'service_order',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('service_orders').id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'technician',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'rating',
          type: 'number',
          required: true,
          min: 1,
          max: 5,
        },
        {
          name: 'satisfaction',
          type: 'select',
          required: true,
          values: ['nao_gostei', 'bom', 'excelente', 'pode_melhorar'],
          maxSelect: 1,
        },
        {
          name: 'feedback',
          type: 'text',
          required: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_eval_so ON evaluations (service_order)',
        'CREATE INDEX idx_eval_tech ON evaluations (technician)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('evaluations')
      app.delete(col)
    } catch (_) {}
  },
)
