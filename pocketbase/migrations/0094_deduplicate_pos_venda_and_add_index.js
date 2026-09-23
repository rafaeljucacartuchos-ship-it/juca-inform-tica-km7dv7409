migrate(
  (app) => {
    // PARTE 3 — Deduplicação dos cards de pós-venda já criados e proteção contra duplicação futura
    // 1) Identifica e deduplica registros repetidos em pos_venda_messages:
    // Para cada grupo (service_order, tipo), se houver múltiplos registros ativos (pending, ready, lembrete),
    // mantemos o mais recente e arquivamos os demais com status = 'sem_resposta' (exclusão lógica / LGPD preservado).
    try {
      const records = app.findRecordsByFilter(
        'pos_venda_messages',
        'service_order != "" && service_order != null && (status = "pending" || status = "ready" || status = "lembrete")',
        '-created',
        1000,
        0,
      )

      if (records && records.length > 0) {
        // Agrupa por chave única: service_order + '___' + tipo
        const seenGroups = new Set()
        let archivedCount = 0

        for (const rec of records) {
          const soId = rec.getString('service_order')
          const tipo = rec.getString('tipo')
          const key = soId + '___' + tipo

          if (seenGroups.has(key)) {
            // É duplicata mais antiga deste mesmo tipo/ordem: arquiva como sem_resposta
            rec.set('status', 'sem_resposta')
            rec.set(
              'feedback_cliente',
              'Card duplicado arquivado pela rotina de integridade v0.0.274',
            )
            app.save(rec)
            archivedCount++
          } else {
            // Primeiro que vemos (o mais recente porque ordenamos por -created): mantém ativo
            seenGroups.add(key)
          }
        }

        app
          .logger()
          .info(
            'Migration 0094: deduplicação de pos_venda concluída com sucesso',
            'archivedCount',
            archivedCount,
          )
      }
    } catch (dedupErr) {
      app
        .logger()
        .warn('Migration 0094: erro na deduplicação de pos_venda', 'error', String(dedupErr))
    }

    // 2) Adiciona índice não único em pos_venda_messages(service_order, tipo) para buscas rápidas e idempotência
    try {
      const col = app.findCollectionByNameOrId('pos_venda_messages')
      col.addIndex('idx_pos_venda_so_tipo', false, 'service_order, tipo', '')
      app.save(col)
    } catch (idxErr) {
      app.logger().warn('Migration 0094: índice idx_pos_venda_so_tipo', 'error', String(idxErr))
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('pos_venda_messages')
      col.removeIndex('idx_pos_venda_so_tipo')
      app.save(col)
    } catch (_) {}
  },
)
