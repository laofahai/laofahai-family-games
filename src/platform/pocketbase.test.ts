import { afterEach, describe, expect, it } from 'vitest'

import { clearPocketBaseClientForTests, fgPost, makeRecordChannel, setPocketBaseClientForTests } from './pocketbase'

describe('PocketBase transport', () => {
  afterEach(() => clearPocketBaseClientForTests())

  it('posts family-game API calls as JSON', async () => {
    const calls: unknown[] = []
    setPocketBaseClientForTests({
      send: async <T>(path: string, opts?: Record<string, unknown>) => {
        calls.push({ path, opts })
        return { ok: true } as T
      },
    })

    await fgPost('/redeem-login', { code: '996614' })

    expect(calls).toEqual([
      {
        path: '/api/fg/redeem-login',
        opts: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: '996614' }),
        },
      },
    ])
  })

  it('filters PocketBase realtime records by topic and sender', () => {
    const received: unknown[] = []
    const channel = makeRecordChannel({
      kind: 'draw',
      room: '1234',
      event: 'd',
      sender: 'me',
      ttlSeconds: 60,
      onMessage: (msg) => received.push(msg),
    })

    channel.handleRecord({
      kind: 'draw',
      room: '1234',
      event: 'd',
      sender: 'other',
      payload: { line: 1 },
    })
    channel.handleRecord({
      kind: 'draw',
      room: '1234',
      event: 'd',
      sender: 'me',
      payload: { line: 2 },
    })
    channel.handleRecord({
      kind: 'webrtc',
      room: '1234',
      event: 'signal',
      sender: 'other',
      payload: { line: 3 },
    })

    expect(received).toEqual([{ line: 1 }])
  })
})
