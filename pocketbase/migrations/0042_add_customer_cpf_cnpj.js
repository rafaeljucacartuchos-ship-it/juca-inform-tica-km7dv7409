migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('customers')
    if (!col.fields.getByName('cpf_cnpj')) {
      col.fields.add(new TextField({ name: 'cpf_cnpj' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('customers')
    try {
      col.fields.remove('cpf_cnpj')
    } catch (_) {}
    app.save(col)
  },
)
