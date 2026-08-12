migrate(
  (app) => {
    const paymentsCol = app.findCollectionByNameOrId('payments')
    paymentsCol.addIndex('idx_pay_paid_at', false, 'paid_at', '')
    app.save(paymentsCol)

    const statusHistoryCol = app.findCollectionByNameOrId('status_history')
    statusHistoryCol.addIndex('idx_sh_status', false, 'status', '')
    app.save(statusHistoryCol)
  },
  (app) => {
    const paymentsCol = app.findCollectionByNameOrId('payments')
    paymentsCol.removeIndex('idx_pay_paid_at')
    app.save(paymentsCol)

    const statusHistoryCol = app.findCollectionByNameOrId('status_history')
    statusHistoryCol.removeIndex('idx_sh_status')
    app.save(statusHistoryCol)
  },
)
