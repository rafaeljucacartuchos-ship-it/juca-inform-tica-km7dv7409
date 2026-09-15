migrate(
  (app) => {
    // PARTE 2 — BACKFILL DE TOTAL DAS SERVICE_ORDERS E REGULARIZAÇÃO DE ORÇAMENTOS
    // 1º) UPDATE orcamentos SET status='aprovado' WHERE tem assinatura_cliente preenchida AND status IN ('rascunho','enviado','aguardando_aprovacao')
    // 2º) service_orders com total 0/nulo e orçamento aprovado/faturado vinculado -> total = total_geral do mais recente
    // 3º) total 0/nulo com qualquer orçamento vinculado total_geral > 0 -> total = total_geral do mais recente
    // 4º) total 0/nulo com service_order_items -> total = MAX(0, SUM(quantity*unit_price) - desconto + acréscimo)
    // Não tocar em O.S. com total > 0. Tratar cada passo em try/catch com log para não abortar a migration.

    // PASSO 1: Regularizar orçamentos assinados pelo cliente mas com status pendente/rascunho
    try {
      console.log(
        '[Migration 0074] Passo 1: Regularizando orçamentos com assinatura_cliente preenchida...',
      )
      const queryPasso1 = `
        UPDATE orcamentos
        SET status = 'aprovado'
        WHERE assinatura_cliente IS NOT NULL
          AND TRIM(assinatura_cliente) != ''
          AND status IN ('rascunho', 'enviado', 'aguardando_aprovacao')
      `
      app.db().newQuery(queryPasso1).execute()
      console.log('[Migration 0074] Passo 1 concluído com sucesso.')
    } catch (e) {
      console.log('[Migration 0074] Erro no Passo 1 (regularização de orçamentos assinados):', e)
    }

    // PASSO 2: service_orders com total 0/nulo e orçamento aprovado/faturado vinculado -> total = total_geral do mais recente
    try {
      console.log(
        '[Migration 0074] Passo 2: Atualizando service_orders com orçamento aprovado/faturado...',
      )
      const queryPasso2 = `
        UPDATE service_orders
        SET total = (
          SELECT o.total_geral
          FROM orcamentos o
          WHERE o.id_os = service_orders.id
            AND o.status IN ('aprovado', 'faturado')
            AND o.total_geral IS NOT NULL
            AND o.total_geral > 0
          ORDER BY o.created DESC
          LIMIT 1
        )
        WHERE (total IS NULL OR total = 0)
          AND id IN (
            SELECT o2.id_os
            FROM orcamentos o2
            WHERE o2.id_os IS NOT NULL
              AND o2.id_os != ''
              AND o2.status IN ('aprovado', 'faturado')
              AND o2.total_geral IS NOT NULL
              AND o2.total_geral > 0
          )
      `
      app.db().newQuery(queryPasso2).execute()
      console.log('[Migration 0074] Passo 2 concluído com sucesso.')
    } catch (e) {
      console.log('[Migration 0074] Erro no Passo 2 (orçamentos aprovados/faturados):', e)
    }

    // PASSO 3: service_orders com total 0/nulo com QUALQUER orçamento vinculado com total_geral > 0 -> total = total_geral do mais recente
    try {
      console.log(
        '[Migration 0074] Passo 3: Atualizando service_orders com qualquer orçamento vinculado total_geral > 0...',
      )
      const queryPasso3 = `
        UPDATE service_orders
        SET total = (
          SELECT o.total_geral
          FROM orcamentos o
          WHERE o.id_os = service_orders.id
            AND o.total_geral IS NOT NULL
            AND o.total_geral > 0
          ORDER BY o.created DESC
          LIMIT 1
        )
        WHERE (total IS NULL OR total = 0)
          AND id IN (
            SELECT o3.id_os
            FROM orcamentos o3
            WHERE o3.id_os IS NOT NULL
              AND o3.id_os != ''
              AND o3.total_geral IS NOT NULL
              AND o3.total_geral > 0
          )
      `
      app.db().newQuery(queryPasso3).execute()
      console.log('[Migration 0074] Passo 3 concluído com sucesso.')
    } catch (e) {
      console.log('[Migration 0074] Erro no Passo 3 (qualquer orçamento vinculado):', e)
    }

    // PASSO 4: service_orders com total 0/nulo com service_order_items -> total = MAX(0, SUM(quantity*unit_price) - desconto + acréscimo)
    try {
      console.log('[Migration 0074] Passo 4: Atualizando service_orders com service_order_items...')
      const queryPasso4 = `
        UPDATE service_orders
        SET total = MAX(0, (
          SELECT COALESCE(SUM(COALESCE(soi.quantity, 1) * COALESCE(soi.unit_price, 0)), 0)
          FROM service_order_items soi
          WHERE soi.service_order = service_orders.id
        ) - COALESCE(desconto, 0) + COALESCE(acrescimo, 0))
        WHERE (total IS NULL OR total = 0)
          AND id IN (
            SELECT DISTINCT soi2.service_order
            FROM service_order_items soi2
            WHERE soi2.service_order IS NOT NULL
              AND soi2.service_order != ''
          )
      `
      app.db().newQuery(queryPasso4).execute()
      console.log('[Migration 0074] Passo 4 concluído com sucesso.')
    } catch (e) {
      console.log('[Migration 0074] Erro no Passo 4 (service_order_items):', e)
    }
  },
  (app) => {
    // Reversão defensiva
  },
)
