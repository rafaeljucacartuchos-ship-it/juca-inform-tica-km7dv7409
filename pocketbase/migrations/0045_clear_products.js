migrate(
  (app) => {
    // Apagar todos os registros da collection/tabela products
    app.db().newQuery('DELETE FROM products').execute()
  },
  (app) => {
    // Operação de truncamento/delete em lote não tem rollback de dados
  },
)
