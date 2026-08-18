// Adiciona um campo de arquivo `photo_file` à coleção `products` para
// armazenar fotos capturadas por câmera/galeria. O campo `photo` existente
// (tipo url) continua sendo usado para URLs externas (ex: Pexels).
migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('products')
    if (!col.fields.getByName('photo_file')) {
      col.fields.add(
        new FileField({
          name: 'photo_file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    var col = app.findCollectionByNameOrId('products')
    var f = col.fields.getByName('photo_file')
    if (f) col.fields.remove(f)
    app.save(col)
  },
)
