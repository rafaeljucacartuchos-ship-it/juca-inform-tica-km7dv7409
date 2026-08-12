migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('service_orders')
    if (!col.fields.getByName('attendance_date')) {
      col.fields.add(new DateField({ name: 'attendance_date' }))
    }
    if (!col.fields.getByName('attendance_time')) {
      col.fields.add(new TextField({ name: 'attendance_time' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('service_orders')
    const f1 = col.fields.getByName('attendance_date')
    if (f1) col.fields.remove(f1)
    const f2 = col.fields.getByName('attendance_time')
    if (f2) col.fields.remove(f2)
    app.save(col)
  },
)
