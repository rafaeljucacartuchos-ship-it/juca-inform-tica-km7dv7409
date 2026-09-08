migrate(
  (app) => {
    // Corrige retroativamente O.S. vinculadas a orçamentos que já estão com status 'faturado',
    // em particular a OS-0041 (k14ix145flsf6pz) vinculada ao ORC-0041 (g3yqox0wpqy8pam),
    // que permaneceu com status 'in_progress' devido à ausência de chamada a updateOsStatus no reenvio.
    try {
      const osRecord = app.findFirstRecordByData('service_orders', 'id', 'k14ix145flsf6pz')
      if (osRecord && osRecord.getString('status') !== 'closed') {
        osRecord.set('status', 'closed')
        app.save(osRecord)

        // Registra histórico informando a regularização
        const historyCol = app.findCollectionByNameOrId('status_history')
        const histRecord = new Record(historyCol)
        histRecord.set('service_order', 'k14ix145flsf6pz')
        histRecord.set('status', 'closed')
        histRecord.set(
          'note',
          'Regularização de status: O.S. finalizada referente ao Orçamento ORC-0041 faturado.',
        )
        app.save(histRecord)
      }
    } catch (e) {
      console.log('Migração 0063 - OS-0041 não encontrada ou já regularizada:', e)
    }

    // Por segurança adicional, verifica se existe alguma outra OS vinculada a orçamento faturado
    // cujo status ainda não esteja como 'closed' ou 'completed':
    try {
      app
        .db()
        .newQuery(`
        UPDATE service_orders
        SET status = 'closed'
        WHERE id IN (
          SELECT id_os FROM orcamentos WHERE status = 'faturado' AND id_os IS NOT NULL AND id_os != ''
        ) AND status NOT IN ('closed', 'completed')
      `)
        .execute()
    } catch (e) {
      console.log('Migração 0063 - Erro no UPDATE em lote de regularização:', e)
    }
  },
  (app) => {
    // Reversão segura
  },
)
