migrate(
  (app) => {
    // 1. Adicionar campo 'fabricante' à coleção products se não existir
    const productsCol = app.findCollectionByNameOrId('products')
    if (!productsCol.fields.getByName('fabricante')) {
      productsCol.fields.add(
        new TextField({
          name: 'fabricante',
          required: false,
        }),
      )
      app.save(productsCol)
    }

    // 2. Criar coleção 'campaigns' para armazenar campanhas de marketing
    let campaignsCol
    try {
      campaignsCol = app.findCollectionByNameOrId('campaigns')
    } catch (_) {
      campaignsCol = new Collection({
        name: 'campaigns',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'description', type: 'text' },
          { name: 'target_audience', type: 'text' },
          { name: 'template_text', type: 'text', required: true },
          {
            name: 'flyer',
            type: 'file',
            maxSelect: 1,
            maxSize: 10485760, // 10MB
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['draft', 'active', 'archived'],
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_campaigns_status ON campaigns (status)'],
      })
      app.save(campaignsCol)
    }

    // 3. Criar coleção 'campanha_messages' para histórico de envios das campanhas aos clientes
    const customerId = app.findCollectionByNameOrId('customers').id
    const campaignId = app.findCollectionByNameOrId('campaigns').id

    try {
      app.findCollectionByNameOrId('campanha_messages')
    } catch (_) {
      const campMsgCol = new Collection({
        name: 'campanha_messages',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'campaign',
            type: 'relation',
            collectionId: campaignId,
            required: true,
            maxSelect: 1,
          },
          {
            name: 'customer',
            type: 'relation',
            collectionId: customerId,
            required: true,
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pending', 'sent', 'dismissed'],
            maxSelect: 1,
          },
          { name: 'sent_at', type: 'date' },
          { name: 'texto_gerado', type: 'text' },
          { name: 'wa_me_link', type: 'text' },
          { name: 'channel', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_camp_msg_campaign ON campanha_messages (campaign)',
          'CREATE INDEX idx_camp_msg_customer ON campanha_messages (customer)',
          'CREATE INDEX idx_camp_msg_status ON campanha_messages (status)',
        ],
      })
      app.save(campMsgCol)
    }
  },
  (app) => {
    try {
      const campMsgCol = app.findCollectionByNameOrId('campanha_messages')
      app.delete(campMsgCol)
    } catch (_) {}
    try {
      const campaignsCol = app.findCollectionByNameOrId('campaigns')
      app.delete(campaignsCol)
    } catch (_) {}
    try {
      const productsCol = app.findCollectionByNameOrId('products')
      const f = productsCol.fields.getByName('fabricante')
      if (f) {
        productsCol.fields.removeByName('fabricante')
        app.save(productsCol)
      }
    } catch (_) {}
  },
)
