migrate(
  (app) => {
    // 1. Atualizar status na coleção service_orders
    const soCol = app.findCollectionByNameOrId('service_orders')
    const soStatusField = soCol.fields.getByName('status')
    if (soStatusField) {
      const allowed = [
        'open',
        'in_progress',
        'paused',
        'waiting_parts',
        'completed',
        'closed',
        'cancelled',
        'aguardando_orcamento',
        'orcamento_enviado',
        'orcamento_aprovado',
        'orcamento_rejeitado',
      ]
      soStatusField.values = allowed
      soStatusField.maxSelect = 1
    }
    app.save(soCol)

    // 2. Atualizar status na coleção status_history
    const shCol = app.findCollectionByNameOrId('status_history')
    const shStatusField = shCol.fields.getByName('status')
    if (shStatusField) {
      const allowed = [
        'open',
        'in_progress',
        'paused',
        'waiting_parts',
        'completed',
        'closed',
        'cancelled',
        'aguardando_orcamento',
        'orcamento_enviado',
        'orcamento_aprovado',
        'orcamento_rejeitado',
      ]
      shStatusField.values = allowed
      shStatusField.maxSelect = 1
    }
    app.save(shCol)
  },
  (app) => {
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
  },
)
