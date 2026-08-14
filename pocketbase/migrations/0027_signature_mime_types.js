migrate(
  (app) => {
    // ----------------------------------------------------------------
    // Garante que os campos de assinatura (customer_signature e
    // technician_signature) aceitam imagens PNG. Antes desta migração os
    // campos não tinham mimeTypes definidos, o que fazia o hook
    // shared_order_sign rejeitar blobs PNG vindos do SignaturePad com erro
    // "falha ao salvar". Recria os campos de arquivo de assinatura com os
    // mimeTypes corretos.
    // ----------------------------------------------------------------
    var col = app.findCollectionByNameOrId('service_orders')

    var fieldNames = ['customer_signature', 'technician_signature']
    for (var i = 0; i < fieldNames.length; i++) {
      var name = fieldNames[i]
      var existing = col.fields.getByName(name)
      if (existing) {
        col.fields.removeById(existing.id)
      }
      col.fields.add(
        new FileField({
          name: name,
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
        }),
      )
    }

    app.save(col)
    console.log('Signature fields updated to accept image/png')
  },
  (app) => {},
)
