migrate(
  (app) => {
    var paymentsCol = app.findCollectionByNameOrId('payments')
    paymentsCol.addIndex('idx_pay_status', false, 'status', '')
    app.save(paymentsCol)
  },
  (app) => {
    var paymentsCol = app.findCollectionByNameOrId('payments')
    paymentsCol.removeIndex('idx_pay_status')
    app.save(paymentsCol)
  },
)
