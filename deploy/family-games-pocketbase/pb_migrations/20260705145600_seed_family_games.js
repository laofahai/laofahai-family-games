migrate((app) => {
  function byData(collection, field, value) {
    try {
      return app.findFirstRecordByData(collection, field, value)
    } catch {
      return null
    }
  }

  function saveRecord(collectionName, values) {
    const collection = app.findCollectionByNameOrId(collectionName)
    const record = new Record(collection)
    for (const key in values) record.set(key, values[key])
    app.save(record)
    return record
  }

  if (!byData('access_codes', 'code', '996614')) {
    saveRecord('access_codes', {
      code: '996614',
      is_admin: true,
      label: '爸爸',
      revoked: false,
      created_by: '',
    })
  }

  if (!byData('profiles', 'sync_code', '996614')) {
    saveRecord('profiles', {
      legacy_id: 'dad',
      name: '爸爸',
      emoji: '👨‍💻',
      kind: 'family',
      sync_code: '996614',
      role: 'family',
      gender: 'male',
      class_id: 'family',
      meta: {},
    })
  }

  const raw = toString($os.readFile('/pb/pb_seed/game_content.json'))
  const rows = JSON.parse(raw)
  for (const row of rows) {
    if (!row || !row.game || !Array.isArray(row.data)) continue
    if (byData('game_content', 'game', row.game)) continue
    saveRecord('game_content', { game: row.game, data: row.data })
  }
}, (app) => {
  for (const code of ['996614']) {
    const access = app.findFirstRecordByData('access_codes', 'code', code)
    if (access) app.delete(access)
    const profile = app.findFirstRecordByData('profiles', 'sync_code', code)
    if (profile) app.delete(profile)
  }
})
