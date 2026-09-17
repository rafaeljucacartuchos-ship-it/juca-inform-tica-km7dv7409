/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Atualizar campos da coleção pricing_history para persistir subst_tributaria_pct
    const pricingHistory = app.findCollectionByNameOrId('pricing_history')

    const existingFields = new Set((pricingHistory.fields || []).map((f) => f.name))

    if (!existingFields.has('subst_tributaria_pct')) {
      pricingHistory.fields.add(
        new NumberField({
          name: 'subst_tributaria_pct',
          min: 0,
        }),
      )
      app.save(pricingHistory)
    }

    // 2. Inserir valor padrão para subst_tributaria_pct em settings se ainda não existir
    const settingsColl = app.findCollectionByNameOrId('settings')
    try {
      const records = app.findRecordsByFilter('settings', 'key = "subst_tributaria_pct"', '', 1, 0)
      if (!records || records.length === 0) {
        const record = new Record(settingsColl, {
          key: 'subst_tributaria_pct',
          value: '0',
          description:
            'Alíquota padrão de Substituição Tributária (ST) (%) incidente no custo do produto',
        })
        app.save(record)
      }
    } catch {
      try {
        const record = new Record(settingsColl, {
          key: 'subst_tributaria_pct',
          value: '0',
          description:
            'Alíquota padrão de Substituição Tributária (ST) (%) incidente no custo do produto',
        })
        app.save(record)
      } catch (errInner) {
        console.warn('Erro ao inserir chave subst_tributaria_pct em settings:', errInner)
      }
    }
  },
  (app) => {
    // Revert
    try {
      const pricingHistory = app.findCollectionByNameOrId('pricing_history')
      pricingHistory.fields.removeByName('subst_tributaria_pct')
      app.save(pricingHistory)
    } catch (_) {}
  },
)
