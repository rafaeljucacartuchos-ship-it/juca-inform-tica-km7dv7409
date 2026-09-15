migrate(
  (app) => {
    const productsCol = app.findCollectionByNameOrId('products')
    const productsId = productsCol.id
    const customersCol = app.findCollectionByNameOrId('customers')
    const customersId = customersCol.id

    // 1. rental_machines
    // supplies JSON: [{ product: string, valor: number, durabilidade_paginas: number, cpp: number, nome?: string, categoria?: string }]
    const rentalMachinesCol = new Collection({
      name: 'rental_machines',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'produto',
          type: 'relation',
          required: true,
          collectionId: productsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'serial', type: 'text' },
        { name: 'contador_inicial', type: 'number' },
        { name: 'supplies', type: 'json' },
        { name: 'valor_compra', type: 'number' },
        { name: 'payback_meses', type: 'number' },
        { name: 'scanner', type: 'bool' },
        { name: 'scanner_tipo', type: 'text' },
        { name: 'scanner_velocidade', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_rental_machines_produto ON rental_machines (produto)',
        'CREATE INDEX idx_rental_machines_serial ON rental_machines (serial)',
      ],
    })
    app.save(rentalMachinesCol)

    const rentalMachinesId = rentalMachinesCol.id

    // 2. rental_quotes
    const rentalQuotesCol = new Collection({
      name: 'rental_quotes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'cliente_id',
          type: 'relation',
          collectionId: customersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'cliente_nome_livre', type: 'text' },
        { name: 'cliente_telefone', type: 'text' },
        { name: 'cliente_documento', type: 'text' },
        { name: 'cliente_endereco', type: 'text' },
        {
          name: 'maquinas',
          type: 'relation',
          collectionId: rentalMachinesId,
          cascadeDelete: false,
          maxSelect: 2,
        },
        { name: 'maquinas_comparadas', type: 'json' },
        { name: 'volume_mensal', type: 'number' },
        { name: 'franquia_paginas', type: 'number' },
        { name: 'contrato_meses', type: 'number' },
        { name: 'excesso_pagina_valor', type: 'number' },
        { name: 'scanner', type: 'bool' },
        { name: 'scanner_dados', type: 'text' },
        { name: 'margem_pct', type: 'number' },
        { name: 'payback_meses', type: 'number' },
        { name: 'resultados', type: 'json' },
        {
          name: 'status',
          type: 'select',
          values: ['simulacao', 'proposta_gerada', 'contratado', 'cancelado'],
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_rental_quotes_cliente ON rental_quotes (cliente_id)',
        'CREATE INDEX idx_rental_quotes_status ON rental_quotes (status)',
      ],
    })
    app.save(rentalQuotesCol)

    const rentalQuotesId = rentalQuotesCol.id

    // 3. rental_contracts
    const rentalContractsCol = new Collection({
      name: 'rental_contracts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'proposta',
          type: 'relation',
          required: true,
          collectionId: rentalQuotesId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'numero', type: 'text', required: true },
        { name: 'locatario_dados', type: 'json' },
        { name: 'equipamento_dados', type: 'json' },
        { name: 'franquia_paginas', type: 'number' },
        { name: 'valor_mensal', type: 'number' },
        { name: 'excesso_pagina_valor', type: 'number' },
        { name: 'contrato_meses', type: 'number' },
        { name: 'data_inicio', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['rascunho', 'ativo', 'encerrado'],
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'clausulas_adicionais', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_rental_contracts_numero ON rental_contracts (numero)',
        'CREATE INDEX idx_rental_contracts_proposta ON rental_contracts (proposta)',
        'CREATE INDEX idx_rental_contracts_status ON rental_contracts (status)',
      ],
    })
    app.save(rentalContractsCol)

    // 4. Inicializar configurações padrão de locação se não existirem
    const settingsCol = app.findCollectionByNameOrId('settings')
    const defaultRentalSettings = [
      {
        key: 'rental_default_payback_months',
        value: '18',
        description: 'Prazo padrão de payback para máquinas de locação (meses)',
      },
      {
        key: 'rental_default_margin_pct',
        value: '50',
        description: 'Margem percentual padrão sobre o CPP e locação de impressoras (%)',
      },
      {
        key: 'rental_contract_counter_year',
        value: '2025',
        description: 'Ano de controle da numeração sequencial de contratos de locação',
      },
      {
        key: 'rental_contract_counter_seq',
        value: '0',
        description: 'Último número sequencial de contrato emitido no ano corrente',
      },
    ]

    for (let i = 0; i < defaultRentalSettings.length; i++) {
      const item = defaultRentalSettings[i]
      try {
        app.findFirstRecordByData('settings', 'key', item.key)
      } catch (_) {
        const record = new Record(settingsCol)
        record.set('key', item.key)
        record.set('value', item.value)
        record.set('description', item.description)
        app.save(record)
      }
    }
  },
  (app) => {
    try {
      const rentalContractsCol = app.findCollectionByNameOrId('rental_contracts')
      app.delete(rentalContractsCol)
    } catch (_) {}

    try {
      const rentalQuotesCol = app.findCollectionByNameOrId('rental_quotes')
      app.delete(rentalQuotesCol)
    } catch (_) {}

    try {
      const rentalMachinesCol = app.findCollectionByNameOrId('rental_machines')
      app.delete(rentalMachinesCol)
    } catch (_) {}
  },
)
