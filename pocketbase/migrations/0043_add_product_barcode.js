migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('products')
    if (!col.fields.getByName('barcode')) {
      col.fields.add(new TextField({ name: 'barcode' }))
    }
    if (!col.fields.getByName('codigo_barras')) {
      col.fields.add(new TextField({ name: 'codigo_barras' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('products')
    const barcodeField = col.fields.getByName('barcode')
    if (barcodeField) col.fields.remove(barcodeField)
    const codigoBarrasField = col.fields.getByName('codigo_barras')
    if (codigoBarrasField) col.fields.remove(codigoBarrasField)
    app.save(col)
  },
)
