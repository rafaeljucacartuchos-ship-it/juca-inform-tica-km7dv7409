migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('customers')

    // 1. Tornar 'name' e 'phone' não obrigatórios para permitir salvar com novos campos razao_social / celular
    const nameField = col.fields.getByName('name')
    if (nameField) {
      nameField.required = false
    }
    const phoneField = col.fields.getByName('phone')
    if (phoneField) {
      phoneField.required = false
    }

    // 2. Adicionar os novos campos solicitados pela planilha:
    // 1. Razão Social (razao_social)
    // 2. Nome Fantasia (nome_fantasia)
    // 3. Endereço (endereco)
    // 4. Bairro (bairro)
    // 5. Celular (celular)
    // 6. RG/IE (rg_ie)
    // 7. CPF/CNPJ (cpf_cnpj)
    if (!col.fields.getByName('razao_social')) {
      col.fields.add(new TextField({ name: 'razao_social' }))
    }
    if (!col.fields.getByName('nome_fantasia')) {
      col.fields.add(new TextField({ name: 'nome_fantasia' }))
    }
    if (!col.fields.getByName('endereco')) {
      col.fields.add(new TextField({ name: 'endereco' }))
    }
    if (!col.fields.getByName('bairro')) {
      col.fields.add(new TextField({ name: 'bairro' }))
    }
    if (!col.fields.getByName('celular')) {
      col.fields.add(new TextField({ name: 'celular' }))
    }
    if (!col.fields.getByName('rg_ie')) {
      col.fields.add(new TextField({ name: 'rg_ie' }))
    }
    if (!col.fields.getByName('cpf_cnpj')) {
      col.fields.add(new TextField({ name: 'cpf_cnpj' }))
    }

    app.save(col)

    // 3. Migração de dados de compatibilidade para registros já existentes (se houver)
    app
      .db()
      .newQuery(`
      UPDATE customers
      SET razao_social = COALESCE(NULLIF(razao_social, ''), name, ''),
          nome_fantasia = COALESCE(NULLIF(nome_fantasia, ''), name, ''),
          celular = COALESCE(NULLIF(celular, ''), phone, ''),
          endereco = COALESCE(NULLIF(endereco, ''), street, '')
      WHERE (razao_social IS NULL OR razao_social = '')
         OR (celular IS NULL OR celular = '')
    `)
      .execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('customers')
    const fieldsToRemove = [
      'razao_social',
      'nome_fantasia',
      'endereco',
      'bairro',
      'celular',
      'rg_ie',
    ]
    fieldsToRemove.forEach((f) => {
      try {
        col.fields.remove(f)
      } catch (_) {}
    })
    app.save(col)
  },
)
