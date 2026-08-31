migrate(
  (app) => {
    // 1. Cria a coleção service_types
    const serviceTypes = new Collection({
      name: 'service_types',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'active', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_service_types_name ON service_types (name)'],
    })
    app.save(serviceTypes)

    // 2. Semeia tipos de atendimento iniciais comuns caso não existam
    const defaultTypes = [
      { name: 'Balcão', active: true },
      { name: 'Visita Técnica / Campo', active: true },
      { name: 'Suporte Remoto', active: true },
      { name: 'Laboratório / Bancada', active: true },
      { name: 'Garantia', active: true },
    ]

    const stCol = app.findCollectionByNameOrId('service_types')
    for (let i = 0; i < defaultTypes.length; i++) {
      const item = defaultTypes[i]
      try {
        app.findFirstRecordByData('service_types', 'name', item.name)
      } catch (_) {
        const rec = new Record(stCol)
        rec.set('name', item.name)
        rec.set('active', item.active)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      const serviceTypes = app.findCollectionByNameOrId('service_types')
      app.delete(serviceTypes)
    } catch (_) {}
  },
)
