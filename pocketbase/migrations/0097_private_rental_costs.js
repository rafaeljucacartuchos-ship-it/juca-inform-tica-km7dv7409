migrate(
  (app) => {
    // Preserve existing custom restrictions while removing cost access from non-admins.
    const admin = "@request.auth.id != '' && @request.auth.role = 'admin'"
    for (const name of [
      'impressoras',
      'suprimentos',
      'parametros',
      'auditoria_precos',
      'rental_reserve',
      'rental_machines',
      'contratos',
    ]) {
      const c = app.findCollectionByNameOrId(name)
      for (const key of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) {
        if (c[key] !== null) c[key] = c[key] ? '(' + c[key] + ') && (' + admin + ')' : admin
      }
      app.save(c)
    }
  },
  () => {
    throw new Error(
      'Reversão exige revisão explícita das permissões; não reabrir custos automaticamente.',
    )
  },
)
