routerAdd('POST', '/backend/v1/shared-order/{id}/sign', (e) => {
  // ----------------------------------------------------------------
  // Rota PÚBLICA de assinatura do cliente (página /share legada).
  //
  // O frontend envia a assinatura como JSON:
  //   { "signature": "data:image/png;base64,iVBORw0KGgo..." }
  //
  // Mesma abordagem base64+JSON de /backend/v1/os/{id}/sign — evita os
  // problemas de MIME do multipart em navegadores móveis.
  // ----------------------------------------------------------------

  const id = e.request.pathValue('id')

  let record
  try {
    record = $app.findRecordById('service_orders', id)
  } catch (_) {
    return e.json(404, { error: 'Ordem de serviço não encontrada' })
  }

  if (record.getString('customer_signature')) {
    return e.json(400, { error: 'Esta ordem de serviço já foi assinada pelo cliente' })
  }

  const body = e.requestInfo().body || {}
  let signature = body.signature || ''
  if (!signature) {
    return e.json(400, { error: 'Assinatura é obrigatória' })
  }

  // Remove o prefixo "data:image/png;base64," (ou equivalente) se presente.
  const commaIdx = signature.indexOf(',')
  if (commaIdx >= 0) {
    signature = signature.substring(commaIdx + 1)
  }

  // Decodifica o base64 para bytes. O JSVM (goja) não expõe atob/btoa nem
  // TextDecoder, então implementamos a decodificação base64 manualmente.
  const base64ToByteArray = function (base64String) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

    base64String = base64String.replace(/\s/g, '')
    base64String = base64String.replace(/=/g, '')

    while (base64String.length % 4 !== 0) {
      base64String += 'A'
    }

    var byteArray = new Uint8Array((base64String.length * 3) / 4)

    var byteIndex = 0
    var charIndex = 0

    while (charIndex < base64String.length) {
      var enc1 = chars.indexOf(base64String.charAt(charIndex++))
      var enc2 = chars.indexOf(base64String.charAt(charIndex++))
      var enc3 = chars.indexOf(base64String.charAt(charIndex++))
      var enc4 = chars.indexOf(base64String.charAt(charIndex++))

      if (enc1 === -1 || enc2 === -1 || enc3 === -1 || enc4 === -1) {
        throw new Error('Caractere inválido na string base64 da assinatura')
      }

      var bits24 = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4

      var byte1 = (bits24 >> 16) & 0xff
      var byte2 = (bits24 >> 8) & 0xff
      var byte3 = bits24 & 0xff

      byteArray[byteIndex++] = byte1
      if (enc3 !== 64) {
        byteArray[byteIndex++] = byte2
        if (enc4 !== 64) {
          byteArray[byteIndex++] = byte3
        }
      }
    }

    return byteArray.subarray(0, byteIndex)
  }

  var bytes
  try {
    bytes = base64ToByteArray(signature)
  } catch (err) {
    return e.json(400, { error: 'Assinatura base64 inválida' })
  }

  if (!bytes || bytes.length === 0) {
    return e.json(400, { error: 'Assinatura vazia após decodificação' })
  }

  var file = $filesystem.fileFromBytes(bytes, 'signature.png')
  record.set('customer_signature', file)

  $app.save(record)

  return e.json(200, { success: true })
})
