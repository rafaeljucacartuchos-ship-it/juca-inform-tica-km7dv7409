migrate(
  (app) => {
    // 1. Deletar todos os produtos
    app.db().newQuery('DELETE FROM products').execute()

    // 2. Deletar todos os clientes (tabela customers no banco de dados SQLite)
    app.db().newQuery('DELETE FROM customers').execute()

    // Caso exista alguma tabela ou view chamada clients, tentar com segurança
    try {
      if (app.hasTable('clients')) {
        app.db().newQuery('DELETE FROM clients').execute()
      }
    } catch (_) {}
  },
  (app) => {
    // Reverter operação de truncamento/delete não restaura dados excluídos
  },
)
