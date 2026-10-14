migrate(
  (app) => {
    // Limpeza de segurança das notificações geradas pelo teste durante o ciclo de migração
    try {
      const testNotifs = app.findRecordsByFilter(
        'notifications',
        "message ~ 'Teste Migracao' || message ~ 'Cenário'",
        '',
        100,
        0,
      )
      for (let tn of testNotifs) {
        app.delete(tn)
      }
      console.log(
        '0103: Notificações de teste temporárias removidas com sucesso: ' + testNotifs.length,
      )
    } catch (err) {
      console.log('0103: Aviso na limpeza:', String(err))
    }
  },
  (app) => {},
)
