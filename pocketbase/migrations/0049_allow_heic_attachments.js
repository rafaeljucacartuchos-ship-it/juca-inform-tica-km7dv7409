migrate(
  (app) => {
    // ----------------------------------------------------------------
    // Atualiza a collection service_attachments para permitir mimes
    // de imagem adicionais caso necessário, garantindo suporte completo.
    // ----------------------------------------------------------------
    var col = app.findCollectionByNameOrId('service_attachments')
    var fileField = col.fields.getByName('file')
    if (fileField) {
      col.fields.removeById(fileField.id)
      col.fields.add(
        new FileField({
          name: 'file',
          required: true,
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: [
            'image/png',
            'image/jpeg',
            'image/webp',
            'image/heic',
            'image/heif',
            'image/heic-sequence',
            'image/heif-sequence',
          ],
        }),
      )
      app.save(col)
      console.log('service_attachments file field updated to accept HEIC/HEIF')
    }
  },
  (app) => {
    var col = app.findCollectionByNameOrId('service_attachments')
    var fileField = col.fields.getByName('file')
    if (fileField) {
      col.fields.removeById(fileField.id)
      col.fields.add(
        new FileField({
          name: 'file',
          required: true,
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
        }),
      )
      app.save(col)
    }
  },
)
