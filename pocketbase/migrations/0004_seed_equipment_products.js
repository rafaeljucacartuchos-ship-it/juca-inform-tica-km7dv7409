migrate(
  (app) => {
    var prodCol = app.findCollectionByNameOrId('products')
    var seedProducts = [
      {
        name: 'Fonte 500W ATX',
        description: 'Fonte de alimentacao 500W ATX 80 Plus Bronze',
        sku: 'FNT-500W-ATX',
        price: 189.9,
        stock: 15,
      },
      {
        name: 'Memoria RAM 8GB DDR4',
        description: 'Memoria RAM 8GB DDR4 2666MHz Desktop',
        sku: 'RAM-8GB-DDR4',
        price: 149.9,
        stock: 30,
      },
    ]
    for (var i = 0; i < seedProducts.length; i++) {
      var p = seedProducts[i]
      try {
        app.findFirstRecordByData('products', 'sku', p.sku)
      } catch (_) {
        var prec = new Record(prodCol)
        prec.set('name', p.name)
        prec.set('description', p.description)
        prec.set('sku', p.sku)
        prec.set('price', p.price)
        prec.set('stock_quantity', p.stock)
        prec.set('active', true)
        app.save(prec)
      }
    }

    var eqCol = app.findCollectionByNameOrId('equipment')
    var cust1 = null,
      cust3 = null
    try {
      cust1 = app.findFirstRecordByData('customers', 'name', 'Mariana Souza')
    } catch (_) {}
    try {
      cust3 = app.findFirstRecordByData('customers', 'name', 'Roberto Mendonca')
    } catch (_) {}

    if (cust1) {
      try {
        app.findFirstRecordByData('equipment', 'serial_number', 'DLINS15-5500-001')
      } catch (_) {
        var eq1 = new Record(eqCol)
        eq1.set('customer', cust1.id)
        eq1.set('name', 'Notebook Dell Inspiron 15')
        eq1.set('type', 'notebook')
        eq1.set('brand', 'Dell')
        eq1.set('model', 'Inspiron 15 5000')
        eq1.set('serial_number', 'DLINS15-5500-001')
        eq1.set('notes', 'i7 8GB RAM, em uso para trabalho remoto')
        app.save(eq1)
      }
    }

    if (cust3) {
      try {
        app.findFirstRecordByData('equipment', 'serial_number', 'STG-1TB-EXT-002')
      } catch (_) {
        var eq2 = new Record(eqCol)
        eq2.set('customer', cust3.id)
        eq2.set('name', 'HD Externo Seagate 1TB')
        eq2.set('type', 'other')
        eq2.set('brand', 'Seagate')
        eq2.set('model', 'Expansion 1TB')
        eq2.set('serial_number', 'STG-1TB-EXT-002')
        eq2.set('notes', 'HD externo para backup, porta USB 3.0')
        app.save(eq2)
      }
    }
  },
  (app) => {},
)
