migrate(
  (app) => {
    // BUGFIX v0.0.245 — CASO ORC-0074 / OS-0074 BACKFILL
    // Diagnóstico: ORC-0074 (id 1wl78s0jd46c3tv) estava vazio (subtotal 0, total_geral 0, 0 itens).
    // O conteúdo real estava na revisão anterior ORC-0074-REV1 (id q378cr1l1tqk9bo): 4 itens, total R$ 730,71.
    // A O.S. 0074 (id 5h16v97uznhzl0b, number OS-0074) estava com service_order_items vazio.
    // 1) Copiar os 4 itens de ORC-0074-REV1 para ORC-0074 em orcamento_itens
    // 2) Recalcular subtotal / total_geral em ORC-0074 (R$ 730,71)
    // 3) Migrar para a O.S. 0074 (5h16v97uznhzl0b): itens em service_order_items, forma de pagamento (pix 1x), notas prefixadas, total sincronizado.
    // Idempotente: se ORC-0074 já tiver itens ou OS-0074 já tiver itens, não duplica.

    try {
      console.log('[Migration 0083] Iniciando backfill do caso ORC-0074 e OS-0074...')

      const targetOrcId = '1wl78s0jd46c3tv'
      const sourceOrcId = 'q378cr1l1tqk9bo'
      const targetOsId = '5h16v97uznhzl0b'

      let targetOrc = null
      let sourceOrc = null
      let targetOs = null

      try {
        targetOrc = app.findRecordById('orcamentos', targetOrcId)
      } catch (e) {
        console.log('[Migration 0083] targetOrc não encontrado:', e)
      }

      try {
        sourceOrc = app.findRecordById('orcamentos', sourceOrcId)
      } catch (e) {
        console.log('[Migration 0083] sourceOrc não encontrado:', e)
      }

      try {
        targetOs = app.findRecordById('service_orders', targetOsId)
      } catch (e) {
        console.log('[Migration 0083] targetOs não encontrada:', e)
      }

      if (!targetOrc || !sourceOrc) {
        console.log('[Migration 0083] Orçamentos não encontrados, abortando backfill pontual.')
        return
      }

      const orcItensCollection = app.findCollectionByNameOrId('orcamento_itens')
      const soItensCollection = app.findCollectionByNameOrId('service_order_items')
      const paymentsCollection = app.findCollectionByNameOrId('payments')

      // 1. Itens da fonte (REV1)
      const sourceItens = app.findRecordsByFilter(
        'orcamento_itens',
        `id_orcamento = "${sourceOrcId}"`,
        'created',
        0,
        0,
      )
      console.log(`[Migration 0083] Itens encontrados em REV1: ${sourceItens.length}`)

      // Itens existentes no destino
      const existingTargetItens = app.findRecordsByFilter(
        'orcamento_itens',
        `id_orcamento = "${targetOrcId}"`,
        'created',
        0,
        0,
      )

      if (existingTargetItens.length === 0 && sourceItens.length > 0) {
        for (let i = 0; i < sourceItens.length; i++) {
          const sItem = sourceItens[i]
          const newItem = new Record(orcItensCollection)
          newItem.set('id_orcamento', targetOrcId)
          newItem.set('tipo', sItem.get('tipo') || 'produto')
          newItem.set('id_produto', sItem.get('id_produto') || null)
          newItem.set('descricao', sItem.get('descricao') || '')
          newItem.set('quantidade', Number(sItem.get('quantidade')) || 1)
          newItem.set('valor_unitario', Number(sItem.get('valor_unitario')) || 0)
          newItem.set('desconto_item', Number(sItem.get('desconto_item')) || 0)
          newItem.set('desconto_item_tipo', sItem.get('desconto_item_tipo') || 'valor')
          newItem.set('valor_total_item', Number(sItem.get('valor_total_item')) || 0)
          app.save(newItem)
        }
        console.log(`[Migration 0083] ${sourceItens.length} itens copiados para ORC-0074.`)
      }

      // 2. Atualizar valores no ORC-0074
      const sourceSubtotal = Number(sourceOrc.get('subtotal')) || 730.71
      const sourceTotalGeral = Number(sourceOrc.get('total_geral')) || 730.71
      const sourceObs = sourceOrc.get('observacoes') || ''
      const sourceFormaPagamento = sourceOrc.get('forma_pagamento') || 'pix'
      const sourceParcelas = Number(sourceOrc.get('parcelas')) || 1

      targetOrc.set('subtotal', sourceSubtotal)
      targetOrc.set('total_geral', sourceTotalGeral)
      if (sourceObs && !targetOrc.get('observacoes')) {
        targetOrc.set('observacoes', sourceObs)
      }
      if (!targetOrc.get('forma_pagamento') || targetOrc.get('forma_pagamento') === 'pix') {
        targetOrc.set('forma_pagamento', sourceFormaPagamento)
      }
      targetOrc.set('parcelas', sourceParcelas)
      app.save(targetOrc)
      console.log(`[Migration 0083] ORC-0074 atualizado: total_geral = ${sourceTotalGeral}`)

      // 3. Migrar para a O.S. 0074
      if (targetOs) {
        // Verificar itens da OS
        const existingOsItens = app.findRecordsByFilter(
          'service_order_items',
          `service_order = "${targetOsId}"`,
          'created',
          0,
          0,
        )

        if (existingOsItens.length === 0 && sourceItens.length > 0) {
          for (let k = 0; k < sourceItens.length; k++) {
            const item = sourceItens[k]
            const osItem = new Record(soItensCollection)
            osItem.set('service_order', targetOsId)
            osItem.set('tipo', item.get('tipo') || 'produto')
            osItem.set('product', item.get('id_produto') || null)
            osItem.set('description', item.get('descricao') || '')
            osItem.set('quantity', Number(item.get('quantidade')) || 1)
            osItem.set('unit_price', Number(item.get('valor_unitario')) || 0)
            osItem.set('total', Number(item.get('valor_total_item')) || 0)
            app.save(osItem)
          }
          console.log(`[Migration 0083] Itens copiados para OS 0074.`)
        }

        // Atualizar total da OS
        targetOs.set('total', sourceTotalGeral)

        // Observações / notas da OS
        if (sourceObs) {
          const currentNotes = (targetOs.get('notes') || '').trim()
          const orcTag = `Do orçamento ${targetOrc.get('numero_orcamento') || 'ORC-0074'}:`
          if (!currentNotes.includes(orcTag)) {
            const block = `${orcTag}\n${sourceObs}`
            targetOs.set('notes', currentNotes ? `${currentNotes}\n\n${block}` : block)
          }
        }
        app.save(targetOs)
        console.log(`[Migration 0083] OS 0074 atualizada com total ${sourceTotalGeral}.`)

        // 4. Pagamento na OS
        const existingPayments = app.findRecordsByFilter(
          'payments',
          `service_order = "${targetOsId}"`,
          'created',
          0,
          0,
        )

        const paymentTag = `Referente ao Orçamento ${targetOrc.get('numero_orcamento') || 'ORC-0074'}`
        let hasPayment = false
        for (let p = 0; p < existingPayments.length; p++) {
          if ((existingPayments[p].get('notes') || '').includes(paymentTag)) {
            hasPayment = true
            break
          }
        }

        if (existingPayments.length === 0 && !hasPayment) {
          const isPaid =
            targetOrc.get('status_pagamento') === 'pago' || targetOrc.get('status') === 'faturado'
          const newPayment = new Record(paymentsCollection)
          newPayment.set('service_order', targetOsId)
          newPayment.set('amount', sourceTotalGeral)
          newPayment.set('method', 'pix')
          newPayment.set('status', isPaid ? 'paid' : 'pending')
          newPayment.set('paid_at', isPaid ? new Date().toISOString() : null)
          newPayment.set('notes', `${paymentTag} (${sourceParcelas}x pix)`)
          app.save(newPayment)
          console.log(`[Migration 0083] Registro de pagamento pix criado para OS 0074.`)
        }
      }

      console.log('[Migration 0083] Backfill concluído com sucesso!')
    } catch (err) {
      console.log('[Migration 0083] Erro no backfill:', err)
      throw err
    }
  },
  (app) => {
    // Reversão defensiva
  },
)
