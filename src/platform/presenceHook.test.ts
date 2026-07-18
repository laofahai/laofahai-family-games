import { readFileSync } from 'node:fs'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

// fg.js 是 PocketBase (Goja) 服务端 hook，用 CommonJS + 运行时全局。
// 这里读源码后在受控上下文里执行，取出导出的处理函数做回归测试。
interface FgEvent {
  requestInfo: () => { body: Record<string, unknown> }
  json: (code: number, data: unknown) => { code: number; data: unknown }
}
interface FgModule {
  presencePing: (e: FgEvent) => { data: { ok: boolean } }
  presenceList: (e: FgEvent) => { data: { users: Array<{ peer_id: string; name: string }> } }
}

function loadFg(): FgModule {
  const file = path.resolve(__dirname, '../../deploy/family-games-pocketbase/pb_hooks/fg.js')
  const src = readFileSync(file, 'utf8')
  const $app = { findAllRecords: () => [], delete: () => {} }
  const $security = { sha256: (v: string) => `${v}00000000000000000000000000000000` }
  const $os = { readFile: () => '' }
  const module = { exports: {} as FgModule }
  const fn = new Function('module', 'exports', 'require', '$app', '$security', '$os', 'console', src)
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
