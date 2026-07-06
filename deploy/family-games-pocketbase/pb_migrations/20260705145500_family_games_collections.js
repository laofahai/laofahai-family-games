migrate((app) => {
  const locked = {
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  }

  const publicEphemeral = {
    listRule: 'expires_at > @now',
    viewRule: 'expires_at > @now',
    createRule: 'expires_at > @now',
    updateRule: '',
    deleteRule: '',
  }

  const collections = [
    new Collection({
      type: 'base',
      name: 'access_codes',
      ...locked,
      fields: [
        { name: 'code', type: 'text', required: true, max: 40 },
        { name: 'is_admin', type: 'bool' },
        { name: 'label', type: 'text', max: 80 },
        { name: 'revoked', type: 'bool' },
        { name: 'created_by', type: 'text', max: 40 },
        { name: 'admin_name', type: 'text', max: 80 },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_access_codes_code ON access_codes (code)',
        'CREATE INDEX idx_access_codes_admin ON access_codes (is_admin, revoked)',
      ],
    }),
    new Collection({
      type: 'base',
      name: 'profiles',
      ...locked,
      fields: [
        { name: 'legacy_id', type: 'text', max: 80 },
        { name: 'name', type: 'text', required: true, max: 80 },
        { name: 'emoji', type: 'text', max: 20 },
        { name: 'kind', type: 'text', required: true, max: 40 },
        { name: 'sync_code', type: 'text', max: 40 },
        { name: 'role', type: 'text', max: 40 },
        { name: 'gender', type: 'text', max: 20 },
        { name: 'class_id', type: 'text', max: 80 },
        { name: 'meta', type: 'json' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_profiles_sync_code ON profiles (sync_code) WHERE sync_code != ""',
        'CREATE UNIQUE INDEX idx_profiles_legacy_id ON profiles (legacy_id) WHERE legacy_id != ""',
        'CREATE INDEX idx_profiles_roster ON profiles (role, class_id)',
      ],
    }),
    new Collection({
      type: 'base',
      name: 'seen',
      ...locked,
      fields: [
        { name: 'profile_id', type: 'text', required: true, max: 40 },
        { name: 'scope', type: 'text', required: true, max: 120 },
        { name: 'item_ids', type: 'json', required: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_seen_profile_scope ON seen (profile_id, scope)'],
    }),
    new Collection({
      type: 'base',
      name: 'learn',
      ...locked,
      fields: [
        { name: 'code', type: 'text', required: true, max: 40 },
        { name: 'game', type: 'text', required: true, max: 120 },
        { name: 'data', type: 'json', required: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_learn_code_game ON learn (code, game)',
        'CREATE INDEX idx_learn_code ON learn (code)',
      ],
    }),
    new Collection({
      type: 'base',
      name: 'rooms',
      ...locked,
      fields: [
        { name: 'code', type: 'text', required: true, max: 20 },
        { name: 'game', type: 'text', required: true, max: 80 },
        { name: 'host_token', type: 'text', required: true, max: 120 },
        { name: 'state', type: 'text', required: true, max: 40 },
        { name: 'payload', type: 'json' },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_rooms_code ON rooms (code)'],
    }),
    new Collection({
      type: 'base',
      name: 'room_members',
      ...locked,
      fields: [
        { name: 'code', type: 'text', required: true, max: 20 },
        { name: 'token', type: 'text', required: true, max: 120 },
        { name: 'name', type: 'text', required: true, max: 80 },
        { name: 'emoji', type: 'text', max: 20 },
        { name: 'seat', type: 'number', required: true },
        { name: 'is_host', type: 'bool' },
        { name: 'secret', type: 'json' },
        { name: 'submission', type: 'json' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_room_members_code_token ON room_members (code, token)',
        'CREATE UNIQUE INDEX idx_room_members_code_seat ON room_members (code, seat)',
      ],
    }),
    new Collection({
      type: 'base',
      name: 'game_content',
      ...locked,
      fields: [
        { name: 'game', type: 'text', required: true, max: 120 },
        { name: 'data', type: 'json', required: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_game_content_game ON game_content (game)'],
    }),
    new Collection({
      type: 'base',
      name: 'rt_events',
      ...publicEphemeral,
      fields: [
        { name: 'kind', type: 'text', required: true, max: 40 },
        { name: 'room', type: 'text', required: true, max: 120 },
        { name: 'event', type: 'text', required: true, max: 40 },
        { name: 'sender', type: 'text', required: true, max: 120 },
        { name: 'payload', type: 'json', required: true },
        { name: 'expires_at', type: 'date', required: true },
      ],
      indexes: ['CREATE INDEX idx_rt_events_topic ON rt_events (kind, room, event, expires_at)'],
    }),
    new Collection({
      type: 'base',
      name: 'rt_presence',
      ...publicEphemeral,
      fields: [
        { name: 'kind', type: 'text', required: true, max: 40 },
        { name: 'room', type: 'text', required: true, max: 120 },
        { name: 'peer_id', type: 'text', required: true, max: 120 },
        { name: 'meta', type: 'json', required: true },
        { name: 'expires_at', type: 'date', required: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_rt_presence_peer ON rt_presence (kind, room, peer_id)',
        'CREATE INDEX idx_rt_presence_topic ON rt_presence (kind, room, expires_at)',
      ],
    }),
  ]

  for (const collection of collections) app.save(collection)
}, (app) => {
  for (const name of [
    'rt_presence',
    'rt_events',
    'game_content',
    'room_members',
    'rooms',
    'learn',
    'seen',
    'profiles',
    'access_codes',
  ]) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch {
      // collection already gone
    }
  }
})
