onRecordCreate((e) => {
  var normalizeText = function (str) {
    if (!str) return ''
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'c')
      .toLowerCase()
      .trim()
  }

  var name = e.record.getString('name') || ''
  var sku = e.record.getString('sku') || ''
  var barcode = e.record.getString('barcode') || ''
  var codigoBarras = e.record.getString('codigo_barras') || ''

  var parts = [
    normalizeText(name),
    normalizeText(sku),
    normalizeText(barcode),
    normalizeText(codigoBarras),
  ].filter(Boolean)

  var uniqueTokens = []
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i]
    if (uniqueTokens.indexOf(p) === -1) {
      uniqueTokens.push(p)
    }
  }

  var searchText = uniqueTokens.join(' ')
  e.record.set('search_text', searchText)
  e.next()
}, 'products')
