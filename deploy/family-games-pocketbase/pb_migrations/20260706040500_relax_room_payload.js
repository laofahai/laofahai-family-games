migrate((app) => {
  const collection = app.findCollectionByNameOrId('rooms')
  const payload = collection.fields.getByName('payload')
  payload.required = false
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('rooms')
  const payload = collection.fields.getByName('payload')
  payload.required = true
  return app.save(collection)
})
