migrate(
  (app) => {
    // 1. service_orders
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

    // 2. status_history
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
  (app) => {
    // Reverter para os valores originais
    const soCol = app.findCollectionByNameOrId('service_orders')
    const soStatusField = soCol.fields.getByName('status')
    if (soStatusField) {
      soStatusField.values = [
        'open',
        'in_progress',
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
        'waiting_parts',
        'completed',
        'closed',
        'cancelled',
      ]
    }
    app.save(shCol)
  },
)
