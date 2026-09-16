/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Atualizar campos da coleção pricing_history para persistir custo_fixo_pct
    const pricingHistory = app.findCollectionByNameOrId('pricing_history')

    const existingFields = new Set((pricingHistory.fields || []).map((f) => f.name))

    if (!existingFields.has('custo_fixo_pct')) {
      pricingHistory.fields.add(
        new NumberField({
          name: 'custo_fixo_pct',
          min: 0,
        }),
      )
      app.save(pricingHistory)
    }

    // 2. Inserir valor padrão para custo_fixo_pct em settings se ainda não existir
    const settingsColl = app.findCollectionByNameOrId('settings')
    try {
      const existing = app.findFirstRecordByFilter(
        'settings',
        app.db().quoteFilter('key = {:key}', { key: 'custo_fixo_pct' }),
      )
      if (!existing) {
        const record = new Record(settingsColl, {
          key: 'custo_fixo_pct',
          value: '0',
          description: 'Custo fixo em porcentagem (%) sobre o preço sugerido na precificação',
        })
        app.save(record)
      }
    } catch {
      try {
        const record = new Record(settingsColl, {
          key: 'custo_fixo_pct',
          value: '0',
          description: 'Custo fixo em porcentagem (%) sobre o preço sugerido na precificação',
        })
        app.save(record)
      } catch (errInner) {
        console.warn('Erro ao inserir chave custo_fixo_pct em settings:', errInner)
      }
    }
  },
  (app) => {
    // Revert
    try {
      const pricingHistory = app.findCollectionByNameOrId('pricing_history')
      pricingHistory.fields.removeByName('custo_fixo_pct')
      app.save(pricingHistory)
    } catch (_) {}
  },
)
