import { beforeEach, describe, expect, it } from 'vitest'

import fgSource from '../../deploy/family-games-pocketbase/pb_hooks/fg.js?raw'

// fg.js 是 PocketBase (Goja) 服务端 hook，用 CommonJS + 运行时全局。
// 这里在受控上下文里执行源码，取出导出的处理函数做回归测试。
interface FgEvent {
  requestInfo: () => { body: Record<string, unknown> }
  json: (code: number, data: unknown) => { code: number; data: unknown }
}
interface FgModule {
  presencePing: (e: FgEvent) => { data: { ok: boolean } }
  presenceList: (e: FgEvent) => { data: { users: Array<{ peer_id: string; name: string }> } }
  decodeJsonBytes: (value: unknown) => string | null
  jsonValue: (value: unknown) => Record<string, unknown>
}

function loadFg(): FgModule {
  const $app = { findAllRecords: () => [], delete: () => {} }
  const $security = { sha256: (v: string) => `${v}00000000000000000000000000000000` }
  const $os = { readFile: () => '' }
  const module = { exports: {} as FgModule }
  const fn = new Function('module', 'exports', 'require', '$app', '$security', '$os', 'console', fgSource)
  fn(module, module.exports, () => ({}), $app, $security, $os, console)
  return module.exports
}

function event(body: Record<string, unknown>): FgEvent {
  return {
    requestInfo: () => ({ body }),
    json: (code, data) => ({ code, data }),
  }
}

describe('presence hook', () => {
  let fg: FgModule
  beforeEach(() => {
    fg = loadFg()
  })

  it('lists a user after a ping (regression: presence-list 400)', () => {
    const ping = fg.presencePing(event({ token: 't1', name: '爸爸', emoji: '🙂', playerId: 'p1', ttlSeconds: 45 }))
    expect(ping.data.ok).toBe(true)

    const list = fg.presenceList(event({}))
    expect(list.data.users.map((u) => u.name)).toEqual(['爸爸'])
  })

  it('returns empty list when nobody has pinged', () => {
    const list = fg.presenceList(event({}))
    expect(list.data.users).toEqual([])
  })
})

describe('decodeJsonBytes UTF-8', () => {
  let fg: FgModule
  beforeEach(() => {
    fg = loadFg()
  })

  it('decodes multibyte Chinese and emoji from JSON bytes (regression: 姓名乱码)', () => {
    const json = JSON.stringify({ guesserName: '爸爸', emoji: '🎉' })
    const bytes = Array.from(new TextEncoder().encode(json))

    expect(fg.decodeJsonBytes(bytes)).toBe(json)

    const parsed = fg.jsonValue(bytes)
    expect(parsed.guesserName).toBe('爸爸')
    expect(parsed.emoji).toBe('🎉')
  })

  it('returns null for non-byte-array input', () => {
    expect(fg.decodeJsonBytes('not-bytes')).toBe(null)
    expect(fg.decodeJsonBytes([1, 2, 999])).toBe(null)
  })
})
