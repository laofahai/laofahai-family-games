function body(e) {
  return e.requestInfo().body || {}
}

function ok(e, data) {
  return e.json(200, data)
}

function first(collection, filter, params) {
  try {
    return $app.findFirstRecordByFilter(collection, filter, params || {})
  } catch {
    return null
  }
}

function byData(collection, field, value) {
  try {
    return $app.findFirstRecordByData(collection, field, value)
  } catch {
    return null
  }
}

function all(collection, sort) {
  const found = $app.findAllRecords(collection)
  const records = []
  for (const record of found) {
    if (record) records.push(record)
  }
  sortRecords(records, sort)
  return records
}

function sortRecords(records, sort) {
  if (!sort) return
  const parts = String(sort)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('-')) return { field: part.slice(1), dir: -1 }
      const pieces = part.split(/\s+/)
      return { field: pieces[0], dir: String(pieces[1] || 'ASC').toUpperCase() === 'DESC' ? -1 : 1 }
    })
  records.sort((a, b) => {
    for (const part of parts) {
      const av = recordValue(a, part.field)
      const bv = recordValue(b, part.field)
      if (av < bv) return -1 * part.dir
      if (av > bv) return 1 * part.dir
    }
    return 0
  })
}

function recordValue(record, field) {
  if (field === 'id') return record.id
  const value = record.get(field)
  if (typeof value === 'number') return value
  return String(value || '')
}

function saveRecord(collectionName, values) {
  const collection = $app.findCollectionByNameOrId(collectionName)
  const record = new Record(collection)
  for (const key in values) record.set(key, values[key])
  $app.save(record)
  return record
}

function upsertBy(collectionName, field, value, values) {
  const record = byData(collectionName, field, value)
  if (record) {
    for (const key in values) record.set(key, values[key])
    $app.save(record)
    return record
  }
  return saveRecord(collectionName, values)
}

function isAdminCode(code) {
  const rec = byData('access_codes', 'code', String(code || ''))
  return !!(rec && rec.getBool('is_admin') && !rec.getBool('revoked'))
}

function requireAdmin(code) {
  return isAdminCode(code)
}

function profileByCode(code) {
  return byData('profiles', 'sync_code', String(code || ''))
}

function codeRow(record) {
  return {
    code: record.getString('code'),
    is_admin: record.getBool('is_admin'),
    label: record.getString('label') || null,
    revoked: record.getBool('revoked'),
    created_at: String(record.get('created')),
  }
}

function profileRow(record) {
  return {
    id: record.id,
    name: record.getString('name'),
    emoji: record.getString('emoji') || null,
    kind: record.getString('kind') || 'guest',
    sync_code: record.getString('sync_code') || null,
    created_at: String(record.get('created')),
  }
}

function memberRow(record) {
  return {
    name: record.getString('name'),
    emoji: record.getString('emoji') || '🙂',
    seat: record.getInt('seat'),
    is_host: record.getBool('is_host'),
  }
}

function roomPayload(value) {
  return isBlankJson(value) || isEmptyRoomPayload(value) ? {} : value
}

function publicRoomPayload(record) {
  const value = record.get('payload') || {}
  if (isEmptyRoomPayload(value)) return {}
  return value
}

function isBlankJson(value) {
  if (value == null) return true
  if (String(value) === '<nil>') return true
  const text = JSON.stringify(value)
  return text === undefined || text === 'null' || text === '{}'
}

function isEmptyRoomPayload(value) {
  return JSON.stringify(value) === '{"__empty":true}'
}

function getMembers(code) {
  return all('room_members', 'seat ASC').filter((row) => row.getString('code') === String(code))
}

function deleteWhere(collection, predicate) {
  const records = all(collection).filter(predicate)
  for (const record of records) $app.delete(record)
}

function seedDefaults() {
  upsertBy('access_codes', 'code', '996614', {
    code: '996614',
    is_admin: true,
    label: '爸爸',
    revoked: false,
    created_by: '',
  })
  if (!profileByCode('996614')) {
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
}

function seedContent() {
  try {
    const raw = toString($os.readFile('/pb/pb_seed/game_content.json'))
    const rows = JSON.parse(raw)
    for (const row of rows) {
      if (!row || !row.game || !Array.isArray(row.data)) continue
      if (byData('game_content', 'game', row.game)) continue
      saveRecord('game_content', { game: row.game, data: row.data })
    }
  } catch (err) {
    console.log(`content seed skipped: ${err}`)
  }
}

function cleanupRealtime() {
  const cutoff = new Date().toISOString()
  deleteWhere('rt_events', (row) => String(row.get('expires_at') || '') < cutoff)
  deleteWhere('rt_presence', (row) => String(row.get('expires_at') || '') < cutoff)
}

function cleanupRooms() {
  // Existing PocketBase room rows don't have a reliable updated timestamp yet.
  // Collision handling in createRoom already retries another short code.
}

function redeemCode(e) {
  const data = body(e)
  const rec = byData('access_codes', 'code', String(data.code || ''))
  if (!rec || rec.getBool('revoked')) return ok(e, { valid: false, is_admin: false })
  return ok(e, { valid: true, is_admin: rec.getBool('is_admin') })
}

function redeemLogin(e) {
  const data = body(e)
  const code = String(data.code || '')
  const profile = profileByCode(code)
  if (profile) {
    return ok(e, {
      valid: true,
      is_admin: isAdminCode(code),
      is_person: true,
      name: profile.getString('name'),
      emoji: profile.getString('emoji') || null,
    })
  }
  const rec = byData('access_codes', 'code', code)
  if (!rec || rec.getBool('revoked')) {
    return ok(e, { valid: false, is_admin: false, is_person: false, name: null, emoji: null })
  }
  return ok(e, { valid: true, is_admin: rec.getBool('is_admin'), is_person: false, name: null, emoji: null })
}

function adminLogin(e) {
  const data = body(e)
  const code = String(data.code || '')
  const name = String(data.name || '')
  const rec = byData('access_codes', 'code', code)
  if (!rec || rec.getBool('revoked') || !rec.getBool('is_admin') || !name) return ok(e, { ok: false })
  const existing = rec.getString('admin_name')
  if (!existing) {
    rec.set('admin_name', name)
    $app.save(rec)
    return ok(e, { ok: true })
  }
  return ok(e, { ok: existing === name })
}

function mintCode(e) {
  const data = body(e)
  if (!requireAdmin(data.adminCode)) return ok(e, { ok: false })
  const code = String(data.newCode || '')
  if (!code || byData('access_codes', 'code', code)) return ok(e, { ok: false })
  saveRecord('access_codes', {
    code,
    is_admin: data.isAdmin === true,
    label: String(data.label || '邀请码'),
    revoked: false,
    created_by: String(data.adminCode || ''),
  })
  return ok(e, { ok: true })
}

function listCodes(e) {
  const data = body(e)
  if (!requireAdmin(data.adminCode)) return ok(e, { codes: [] })
  const codes = all('access_codes', 'created DESC').map(codeRow)
  return ok(e, { codes })
}

function setCodeRevoked(e) {
  const data = body(e)
  if (!requireAdmin(data.adminCode)) return ok(e, { ok: false })
  const rec = byData('access_codes', 'code', String(data.code || ''))
  if (!rec) return ok(e, { ok: false })
  rec.set('revoked', data.revoked === true)
  $app.save(rec)
  return ok(e, { ok: true })
}

function adminListProfiles(e) {
  const data = body(e)
  if (!requireAdmin(data.adminCode)) return ok(e, { profiles: [] })
  const profiles = all('profiles', 'created ASC')
    .filter((row) => row.getString('sync_code') !== '')
    .map(profileRow)
  return ok(e, { profiles })
}

function adminResetProfileCode(e) {
  const data = body(e)
  if (!requireAdmin(data.adminCode)) return ok(e, { ok: false })
  const profile = first('profiles', 'id = {:id}', { id: String(data.id || '') })
  if (!profile) return ok(e, { ok: false })
  const newCode = String(data.newCode || '')
  const oldCode = profile.getString('sync_code')
  const taken = profileByCode(newCode)
  if (!newCode || (taken && taken.id !== profile.id)) return ok(e, { ok: false })
  profile.set('sync_code', newCode)
  $app.save(profile)
  const learn = all('learn').filter((row) => row.getString('code') === oldCode)
  for (const row of learn) {
    if (!first('learn', 'code = {:code} && game = {:game}', { code: newCode, game: row.getString('game') })) {
      row.set('code', newCode)
      $app.save(row)
    }
  }
  return ok(e, { ok: true })
}

function adminDeleteProfile(e) {
  const data = body(e)
  if (!requireAdmin(data.adminCode)) return ok(e, { ok: false })
  const profile = first('profiles', 'id = {:id}', { id: String(data.id || '') })
  if (!profile) return ok(e, { ok: false })
  const oldCode = profile.getString('sync_code')
  deleteWhere('seen', (row) => row.getString('profile_id') === profile.id)
  if (oldCode) deleteWhere('learn', (row) => row.getString('code') === oldCode)
  $app.delete(profile)
  return ok(e, { ok: true })
}

function claimProfile(e) {
  const data = body(e)
  const code = String(data.code || '')
  if (!code) return ok(e, { id: null })
  let profile = profileByCode(code)
  if (profile) {
    profile.set('name', String(data.name || profile.getString('name') || '玩家'))
    profile.set('emoji', String(data.emoji || profile.getString('emoji') || '🙂'))
    $app.save(profile)
    return ok(e, { id: profile.id })
  }
  profile = saveRecord('profiles', {
    legacy_id: '',
    name: String(data.name || '玩家'),
    emoji: String(data.emoji || '🙂'),
    kind: String(data.kind || 'guest'),
    sync_code: code,
    role: 'family',
    gender: '',
    class_id: 'family',
    meta: {},
  })
  return ok(e, { id: profile.id })
}

function pullSeen(e) {
  const data = body(e)
  const profile = profileByCode(data.code)
  if (!profile) return ok(e, { seen: [] })
  const seen = all('seen', 'scope ASC')
    .filter((row) => row.getString('profile_id') === profile.id)
    .map((row) => ({
      scope: row.getString('scope'),
      item_ids: row.get('item_ids') || [],
    }))
  return ok(e, { seen })
}

function pushSeen(e) {
  const data = body(e)
  const profile = profileByCode(data.code)
  if (!profile) return ok(e, { ok: false })
  const scope = String(data.scope || '')
  let row = first('seen', 'profile_id = {:profile_id} && scope = {:scope}', { profile_id: profile.id, scope })
  if (!row) row = saveRecord('seen', { profile_id: profile.id, scope, item_ids: data.itemIds || [] })
  else {
    row.set('item_ids', data.itemIds || [])
    $app.save(row)
  }
  return ok(e, { ok: true })
}

function pullLearn(e) {
  const data = body(e)
  const learn = all('learn', 'game ASC')
    .filter((row) => row.getString('code') === String(data.code || ''))
    .map((row) => ({
      game: row.getString('game'),
      data: row.get('data'),
    }))
  return ok(e, { learn })
}

function pushLearn(e) {
  const data = body(e)
  const code = String(data.code || '')
  const game = String(data.game || '')
  if (!code || !game) return ok(e, { ok: false })
  let row = first('learn', 'code = {:code} && game = {:game}', { code, game })
  if (!row) row = saveRecord('learn', { code, game, data: data.data || {} })
  else {
    row.set('data', data.data || {})
    $app.save(row)
  }
  return ok(e, { ok: true })
}

function getContent(e) {
  const data = body(e)
  const games = Array.isArray(data.games) ? data.games.map(String).filter(Boolean) : []
  let rows
  if (games.length) {
    rows = []
    for (const game of games) {
      const row = byData('game_content', 'game', game)
      if (row) rows.push(row)
    }
  } else {
    rows = all('game_content', 'game ASC')
  }
  return ok(e, { content: rows.map((row) => ({ game: row.getString('game'), data: row.get('data') || [] })) })
}

function getRoster(e) {
  try {
    const records = all('profiles', 'class_id ASC, name ASC')
    const rows = []
    for (const row of records) {
      if (row.getString('role') === '') continue
      rows.push({
        id: row.getString('legacy_id') || row.id,
        name: row.getString('name'),
        emoji: row.getString('emoji') || '🙂',
        role: row.getString('role') || 'family',
        gender: row.getString('gender') || '',
        class_id: row.getString('class_id') || 'family',
        meta: row.get('meta') || {},
      })
    }
    return ok(e, { roster: rows })
  } catch (err) {
    console.log(`get-roster failed: ${err}`)
    return ok(e, { roster: [] })
  }
}

function createRoom(e) {
  try {
    cleanupRooms()
    const data = body(e)
    const code = String(data.code || '')
    if (!code || byData('rooms', 'code', code)) return ok(e, { ok: false })
    saveRecord('rooms', {
      code,
      game: String(data.game || ''),
      host_token: String(data.hostToken || ''),
      state: 'lobby',
      payload: roomPayload({}),
    })
    saveRecord('room_members', {
      code,
      token: String(data.hostToken || ''),
      name: String(data.name || '房主'),
      emoji: String(data.emoji || '🙂'),
      seat: 1,
      is_host: true,
    })
    return ok(e, { ok: true })
  } catch (err) {
    console.log(`create-room failed: ${err}`)
    return ok(e, { ok: false })
  }
}

function joinRoom(e) {
  const data = body(e)
  const code = String(data.code || '')
  const token = String(data.token || '')
  const room = byData('rooms', 'code', code)
  if (!room) return ok(e, { seat: -1 })
  let member = first('room_members', 'code = {:code} && token = {:token}', { code, token })
  if (room.getString('state') !== 'lobby' && !member) return ok(e, { seat: -2 })
  if (member) {
    member.set('name', String(data.name || member.getString('name') || '玩家'))
    member.set('emoji', String(data.emoji || member.getString('emoji') || '🙂'))
    $app.save(member)
    return ok(e, { seat: member.getInt('seat') })
  }
  const members = getMembers(code)
  let seat = 1
  for (const row of members) seat = Math.max(seat, row.getInt('seat') + 1)
  member = saveRecord('room_members', {
    code,
    token,
    name: String(data.name || '玩家'),
    emoji: String(data.emoji || '🙂'),
    seat,
    is_host: false,
  })
  room.set('payload', roomPayload(publicRoomPayload(room)))
  $app.save(room)
  return ok(e, { seat: member.getInt('seat') })
}

function hostSet(e) {
  const data = body(e)
  const code = String(data.code || '')
  const room = byData('rooms', 'code', code)
  if (!room || room.getString('host_token') !== String(data.hostToken || '')) return ok(e, { ok: false })
  if (data.state !== null && data.state !== undefined) room.set('state', String(data.state))
  if (data.payload !== null && data.payload !== undefined) room.set('payload', roomPayload(data.payload))
  $app.save(room)
  const secrets = data.secrets && typeof data.secrets === 'object' ? data.secrets : null
  if (secrets) {
    for (const seat in secrets) {
      const member = first('room_members', 'code = {:code} && seat = {:seat}', { code, seat: Number(seat) })
      if (member) {
        member.set('secret', secrets[seat])
        $app.save(member)
      }
    }
  }
  return ok(e, { ok: true })
}

function roomSnapshot(e) {
  const data = body(e)
  const code = String(data.code || '')
  const token = String(data.token || '')
  const room = byData('rooms', 'code', code)
  if (!room) return ok(e, null)
  const members = getMembers(code)
  const me = first('room_members', 'code = {:code} && token = {:token}', { code, token })
  const submittedCount = members.filter((row) => !isBlankJson(row.get('submission'))).length
  return ok(e, {
    state: room.getString('state'),
    game: room.getString('game'),
    payload: publicRoomPayload(room),
    you: me
      ? {
          name: me.getString('name'),
          emoji: me.getString('emoji') || '🙂',
          seat: me.getInt('seat'),
          is_host: me.getBool('is_host'),
          secret: me.get('secret'),
          submission: me.get('submission'),
        }
      : null,
    members: members.map(memberRow),
    submittedCount,
    updated_at: String(room.get('updated')),
  })
}

function leaveRoom(e) {
  const data = body(e)
  const code = String(data.code || '')
  const token = String(data.token || '')
  const room = byData('rooms', 'code', code)
  const member = first('room_members', 'code = {:code} && token = {:token}', { code, token })
  if (member) $app.delete(member)
  if (room && room.getString('host_token') === token) {
    deleteWhere('room_members', (row) => row.getString('code') === code)
    $app.delete(room)
  }
  return ok(e, { ok: true })
}

function memberSubmit(e) {
  const data = body(e)
  const code = String(data.code || '')
  const member = first('room_members', 'code = {:code} && token = {:token}', { code, token: String(data.token || '') })
  const room = byData('rooms', 'code', code)
  if (!member || !room) return ok(e, { ok: false })
  member.set('submission', data.data)
  $app.save(member)
  room.set('payload', roomPayload(publicRoomPayload(room)))
  $app.save(room)
  return ok(e, { ok: true })
}

function collectSubmissions(e) {
  const data = body(e)
  const code = String(data.code || '')
  const room = byData('rooms', 'code', code)
  if (!room || room.getString('host_token') !== String(data.hostToken || '')) return ok(e, { submissions: [] })
  const submissions = getMembers(code).map((row) => ({
    seat: row.getInt('seat'),
    name: row.getString('name'),
    emoji: row.getString('emoji') || '🙂',
    submission: row.get('submission'),
  }))
  return ok(e, { submissions })
}

function clearSubmissions(e) {
  const data = body(e)
  const code = String(data.code || '')
  const room = byData('rooms', 'code', code)
  if (!room || room.getString('host_token') !== String(data.hostToken || '')) return ok(e, { ok: false })
  for (const member of getMembers(code)) {
    member.set('submission', null)
    $app.save(member)
  }
  room.set('payload', roomPayload(publicRoomPayload(room)))
  $app.save(room)
  return ok(e, { ok: true })
}

module.exports = {
  ok,
  seedDefaults,
  seedContent,
  cleanupRealtime,
  cleanupRooms,
  redeemCode,
  redeemLogin,
  adminLogin,
  mintCode,
  listCodes,
  setCodeRevoked,
  adminListProfiles,
  adminResetProfileCode,
  adminDeleteProfile,
  claimProfile,
  pullSeen,
  pushSeen,
  pullLearn,
  pushLearn,
  getContent,
  getRoster,
  createRoom,
  joinRoom,
  hostSet,
  roomSnapshot,
  leaveRoom,
  memberSubmit,
  collectSubmissions,
  clearSubmissions
}
