/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Atualizar campos da coleção pricing_history para persistir rateio de custo fixo
    const pricingHistory = app.findCollectionByNameOrId('pricing_history')

    const existingFields = new Set((pricingHistory.fields || []).map((f) => f.name))

    if (!existingFields.has('custo_fixo_rateado_unitario')) {
      pricingHistory.fields.add(
        new NumberField({
          name: 'custo_fixo_rateado_unitario',
          min: 0,
        }),
      )
    }

    if (!existingFields.has('custo_fixo_mensal')) {
      pricingHistory.fields.add(
        new NumberField({
          name: 'custo_fixo_mensal',
          min: 0,
        }),
      )
    }

    if (!existingFields.has('volume_estimado_servicos_mes')) {
      pricingHistory.fields.add(
        new NumberField({
          name: 'volume_estimado_servicos_mes',
          min: 0,
        }),
      )
    }

    app.save(pricingHistory)

    // 2. Inserir valores padrão em settings se ainda não existirem
    const settingsColl = app.findCollectionByNameOrId('settings')

    const defaultEntries = [
      {
        key: 'custo_fixo_mensal',
        value: '12000',
        description: 'Custo fixo mensal para rateio por serviço (R$/mês)',
      },
      {
        key: 'volume_estimado_servicos_mes',
        value: '300',
        description: 'Volume estimado de serviços realizados por mês (qtd)',
      },
    ]

    for (const entry of defaultEntries) {
      try {
        const existing = app.findFirstRecordByFilter(
          'settings',
          app.db().quoteFilter('key = {:key}', { key: entry.key }),
        )
        if (!existing) {
          const record = new Record(settingsColl, {
            key: entry.key,
            value: entry.value,
            description: entry.description,
          })
          app.save(record)
        }
      } catch {
        // Se não encontrou registro, cria
        try {
          const record = new Record(settingsColl, {
            key: entry.key,
            value: entry.value,
            description: entry.description,
          })
          app.save(record)
        } catch (errInner) {
          console.warn('Erro ao inserir chave em settings:', entry.key, errInner)
        }
      }
    }

    // 3. Converter orçamentos com status 'rascunho' ou 'substituido' para 'aguardando_aprovacao'
    try {
      app
        .db()
        .newQuery(
          "UPDATE orcamentos SET status = 'aguardando_aprovacao' WHERE status IN ('rascunho', 'substituido')",
        )
        .execute()
    } catch (errDb) {
      console.warn('Aviso ao converter status legados de orçamentos via SQL:', errDb)
    }
  },
  (app) => {
    // Revert (opcional/no-op para integridade dos dados)
  },
)
