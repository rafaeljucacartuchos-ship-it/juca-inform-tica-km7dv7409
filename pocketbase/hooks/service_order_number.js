onRecordCreate((e) => {
  var existingNumber = e.record.getString('number')
  if (existingNumber && existingNumber.trim()) {
    return e.next()
  }

  // 1. Extrair o maior sufixo numérico existente de todos os service_order_number já cadastrados
  var maxNum = 0
  try {
    // Busca registros ordenados por número decrescente ou criados recentemente
    var records = $app.findRecordsByFilter('service_orders', "number != ''", '-created', 500, 0)
    var regex = /OS-(\d+)/i
    for (var i = 0; i < records.length; i++) {
      var numStr = records[i].getString('number')
      if (numStr) {
        var match = numStr.match(regex)
        if (match && match[1]) {
          var val = parseInt(match[1], 10)
          if (!isNaN(val) && val > maxNum) {
            maxNum = val
          }
        }
      }
    }
  } catch (err) {
    // Fallback: se a busca falhar, tenta usar a contagem
    try {
      maxNum = $app.countRecords('service_orders')
    } catch (_) {
      maxNum = 0
    }
  }

  // 2. Garante que nunca é inferior à contagem total
  try {
    var totalCount = $app.countRecords('service_orders')
    if (totalCount > maxNum) {
      maxNum = totalCount
    }
  } catch (_) {}

  // 3. Incrementa e verifica se o número gerado está realmente livre
  var candidateNum = maxNum + 1
  var foundFree = false
  var attempts = 0
  var maxAttempts = 50

  while (!foundFree && attempts < maxAttempts) {
    attempts++
    var pad = String(candidateNum).padStart(4, '0')
    var candidateFormatted = 'OS-' + pad

    try {
      var existing = $app.findFirstRecordByData('service_orders', 'number', candidateFormatted)
      if (existing && existing.id) {
        // Já existe esse número, tenta o próximo
        candidateNum++
      } else {
        foundFree = true
        e.record.set('number', candidateFormatted)
      }
    } catch (_) {
      // findFirstRecordByData lança se não encontrar ("sql: no rows in result set")
      // Portanto, o número está livre!
      foundFree = true
      e.record.set('number', candidateFormatted)
    }
  }

  if (!foundFree) {
    // Fallback de segurança se exceder as tentativas
    var fallbackPad = String(candidateNum).padStart(4, '0')
    e.record.set('number', 'OS-' + fallbackPad)
  }

  e.next()
}, 'service_orders')
