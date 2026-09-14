migrate(
  (app) => {
    const productsCol = app.findCollectionByNameOrId('products')
    const productsId = productsCol.id
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const usersId = usersCol.id

    const pricingHistoryCol = new Collection({
      name: 'pricing_history',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'product',
          type: 'relation',
          collectionId: productsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'cost', type: 'number', required: false },
        { name: 'despesas_pct', type: 'number', required: false },
        { name: 'markup_pct', type: 'number', required: false },
        { name: 'margem_pct', type: 'number', required: false },
        { name: 'sale_price', type: 'number', required: true },
        { name: 'lucro_unitario', type: 'number', required: false },
        {
          name: 'mode',
          type: 'select',
          required: true,
          values: ['produto', 'avulsa', 'rapida'],
          maxSelect: 1,
        },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_pricing_history_product ON pricing_history (product)',
        'CREATE INDEX idx_pricing_history_created ON pricing_history (created DESC)',
        'CREATE INDEX idx_pricing_history_mode ON pricing_history (mode)',
      ],
    })

    app.save(pricingHistoryCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('pricing_history')
      app.delete(col)
    } catch (_) {}
  },
)
