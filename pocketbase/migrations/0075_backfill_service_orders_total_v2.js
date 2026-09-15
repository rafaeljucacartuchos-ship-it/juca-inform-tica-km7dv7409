migrate(
  (app) => {
    // PARTE 3 — BACKFILL DEFINITIVO DE TOTAL DAS SERVICE_ORDERS
    // Hierarquia de cálculo de total:
    // (1) Orçamento vinculado (id_os = order.id) aprovado/faturado -> total_geral mais recente (> 0)
    // (2) Senão qualquer orçamento vinculado com total_geral > 0 (mesmo rascunho) -> total_geral mais recente
    // (3) Senão soma dos itens de service_order_items (quantity * unit_price, menos desconto + acréscimo da O.S.)
    // (4) Senão 0.
    //
    // Regravar o total onde estiver 0 ou dessincronizado da hierarquia.
    // Caso comprovado que DEVE ser corrigido: OS-0084 (DVR HIKVISION, concluída) com orçamento ORC-0084 (734.76).
    // Não alterar O.S. cujo total já bate com a regra. Migration idempotente.

    try {
      console.log('[Migration 0075] Iniciando backfill de totais de service_orders...')

      // Carregar todas as ordens de serviço
      const orders = app.findRecordsByFilter('service_orders', 'id != ""', 'created', 0, 0)
      console.log(`[Migration 0075] Total de service_orders encontradas: ${orders.length}`)

      // Carregar todos os orçamentos vinculados (id_os != "")
      const orcamentos = app.findRecordsByFilter('orcamentos', 'id_os != ""', 'created', 0, 0)
      console.log(
        `[Migration 0075] Total de orçamentos vinculados encontrados: ${orcamentos.length}`,
      )

      // Mapa de orçamentos por id_os (ordenados por created asc para que os mais recentes sobrescrevam)
      // Agrupamos por id_os
      const orcByOs = {}
      for (let i = 0; i < orcamentos.length; i++) {
        const orc = orcamentos[i]
        const idOs = orc.get('id_os')
        if (!idOs) continue
        if (!orcByOs[idOs]) {
          orcByOs[idOs] = []
        }
        orcByOs[idOs].push(orc)
      }

      // Carregar todos os service_order_items
      const orderItems = app.findRecordsByFilter('service_order_items', 'id != ""', 'created', 0, 0)
      console.log(`[Migration 0075] Total de itens de O.S. encontrados: ${orderItems.length}`)

      const itemsByOs = {}
      for (let j = 0; j < orderItems.length; j++) {
        const item = orderItems[j]
        const soId = item.get('service_order')
        if (!soId) continue
        if (!itemsByOs[soId]) {
          itemsByOs[soId] = []
        }
        itemsByOs[soId].push(item)
      }

      let updatedCount = 0

      for (let k = 0; k < orders.length; k++) {
        const order = orders[k]
        const orderId = order.id
        const currentTotal = Number(order.get('total')) || 0
        const desconto = Number(order.get('desconto')) || 0
        const acrescimo = Number(order.get('acrescimo')) || 0

        let computedTotal = 0
        let ruleMatched = false

        const linkedOrcs = orcByOs[orderId] || []

        // (1) Orçamento vinculado aprovado/faturado com total_geral > 0
        const approvedOrcs = linkedOrcs.filter((o) => {
          const st = o.get('status')
          const tg = Number(o.get('total_geral')) || 0
          return (st === 'aprovado' || st === 'faturado') && tg > 0
        })

        if (approvedOrcs.length > 0) {
          // Mais recente por created
          approvedOrcs.sort((a, b) => {
            const dateA = a.get('created') || ''
            const dateB = b.get('created') || ''
            return dateB.localeCompare(dateA)
          })
          computedTotal = Number(approvedOrcs[0].get('total_geral')) || 0
          ruleMatched = true
        }

        // (2) Senão qualquer orçamento vinculado com total_geral > 0 (mesmo rascunho)
        if (!ruleMatched) {
          const anyValidOrcs = linkedOrcs.filter((o) => {
            const tg = Number(o.get('total_geral')) || 0
            return tg > 0
          })

          if (anyValidOrcs.length > 0) {
            anyValidOrcs.sort((a, b) => {
              const dateA = a.get('created') || ''
              const dateB = b.get('created') || ''
              return dateB.localeCompare(dateA)
            })
            computedTotal = Number(anyValidOrcs[0].get('total_geral')) || 0
            ruleMatched = true
          }
        }

        // (3) Senão soma dos itens de service_order_items (quantity * unit_price - desconto + acrescimo)
        if (!ruleMatched) {
          const items = itemsByOs[orderId] || []
          if (items.length > 0) {
            let itemsSum = 0
            for (let m = 0; m < items.length; m++) {
              const qty = Number(items[m].get('quantity')) || 1
              const unitPrice = Number(items[m].get('unit_price')) || 0
              itemsSum += qty * unitPrice
            }
            computedTotal = Math.max(0, itemsSum - desconto + acrescimo)
            ruleMatched = true
          }
        }

        // (4) Senão 0 (computedTotal já é 0)

        // Arredondamento para 2 casas decimais
        computedTotal = Math.round(computedTotal * 100) / 100

        // Verificar se precisa atualizar (onde estiver 0 ou dessincronizado)
        // Se a diferença for maior que 0.001
        if (Math.abs(currentTotal - computedTotal) > 0.001) {
          const orderNum = order.get('number') || orderId
          console.log(
            `[Migration 0075] Atualizando ${orderNum} (id: ${orderId}): ${currentTotal} -> ${computedTotal}`,
          )
          order.set('total', computedTotal)
          app.save(order)
          updatedCount++
        }
      }

      console.log(
        `[Migration 0075] Backfill concluído com sucesso. Ordens atualizadas: ${updatedCount}`,
      )
    } catch (e) {
      console.log('[Migration 0075] Erro durante o backfill de service_orders:', e)
      throw e
    }
  },
  (app) => {
    // Reversão defensiva
  },
)
