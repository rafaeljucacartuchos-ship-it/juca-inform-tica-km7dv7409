migrate(
  (app) => {
    // 1. Ampliar coleção pricing_history com campos adicionais opcionais
    const pricingHistoryCol = app.findCollectionByNameOrId('pricing_history')

    if (!pricingHistoryCol.fields.getByName('frete')) {
      pricingHistoryCol.fields.add(
        new NumberField({
          name: 'frete',
          required: false,
        }),
      )
    }

    if (!pricingHistoryCol.fields.getByName('custos_adicionais')) {
      pricingHistoryCol.fields.add(
        new NumberField({
          name: 'custos_adicionais',
          required: false,
        }),
      )
    }

    if (!pricingHistoryCol.fields.getByName('custos_variaveis_pct')) {
      pricingHistoryCol.fields.add(
        new NumberField({
          name: 'custos_variaveis_pct',
          required: false,
        }),
      )
    }

    if (!pricingHistoryCol.fields.getByName('despesa_fixa_pct')) {
      pricingHistoryCol.fields.add(
        new NumberField({
          name: 'despesa_fixa_pct',
          required: false,
        }),
      )
    }

    if (!pricingHistoryCol.fields.getByName('custo_moeda')) {
      pricingHistoryCol.fields.add(
        new SelectField({
          name: 'custo_moeda',
          required: false,
          values: ['BRL', 'USD'],
          maxSelect: 1,
        }),
      )
    }

    if (!pricingHistoryCol.fields.getByName('cost_usd')) {
      pricingHistoryCol.fields.add(
        new NumberField({
          name: 'cost_usd',
          required: false,
        }),
      )
    }

    if (!pricingHistoryCol.fields.getByName('cotacao_dolar')) {
      pricingHistoryCol.fields.add(
        new NumberField({
          name: 'cotacao_dolar',
          required: false,
        }),
      )
    }

    if (!pricingHistoryCol.fields.getByName('taxa_cartao_pct')) {
      pricingHistoryCol.fields.add(
        new NumberField({
          name: 'taxa_cartao_pct',
          required: false,
        }),
      )
    }

    if (!pricingHistoryCol.fields.getByName('icms_pct')) {
      pricingHistoryCol.fields.add(
        new NumberField({
          name: 'icms_pct',
          required: false,
        }),
      )
    }

    if (!pricingHistoryCol.fields.getByName('comissao_pct')) {
      pricingHistoryCol.fields.add(
        new NumberField({
          name: 'comissao_pct',
          required: false,
        }),
      )
    }

    if (!pricingHistoryCol.fields.getByName('ipi_pct')) {
      pricingHistoryCol.fields.add(
        new NumberField({
          name: 'ipi_pct',
          required: false,
        }),
      )
    }

    app.save(pricingHistoryCol)

    // 2. Criar ou inicializar configurações padrão da empresa se não existirem
    const settingsCol = app.findCollectionByNameOrId('settings')
    const defaultSettings = [
      {
        key: 'cotacao_dolar',
        value: '5.65',
        description: 'Cotação do Dólar (R$ por US$) para conversão de custos na precificação',
      },
      {
        key: 'frete_padrao',
        value: '0',
        description: 'Valor padrão de frete por item precificado (R$)',
      },
      {
        key: 'taxa_cartao_pct',
        value: '3.5',
        description: 'Taxa média de cartão de crédito/débito (%)',
      },
      {
        key: 'icms_pct',
        value: '4.0',
        description: 'Alíquota de imposto ICMS / Simples Nacional (%)',
      },
      {
        key: 'comissao_pct',
        value: '2.5',
        description: 'Comissão de vendas (%)',
      },
      {
        key: 'ipi_pct',
        value: '0',
        description: 'Alíquota de IPI / outros tributos incidentes (%)',
      },
      {
        key: 'despesa_fixa_mensal',
        value: '15000',
        description: 'Despesa fixa mensal total da empresa (R$)',
      },
      {
        key: 'faturamento_medio_mensal',
        value: '100000',
        description: 'Faturamento médio mensal da empresa (R$)',
      },
      {
        key: 'lucratividade_desejada_pct',
        value: '25.0',
        description: 'Margem de lucratividade líquida desejada alvo (%)',
      },
    ]

    for (let i = 0; i < defaultSettings.length; i++) {
      const item = defaultSettings[i]
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
      const fieldsToRemove = [
        'frete',
        'custos_adicionais',
        'custos_variaveis_pct',
        'despesa_fixa_pct',
        'custo_moeda',
        'cost_usd',
        'cotacao_dolar',
        'taxa_cartao_pct',
        'icms_pct',
        'comissao_pct',
        'ipi_pct',
      ]
      for (let i = 0; i < fieldsToRemove.length; i++) {
        const fieldName = fieldsToRemove[i]
        const f = pricingHistoryCol.fields.getByName(fieldName)
        if (f) pricingHistoryCol.fields.removeByName(fieldName)
      }
      app.save(pricingHistoryCol)
    } catch (_) {}
  },
)
