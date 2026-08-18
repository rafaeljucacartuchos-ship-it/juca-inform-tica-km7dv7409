migrate(
  (app) => {
    // 1. Add `stock_deducted` bool flag to service_orders so the backend hook
    //    can guarantee stock is decremented only once per O.S. (even if the
    //    O.S. is reopened and closed again).
    var soCol = app.findCollectionByNameOrId('service_orders')
    if (!soCol.fields.getByName('stock_deducted')) {
      soCol.fields.add(new BoolField({ name: 'stock_deducted' }))
    }
    app.save(soCol)

    // 2. Add `product` relation to service_order_items. Today items only link
    //    to `services`; products are added as plain text descriptions with no
    //    reference, making automatic stock deduction impossible. This relation
    //    lets the completion hook know exactly which product each item consumes.
    var productsCol = app.findCollectionByNameOrId('products')
    var soiCol = app.findCollectionByNameOrId('service_order_items')
    if (!soiCol.fields.getByName('product')) {
      soiCol.fields.add(
        new RelationField({
          name: 'product',
          collectionId: productsCol.id,
          maxSelect: 1,
        }),
      )
    }
    app.save(soiCol)
  },
  (app) => {
    try {
      var soCol = app.findCollectionByNameOrId('service_orders')
      var f1 = soCol.fields.getByName('stock_deducted')
      if (f1) soCol.fields.remove(f1)
      app.save(soCol)
    } catch (_) {}
    try {
      var soiCol = app.findCollectionByNameOrId('service_order_items')
      var f2 = soiCol.fields.getByName('product')
      if (f2) soiCol.fields.remove(f2)
      app.save(soiCol)
    } catch (_) {}
  },
)
