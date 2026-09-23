migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pos_venda_messages')
    const tipoField = col.fields.getByName('tipo')
    const statusField = col.fields.getByName('status')

    if (tipoField) {
      // Adicionar novos tipos: documento_os, follow_up_proposta, log_interno mantendo os anteriores
      const currentValues = tipoField.values || []
      const newTypes = ['documento_os', 'follow_up_proposta', 'log_interno']
      for (const t of newTypes) {
        if (!currentValues.includes(t)) {
          currentValues.push(t)
        }
      }
      tipoField.values = currentValues
      col.fields.add(tipoField)
    }

    if (statusField) {
      // Adicionar novos status: lembrete (reenvio único), sem_resposta (arquivamento de silêncio 14d+)
      const currentStatuses = statusField.values || []
      const newStatuses = ['lembrete', 'sem_resposta']
      for (const s of newStatuses) {
        if (!currentStatuses.includes(s)) {
          currentStatuses.push(s)
        }
      }
      statusField.values = currentStatuses
      col.fields.add(statusField)
    }

    app.save(col)

    // Separação dos registros legados existentes do tipo 'resumo_finalizacao':
    // 1) Registros de canal 'sistema' ou texto de aprovação de orçamento -> 'log_interno'
    // 2) Registros com link da proposta online ou texto "proposta" / "orçamento" -> 'follow_up_proposta'
    // 3) Registros de envio do documento da O.S. -> 'documento_os'
    try {
      const records = app.findRecordsByFilter(
        'pos_venda_messages',
        'tipo = "resumo_finalizacao"',
        'created',
        500,
        0,
      )

      if (records && records.length > 0) {
        for (const rec of records) {
          const channel = rec.getString('channel') || ''
          const text = (rec.getString('texto_gerado') || '').toLowerCase()

          if (
            channel === 'sistema' ||
            text.includes('aprovado e enviado para faturamento') ||
            text.includes('aprovada e assinada online') ||
            text.includes('iniciada.') ||
            text.includes('reenvio de faturamento')
          ) {
            rec.set('tipo', 'log_interno')
          } else if (
            text.includes('ficou dentro do que você procurava') ||
            text.includes('ficou dentro do que você estava procurando') ||
            text.includes('preparamos a proposta') ||
            text.includes('proposta integrada') ||
            text.includes('/proposta/') ||
            text.includes('visualizar orçamento') ||
            text.includes('segue o orçamento do seu atendimento')
          ) {
            rec.set('tipo', 'follow_up_proposta')
          } else {
            // Documento oficial da OS / comprovante digital / /share/
            rec.set('tipo', 'documento_os')
          }

          app.save(rec)
        }
      }
    } catch (migErr) {
      // Registra no log mas não interrompe
      app
        .logger()
        .warn(
          '0093_split_resumo_finalizacao_and_add_types: aviso na conversão de registros',
          'error',
          String(migErr),
        )
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('pos_venda_messages')
      // Reversão tolerante
      app.save(col)
    } catch (_) {}
  },
)
