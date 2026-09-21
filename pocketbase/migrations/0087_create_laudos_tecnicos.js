migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const soCol = app.findCollectionByNameOrId('service_orders')
    const orcCol = app.findCollectionByNameOrId('orcamentos')
    const custCol = app.findCollectionByNameOrId('customers')
    const eqCol = app.findCollectionByNameOrId('equipment')

    const collection = new Collection({
      name: 'laudos_tecnicos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'numero_laudo', type: 'text', required: true },
        {
          name: 'id_ordem',
          type: 'relation',
          required: false,
          collectionId: soCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'id_orcamento',
          type: 'relation',
          required: false,
          collectionId: orcCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'id_cliente',
          type: 'relation',
          required: false,
          collectionId: custCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'id_equipamento',
          type: 'relation',
          required: false,
          collectionId: eqCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'tecnico_responsavel',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['rascunho', 'finalizado'],
          maxSelect: 1,
        },

        // Snapshot congelado dos dados do cliente e equipamento
        { name: 'cliente_nome', type: 'text' },
        { name: 'cliente_documento', type: 'text' },
        { name: 'cliente_telefone', type: 'text' },
        { name: 'cliente_endereco', type: 'text' },

        { name: 'equipamento_nome', type: 'text' },
        { name: 'equipamento_tipo', type: 'text' },
        { name: 'equipamento_fabricante', type: 'text' },
        { name: 'equipamento_modelo', type: 'text' },
        { name: 'equipamento_serial', type: 'text' },
        { name: 'equipamento_dados_adicionais', type: 'text' },

        // Conteúdo técnico do Laudo
        { name: 'problema_relatado', type: 'text' },
        { name: 'diagnostico_tecnico', type: 'text' },
        { name: 'testes_realizados', type: 'text' },
        { name: 'servicos_realizados', type: 'text' },
        { name: 'pecas_substituidas', type: 'text' },
        { name: 'conclusao_parecer', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'recomendacoes', type: 'text' },

        // Identificação, data e assinaturas
        { name: 'data_laudo', type: 'date' },
        { name: 'tecnico_nome', type: 'text' },
        {
          name: 'assinatura_tecnico',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        {
          name: 'assinatura_cliente',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'data_assinatura', type: 'date' },

        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_laudos_numero ON laudos_tecnicos (numero_laudo)',
        'CREATE INDEX idx_laudos_ordem ON laudos_tecnicos (id_ordem)',
        'CREATE INDEX idx_laudos_orcamento ON laudos_tecnicos (id_orcamento)',
        'CREATE INDEX idx_laudos_cliente ON laudos_tecnicos (id_cliente)',
        'CREATE INDEX idx_laudos_status ON laudos_tecnicos (status)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('laudos_tecnicos')
    app.delete(collection)
  },
)
