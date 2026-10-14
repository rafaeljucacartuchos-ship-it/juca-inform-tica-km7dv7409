// pocketbase/migrations/0100_allow_admin_financial_receivables.js
// Permite que administradores autenticados listem e visualizem financial_receivables
// Preserva superusers e segurança sem expor publicamente dados de recebíveis

migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('financial_receivables')
      col.listRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      col.viewRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(col)
    } catch (e) {
      console.log('Erro ao atualizar regras de financial_receivables:', e)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('financial_receivables')
      col.listRule = null
      col.viewRule = null
      app.save(col)
    } catch (_) {}
  },
)
