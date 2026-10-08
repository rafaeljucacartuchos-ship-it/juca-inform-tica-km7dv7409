migrate(
  (app) => {
    // Public proposals use the token-validated proposta_get/proposta_aprovar hooks.
    // The generic records API must not expose these collections to guests.
    const names = ['orcamentos', 'orcamento_itens', 'orcamento_anexos']
    const rules = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']

    for (const name of names) {
      const collection = app.findCollectionByNameOrId(name)
      let changed = false
      for (const rule of rules) {
        // Keep locked (null) and custom rules installed by the operator.
        if (collection[rule] === '') {
          collection[rule] = "@request.auth.id != ''"
          changed = true
        }
      }
      if (changed) app.save(collection)
    }
  },
  () => {
    // A normal rollback must never silently restore anonymous writes/deletes.
    throw new Error('Security migration 0096 cannot be reverted; use a reviewed forward migration.')
  },
)
