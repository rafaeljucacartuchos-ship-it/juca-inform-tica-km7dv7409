migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('service_orders')
    if (!collection.fields.getByName('desconto')) {
      collection.fields.add(
        new NumberField({
          name: 'desconto',
          min: 0,
          required: false,
        }),
      )
    }
    if (!collection.fields.getByName('acrescimo')) {
      collection.fields.add(
        new NumberField({
          name: 'acrescimo',
          min: 0,
          required: false,
        }),
      )
    }
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('service_orders')
    if (collection.fields.getByName('desconto')) {
      collection.fields.removeByName('desconto')
    }
    if (collection.fields.getByName('acrescimo')) {
      collection.fields.removeByName('acrescimo')
    }
    app.save(collection)
  },
)
