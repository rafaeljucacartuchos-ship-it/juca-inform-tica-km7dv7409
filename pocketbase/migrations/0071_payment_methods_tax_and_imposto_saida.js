migrate(
  (app) => {
    // 1. Ampliar coleção pricing_history com campos opcionais adicionais:
    // imposto_saida_pct e payment_method_nome
    const pricingHistoryCol = app.findCollectionByNameOrId('pricing_history')

    if (!pricingHistoryCol.fields.getByName('imposto_saida_pct')) {
      pricingHistoryCol.fields.add(
        new NumberField({
          name: 'imposto_saida_pct',
          required: false,
        }),
      )
    }

    if (!pricingHistoryCol.fields.getByName('payment_method_nome')) {
      pricingHistoryCol.fields.add(
        new TextField({
          name: 'payment_method_nome',
          required: false,
        }),
      )
    }

    app.save(pricingHistoryCol)

    // 2. Criar ou inicializar configurações padrão em 'settings'
    const settingsCol = app.findCollectionByNameOrId('settings')

    // Tabela padrão de formas de pagamento com taxas
    const defaultPaymentMethods = [
      { id: 'debito', nome: 'Débito', taxa_pct: 1.5, parcelas: 1 },
      { id: 'credito_vista', nome: 'Crédito à vista (1x)', taxa_pct: 3.5, parcelas: 1 },
      { id: 'credito_2x', nome: 'Crédito 2x', taxa_pct: 4.5, parcelas: 2 },
      { id: 'credito_3x', nome: 'Crédito 3x', taxa_pct: 5.5, parcelas: 3 },
      { id: 'credito_4x', nome: 'Crédito 4x', taxa_pct: 6.5, parcelas: 4 },
      { id: 'credito_5x', nome: 'Crédito 5x', taxa_pct: 7.5, parcelas: 5 },
      { id: 'credito_6x', nome: 'Crédito 6x', taxa_pct: 8.5, parcelas: 6 },
      { id: 'credito_7x', nome: 'Crédito 7x', taxa_pct: 9.5, parcelas: 7 },
      { id: 'credito_8x', nome: 'Crédito 8x', taxa_pct: 10.5, parcelas: 8 },
      { id: 'credito_9x', nome: 'Crédito 9x', taxa_pct: 11.5, parcelas: 9 },
      { id: 'credito_10x', nome: 'Crédito 10x', taxa_pct: 12.5, parcelas: 10 },
      { id: 'credito_11x', nome: 'Crédito 11x', taxa_pct: 13.5, parcelas: 11 },
      { id: 'credito_12x', nome: 'Crédito 12x', taxa_pct: 14.5, parcelas: 12 },
    ]

    const newSettings = [
      {
        key: 'payment_methods_tax',
        value: JSON.stringify(defaultPaymentMethods),
        description: 'Tabela de formas de pagamento e taxas de cartão (%) em formato JSON',
      },
      {
        key: 'imposto_saida_pct',
        value: '4.0',
        description: 'Alíquota de imposto de saída (%) incidente nas vendas',
      },
    ]

    for (let i = 0; i < newSettings.length; i++) {
      const item = newSettings[i]
      try {
        app.findFirstRecordByData('settings', 'key', item.key)
      } catch (_) {
        const record = new Record(settingsCol)
        record.set('key', item.key)
        record.set('value', item.value)
        record.set('description', item.description)
        app.save(record)
      }
    }
  },
  (app) => {
    try {
      const pricingHistoryCol = app.findCollectionByNameOrId('pricing_history')
      if (pricingHistoryCol.fields.getByName('imposto_saida_pct')) {
        pricingHistoryCol.fields.removeByName('imposto_saida_pct')
      }
      if (pricingHistoryCol.fields.getByName('payment_method_nome')) {
        pricingHistoryCol.fields.removeByName('payment_method_nome')
      }
      app.save(pricingHistoryCol)
    } catch (_) {}
  },
)
