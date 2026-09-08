migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('orcamentos')
    const field = col.fields.getByName('forma_pagamento')
    if (field) {
      const currentValues = field.values || []
      if (!currentValues.includes('crediario')) {
        field.values = [...currentValues, 'crediario']
        app.save(col)
      }
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('orcamentos')
      const field = col.fields.getByName('forma_pagamento')
      if (field && field.values) {
        field.values = field.values.filter((v) => v !== 'crediario')
        app.save(col)
      }
    } catch (_) {}
  },
)
