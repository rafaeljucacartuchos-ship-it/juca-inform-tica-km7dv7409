migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('equipment')
    if (!col.fields.getByName('photos')) {
      col.fields.add(
        new FileField({
          name: 'photos',
          maxSelect: 10,
          maxSize: 10485760,
          mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('equipment')
    var f = col.fields.getByName('photos')
    if (f) col.fields.remove(f)
    app.save(col)
  },
)
