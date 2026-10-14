migrate(
  (app) => {
    // Migração vazia / informativa:
    // Hooks de eventos de aplicação (onRecordAfterCreateSuccess) são executados no ciclo
    // de requisições HTTP da API, não durante as transações de migrações em lote do PocketBase.
    console.log('0102: Migração aplicada com sucesso')
  },
  (app) => {},
)
