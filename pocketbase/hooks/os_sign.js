routerAdd('POST', '/backend/v1/os/{id}/sign', (e) => {
  // ----------------------------------------------------------------
  // Rota PÚBLICA de assinatura do cliente (via link do WhatsApp).
  //
  // O frontend envia a assinatura como JSON:
  //   { "signature": "data:image/png;base64,iVBORw0KGgo..." }
  //
  // Não usamos mais multipart/form-data porque alguns navegadores móveis
  // (Samsung Internet, Chrome antigo, Safari iOS) perdiam o tipo MIME
  // image/png entre canvas.toBlob -> new File -> FormData, e o arquivo
  // chegava aqui com MIME vazio (""), sendo rejeitado pelo PocketBase com
  // "unsupported file type". Base64 é uma string pura e funciona em todos
  // os navegadores; o MIME é definido aqui no servidor, onde temos controle
  // total.
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
  // Baseada na implementação de referência publicada na discussão do
  // PocketBase (pocketbase/pocketbase#4007).
  const base64ToByteArray = function (base64String) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

    // remove espaços e quebras de linha
    base64String = base64String.replace(/\s/g, '')
    // remove o padding "="
    base64String = base64String.replace(/=/g, '')

    // Ajusta o tamanho para ser múltiplo de 4 adicionando "A"
    // (caractere neutro do Base64).
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

  // Cria o arquivo a partir dos bytes, com MIME definido no servidor.
  var file = $filesystem.fileFromBytes(bytes, 'signature.png')
  record.set('customer_signature', file)

  var now = new Date()
  var year = now.getFullYear()
  var month = now.getMonth() + 1
  var day = now.getDate()
  var dateStr =
    year + '-' + (month < 10 ? '0' + month : '' + month) + '-' + (day < 10 ? '0' + day : '' + day)
  var hours = now.getHours()
  var minutes = now.getMinutes()
  var timeStr =
    (hours < 10 ? '0' + hours : '' + hours) + ':' + (minutes < 10 ? '0' + minutes : '' + minutes)
  record.set('attendance_date', dateStr)
  record.set('attendance_time', timeStr)

  $app.save(record)

  // Notifica o técnico via push: "Cliente assinou a OS #XXXX".
  // Esta rota (/backend/v1/os/{id}/sign) também é pública (link do WhatsApp).
  try {
    var techId = record.getString('technician')
    var osNumber = record.getString('number')
    if (techId && osNumber && typeof $sendPushToUser === 'function') {
      $sendPushToUser($app, techId, {
        title: '✍️ Cliente assinou a OS #' + osNumber,
        body: 'A assinatura do cliente foi registrada.',
        icon: '/icon-maskable.svg',
        url: '/ordens/' + record.id,
        tag: 'os-' + record.id,
      })
    }
  } catch (pushErr) {
    $app.logger().error('Push on os sign failed (non-blocking)', 'error', String(pushErr))
  }

  return e.json(200, { success: true })
})
