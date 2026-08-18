// Automatic stock control: when a service order is marked as "completed",
// walk every order item linked to it that references a `product` (i.e. a real
// product/peça, not a service) and subtract its `quantity` from the product's
// `stock_quantity`. The deduction runs ONCE per O.S. — guarded by the
// `stock_deducted` boolean on service_orders — so reopening and closing again
// never double-counts. Negative stock is allowed (only logged) and never
// blocks the conclusion of the O.S.
onRecordAfterUpdateSuccess((e) => {
  var currStatus = e.record.getString('status')
  if (currStatus !== 'completed') return e.next()

  // Already deducted once — never deduct again (idempotent across reopen/close).
  if (e.record.getBool('stock_deducted')) return e.next()

  var soId = e.record.id
  var number = e.record.getString('number')

  try {
    var items = $app.findRecordsByFilter(
      'service_order_items',
      'service_order = "' + soId + '"',
      '',
      0,
      0,
    )

    var deductedCount = 0
    for (var i = 0; i < items.length; i++) {
      var productId = items[i].getString('product')
      if (!productId) continue // service-only item — nothing to deduct

      var qty = items[i].getInt('quantity') || 0
      if (qty <= 0) continue

      try {
        var prod = $app.findRecordById('products', productId)
        var currentStock = prod.getInt('stock_quantity') || 0
        var newStock = currentStock - qty
        prod.set('stock_quantity', newStock)
        $app.save(prod)
        deductedCount++

        if (newStock < 0) {
          $app
            .logger()
            .warn(
              'Stock went negative after O.S. completion (allowed)',
              'os',
              number,
              'product',
              prod.getString('name'),
              'newStock',
              String(newStock),
            )
        }
      } catch (prodErr) {
        // A single missing/failing product must not stop the rest.
        $app
          .logger()
          .error(
            'Failed to deduct stock for product',
            'os',
            number,
            'product',
            productId,
            'error',
            String(prodErr),
          )
      }
    }

    // Mark the O.S. as deducted so a future reopen+close never re-deducts.
    try {
      var soRec = $app.findRecordById('service_orders', soId)
      soRec.set('stock_deducted', true)
      $app.save(soRec)
    } catch (markErr) {
      $app
        .logger()
        .error('Failed to mark stock_deducted on O.S.', 'os', number, 'error', String(markErr))
    }

    $app
      .logger()
      .info('Stock deducted on O.S. completion', 'os', number, 'items', String(deductedCount))
  } catch (err) {
    $app.logger().error('Stock deduction failed (non-blocking)', 'os', number, 'error', String(err))
  }

  return e.next()
}, 'service_orders')
