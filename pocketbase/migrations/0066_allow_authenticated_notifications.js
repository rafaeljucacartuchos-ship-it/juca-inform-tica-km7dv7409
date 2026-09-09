migrate(
  (app) => {
    // 1. Atualizar regras da coleção notifications para permitir criação por usuários autenticados
    // e exclusão se for a própria notificação.
    try {
      const notifications = app.findCollectionByNameOrId('notifications')
      notifications.createRule = "@request.auth.id != ''"
      notifications.deleteRule = 'user = @request.auth.id'
      app.save(notifications)
    } catch (e) {
      console.log('Erro ao atualizar regras de notifications:', e)
    }

    // 2. Garantir regras da coleção push_subscriptions
    try {
      const pushSubs = app.findCollectionByNameOrId('push_subscriptions')
      pushSubs.createRule = "@request.auth.id != ''"
      pushSubs.updateRule = "@request.auth.id != ''"
      pushSubs.deleteRule = "@request.auth.id != ''"
      app.save(pushSubs)
    } catch (e) {
      console.log('Erro ao atualizar regras de push_subscriptions:', e)
    }
  },
  (app) => {
    try {
      const notifications = app.findCollectionByNameOrId('notifications')
      notifications.createRule = null
      notifications.deleteRule = null
      app.save(notifications)
    } catch (_) {}
  },
)
