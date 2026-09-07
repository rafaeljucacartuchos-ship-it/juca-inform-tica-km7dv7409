migrate(
  (app) => {
    // 1. Atualizar status das coleções service_orders e status_history
    const soCol = app.findCollectionByNameOrId('service_orders')
    const soStatusField = soCol.fields.getByName('status')
    if (soStatusField) {
      soStatusField.values = [
        'open',
        'in_progress',
        'paused',
        'waiting_parts',
        'completed',
        'closed',
        'cancelled',
        'aguardando_orcamento',
        'orcamento_enviado',
        'orcamento_rejeitado',
      ]
    }
    app.save(soCol)

    const shCol = app.findCollectionByNameOrId('status_history')
    const shStatusField = shCol.fields.getByName('status')
    if (shStatusField) {
      shStatusField.values = [
        'open',
        'in_progress',
        'paused',
        'waiting_parts',
        'completed',
        'closed',
        'cancelled',
        'aguardando_orcamento',
        'orcamento_enviado',
        'orcamento_rejeitado',
      ]
    }
    app.save(shCol)

    // IDs de coleções necessárias para relações
    const serviceOrdersId = soCol.id
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const usersId = usersCol.id
    const productsCol = app.findCollectionByNameOrId('products')
    const productsId = productsCol.id

    // 2. Criar coleção orcamentos
    const orcamentosCol = new Collection({
      name: 'orcamentos',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'id_os',
          type: 'relation',
          required: true,
          collectionId: serviceOrdersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'numero_orcamento', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: [
            'rascunho',
            'enviado',
            'aguardando_aprovacao',
            'aprovado',
            'rejeitado',
            'substituido',
            'faturado',
          ],
          maxSelect: 1,
        },
        { name: 'validade', type: 'number' },
        { name: 'observacoes', type: 'text' },
        {
          name: 'id_usuario_criador',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
        },
        { name: 'desconto_total_valor', type: 'number' },
        {
          name: 'desconto_total_tipo',
          type: 'select',
          values: ['percentual', 'valor'],
          maxSelect: 1,
        },
        { name: 'desconto_total_percentual', type: 'number' },
        { name: 'justificativa_desconto', type: 'text' },
        {
          name: 'forma_pagamento',
          type: 'select',
          values: ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'boleto', 'outros'],
          maxSelect: 1,
        },
        { name: 'parcelas', type: 'number' },
        { name: 'entrada', type: 'number' },
        { name: 'restante', type: 'number' },
        {
          name: 'status_pagamento',
          type: 'select',
          values: ['pendente', 'parcial', 'pago'],
          maxSelect: 1,
        },
        {
          name: 'assinatura_cliente',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/png', 'image/jpeg'],
        },
        {
          name: 'assinatura_tecnico',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/png', 'image/jpeg'],
        },
        { name: 'data_assinatura_cliente', type: 'date' },
        { name: 'data_assinatura_tecnico', type: 'date' },
        { name: 'ip_dispositivo', type: 'text' },
        { name: 'motivo_rejeicao', type: 'text' },
        { name: 'subtotal', type: 'number' },
        { name: 'total_geral', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_orcamentos_os ON orcamentos (id_os)',
        'CREATE INDEX idx_orcamentos_status ON orcamentos (status)',
        'CREATE UNIQUE INDEX idx_orcamentos_numero ON orcamentos (numero_orcamento)',
      ],
    })
    app.save(orcamentosCol)

    const orcamentosId = orcamentosCol.id

    // 3. Criar coleção orcamento_itens
    const itensCol = new Collection({
      name: 'orcamento_itens',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'id_orcamento',
          type: 'relation',
          required: true,
          collectionId: orcamentosId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['produto', 'servico'],
          maxSelect: 1,
        },
        {
          name: 'id_produto',
          type: 'relation',
          collectionId: productsId,
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text', required: true },
        { name: 'quantidade', type: 'number', required: true },
        { name: 'valor_unitario', type: 'number', required: true },
        { name: 'desconto_item', type: 'number' },
        {
          name: 'desconto_item_tipo',
          type: 'select',
          values: ['percentual', 'valor'],
          maxSelect: 1,
        },
        { name: 'valor_total_item', type: 'number', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_orc_itens_orcamento ON orcamento_itens (id_orcamento)'],
    })
    app.save(itensCol)

    // 4. Criar coleção orcamento_anexos
    const anexosCol = new Collection({
      name: 'orcamento_anexos',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'id_orcamento',
          type: 'relation',
          required: true,
          collectionId: orcamentosId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['foto_equipamento', 'foto_defeito', 'documento'],
          maxSelect: 1,
        },
        {
          name: 'caminho_arquivo',
          type: 'file',
          required: true,
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf'],
        },
        { name: 'legenda', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_orc_anexos_orcamento ON orcamento_anexos (id_orcamento)'],
    })
    app.save(anexosCol)
  },
  (app) => {
    try {
      const anexosCol = app.findCollectionByNameOrId('orcamento_anexos')
      app.delete(anexosCol)
    } catch (_) {}

    try {
      const itensCol = app.findCollectionByNameOrId('orcamento_itens')
      app.delete(itensCol)
    } catch (_) {}

    try {
      const orcamentosCol = app.findCollectionByNameOrId('orcamentos')
      app.delete(orcamentosCol)
    } catch (_) {}

    const soCol = app.findCollectionByNameOrId('service_orders')
    const soStatusField = soCol.fields.getByName('status')
    if (soStatusField) {
      soStatusField.values = [
        'open',
        'in_progress',
        'paused',
        'waiting_parts',
        'completed',
        'closed',
        'cancelled',
      ]
    }
    app.save(soCol)

    const shCol = app.findCollectionByNameOrId('status_history')
    const shStatusField = shCol.fields.getByName('status')
    if (shStatusField) {
      shStatusField.values = [
        'open',
        'in_progress',
        'paused',
        'waiting_parts',
        'completed',
        'closed',
        'cancelled',
      ]
    }
    app.save(shCol)
  },
)
