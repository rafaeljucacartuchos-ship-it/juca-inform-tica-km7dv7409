migrate(
  (app) => {
    // 1. Tornar id_os opcional (required: false) para permitir orçamentos independentes sem OS vinculada
    const orcamentosCol = app.findCollectionByNameOrId('orcamentos')
    const idOsField = orcamentosCol.fields.getByName('id_os')
    if (idOsField) {
      idOsField.required = false
    }
    app.save(orcamentosCol)

    // 2. Corrigir retroativamente os orçamentos existentes vinculados a OS para espelhar o número da OS
    // Especialmente: OS-0041 que virou ORC-0002/2026 -> vira ORC-0041
    // E OS-0037 que virou ORC-0001/2026 -> vira ORC-0037
    try {
      app
        .db()
        .newQuery(`
        UPDATE orcamentos
        SET numero_orcamento = 'ORC-' || SUBSTR((SELECT number FROM service_orders WHERE service_orders.id = orcamentos.id_os), 4)
        WHERE id_os IS NOT NULL 
          AND id_os != ''
          AND EXISTS (SELECT 1 FROM service_orders WHERE service_orders.id = orcamentos.id_os AND service_orders.number LIKE 'OS-%')
      `)
        .execute()
    } catch (e) {
      console.log('Aviso ao atualizar retroativamente números de orçamento:', e)
    }
  },
  (app) => {
    try {
      const orcamentosCol = app.findCollectionByNameOrId('orcamentos')
      const idOsField = orcamentosCol.fields.getByName('id_os')
      if (idOsField) {
        idOsField.required = true
      }
      app.save(orcamentosCol)
    } catch (_) {}
  },
)
