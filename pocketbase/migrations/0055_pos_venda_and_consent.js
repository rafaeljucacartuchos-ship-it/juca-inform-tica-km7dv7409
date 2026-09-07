migrate(
  (app) => {
    // 1. Adicionar campo whatsapp_consent à tabela customers (default true para existentes)
    const customersCol = app.findCollectionByNameOrId('customers')
    if (!customersCol.fields.getByName('whatsapp_consent')) {
      customersCol.fields.add(
        new BoolField({
          name: 'whatsapp_consent',
          required: false,
        }),
      )
      app.save(customersCol)
    }

    // Preencher clientes existentes com whatsapp_consent = true
    app
      .db()
      .newQuery(
        'UPDATE customers SET whatsapp_consent = 1 WHERE whatsapp_consent IS NULL OR whatsapp_consent = 0',
      )
      .execute()

    // 2. Criar coleção settings (para armazenar configurações gerais como google_review_url)
    let settingsCol
    try {
      settingsCol = app.findCollectionByNameOrId('settings')
    } catch (_) {
      settingsCol = new Collection({
        name: 'settings',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'key', type: 'text', required: true },
          { name: 'value', type: 'text' },
          { name: 'description', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_settings_key ON settings (key)'],
      })
      app.save(settingsCol)

      // Inicializar setting google_review_url com o valor padrão da JUCA
      const initialSetting = new Record(settingsCol)
      initialSetting.set('key', 'google_review_url')
      initialSetting.set('value', 'https://g.page/r/CfKb0UxVRFNsEAI/review')
      initialSetting.set('description', 'Link público para avaliação no Google Meu Negócio')
      app.save(initialSetting)
    }

    // 3. Criar coleção pos_venda_messages
    const customerId = app.findCollectionByNameOrId('customers').id
    const soId = app.findCollectionByNameOrId('service_orders').id

    try {
      app.findCollectionByNameOrId('pos_venda_messages')
    } catch (_) {
      const posVendaCol = new Collection({
        name: 'pos_venda_messages',
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
            collectionId: customerId,
            required: true,
            maxSelect: 1,
          },
          {
            name: 'service_order',
            type: 'relation',
            collectionId: soId,
            required: false,
            maxSelect: 1,
          },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['resumo_finalizacao', 'avaliacao_30min', 'pos_venda_7d', 'oferta_30d'],
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pending', 'ready', 'sent', 'dismissed'],
            maxSelect: 1,
          },
          { name: 'scheduled_at', type: 'date' },
          { name: 'sent_at', type: 'date' },
          { name: 'texto_gerado', type: 'text' },
          { name: 'wa_me_link', type: 'text' },
          { name: 'channel', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_pos_venda_status_sched ON pos_venda_messages (status, scheduled_at)',
          'CREATE INDEX idx_pos_venda_customer ON pos_venda_messages (customer)',
          'CREATE INDEX idx_pos_venda_so ON pos_venda_messages (service_order)',
        ],
      })
      app.save(posVendaCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('pos_venda_messages')
      app.delete(col)
    } catch (_) {}
    try {
      const col = app.findCollectionByNameOrId('settings')
      app.delete(col)
    } catch (_) {}
  },
)
