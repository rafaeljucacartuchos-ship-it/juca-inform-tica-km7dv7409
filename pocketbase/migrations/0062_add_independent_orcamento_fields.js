migrate(
  (app) => {
    const orcamentosCol = app.findCollectionByNameOrId('orcamentos')
    const customersCol = app.findCollectionByNameOrId('customers')

    // 1. Cliente vinculado opcional (relação com customers)
    if (!orcamentosCol.fields.getByName('cliente_id')) {
      orcamentosCol.fields.add(
        new RelationField({
          name: 'cliente_id',
          required: false,
          collectionId: customersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    // 2. Nome do cliente livre (sem cadastro obrigatório)
    if (!orcamentosCol.fields.getByName('nome_cliente_livre')) {
      orcamentosCol.fields.add(
        new TextField({
          name: 'nome_cliente_livre',
          required: false,
        }),
      )
    }

    // 3. Telefone do cliente livre
    if (!orcamentosCol.fields.getByName('telefone_cliente_livre')) {
      orcamentosCol.fields.add(
        new TextField({
          name: 'telefone_cliente_livre',
          required: false,
        }),
      )
    }

    // 4. Técnico ou vendedor responsável (lista de usuários)
    if (!orcamentosCol.fields.getByName('responsavel_id')) {
      orcamentosCol.fields.add(
        new RelationField({
          name: 'responsavel_id',
          required: false,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    // 5. Equipamento opcional para orçamentos independentes
    if (!orcamentosCol.fields.getByName('equipamento_independente')) {
      orcamentosCol.fields.add(
        new TextField({
          name: 'equipamento_independente',
          required: false,
        }),
      )
    }

    // 6. Defeito relatado opcional para orçamentos independentes
    if (!orcamentosCol.fields.getByName('defeito_independente')) {
      orcamentosCol.fields.add(
        new TextField({
          name: 'defeito_independente',
          required: false,
        }),
      )
    }

    app.save(orcamentosCol)

    // Adiciona índices não-únicos úteis
    try {
      orcamentosCol.addIndex('idx_orcamentos_cliente', false, 'cliente_id', '')
      orcamentosCol.addIndex('idx_orcamentos_responsavel', false, 'responsavel_id', '')
      app.save(orcamentosCol)
    } catch (e) {
      console.log('Aviso ao adicionar índices em orcamentos:', e)
    }
  },
  (app) => {
    try {
      const orcamentosCol = app.findCollectionByNameOrId('orcamentos')
      const fieldsToRemove = [
        'cliente_id',
        'nome_cliente_livre',
        'telefone_cliente_livre',
        'responsavel_id',
        'equipamento_independente',
        'defeito_independente',
      ]
      for (const f of fieldsToRemove) {
        if (orcamentosCol.fields.getByName(f)) {
          orcamentosCol.fields.removeByName(f)
        }
      }
      try {
        orcamentosCol.removeIndex('idx_orcamentos_cliente')
        orcamentosCol.removeIndex('idx_orcamentos_responsavel')
      } catch (_) {}
      app.save(orcamentosCol)
    } catch (_) {}
  },
)
