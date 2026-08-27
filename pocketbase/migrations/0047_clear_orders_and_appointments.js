migrate(
  (app) => {
    // 1. service_order_items (filho de service_orders)
    app.db().newQuery('DELETE FROM service_order_items').execute()

    // 2. status_history (filho de service_orders)
    app.db().newQuery('DELETE FROM status_history').execute()

    // 3. payments (filho de service_orders)
    app.db().newQuery('DELETE FROM payments').execute()

    // Limpezas adicionais de tabelas vinculadas a service_orders caso existam
    try {
      if (app.hasTable('service_attachments')) {
        app.db().newQuery('DELETE FROM service_attachments').execute()
      }
    } catch (_) {}

    try {
      if (app.hasTable('evaluations')) {
        app.db().newQuery('DELETE FROM evaluations').execute()
      }
    } catch (_) {}

    // 4. service_orders (pai)
    app.db().newQuery('DELETE FROM service_orders').execute()

    // 5. appointments
    app.db().newQuery('DELETE FROM appointments').execute()
  },
  (app) => {
    // Reverter operação de deleção/truncamento não restaura dados excluídos
  },
)
