// 知识对战 · 在线对战频道：用 PocketBase realtime 承载消息和 presence。
// 除了广播出招事件，还用 rt_presence
// 追踪「对手是否在场」（join/leave/掉线），从而显示连接状态、优雅处理断线。
//
// 设计取舍（见 protocol.ts 顶注）：双方各答自己的题，把每次作答结果广播出去；
// 谁先把对方血打空谁赢。host 只负责约定 maxHp/band/topic（开局握手），不做逐题权威。

import { joinRecordChannel, pocketBaseAvailable, pocketBaseClient } from '@/platform/pocketbase'
import type { DuelMsg } from './protocol'

export interface DuelChannel {
  /** 广播一条对战消息（self:false，不回显自己）。 */
  send: (msg: DuelMsg) => void
  /** 退出频道（卸载/离开房间时调）。 */
  leave: () => void
  /** 后端是否可用（未配置 Supabase 时为 false）。 */
  enabled: boolean
}

export interface DuelPresenceMeta {
  /** 稳定的端 id（每个客户端一份，区分自己与对手）。 */
  uid: string
  name: string
  emoji: string
  role: 'host' | 'guest'
}

export interface JoinOpts {
  code: string
  me: DuelPresenceMeta
  /** 收到对手广播的对战消息。 */
  onMessage: (msg: DuelMsg) => void
  /** 在场名单变化（含自己）。用于判断对手是否进/退场。 */
  onPresence: (peers: DuelPresenceMeta[]) => void
}

/** 加入对战频道。返回发送器；自动用 presence 跟踪在场，未配置后端时安全降级为空操作。 */
export function joinDuelChannel(opts: JoinOpts): DuelChannel {
  if (!pocketBaseAvailable()) return { send: () => {}, leave: () => {}, enabled: false }

  const messages = joinRecordChannel({
    kind: 'duel',
    room: opts.code,
    event: 'm',
    sender: opts.me.uid,
    ttlSeconds: 300,
    onMessage: (payload) => opts.onMessage(payload as DuelMsg),
  })

  const pb = pocketBaseClient()
  const presence = pb?.collection?.('rt_presence') as
    | {
        getFullList: (opts?: { filter?: string }) => Promise<Array<Record<string, unknown>>>
        create: (body: Record<string, unknown>) => Promise<Record<string, unknown>>
        update: (id: string, body: Record<string, unknown>) => Promise<Record<string, unknown>>
        delete: (id: string) => Promise<unknown>
        subscribe: (
          topic: string,
          cb: () => void,
          opts?: { filter?: string }
        ) => Promise<() => void> | (() => void)
      }
    | undefined

  let presenceId = ''
  let unsubPresence: (() => void) | undefined

  const filter = `kind="duel" && room="${opts.code.replace(/"/g, '\\"')}"`
  const activeFilter = `${filter} && expires_at>"${new Date().toISOString()}"`

  const refreshPresence = async () => {
    if (!presence) return
    const records = await presence.getFullList({ filter: activeFilter })
    opts.onPresence(
      records.map((record) => {
        const meta = (record.meta && typeof record.meta === 'object' ? record.meta : {}) as Partial<DuelPresenceMeta>
        return {
          uid: typeof record.peer_id === 'string' ? record.peer_id : meta.uid ?? 'peer',
          name: meta.name ?? '玩家',
          emoji: meta.emoji ?? '🙂',
          role: meta.role === 'host' ? 'host' : 'guest',
        }
      })
    )
  }

  const heartbeat = async () => {
    if (!presence) return
    const body = {
      kind: 'duel',
      room: opts.code,
      peer_id: opts.me.uid,
      meta: opts.me,
      expires_at: new Date(Date.now() + 15_000).toISOString(),
    }
    if (presenceId) await presence.update(presenceId, body)
    else {
      const record = await presence.create(body)
      presenceId = String(record.id ?? '')
    }
    await refreshPresence()
  }

  void heartbeat()
  const timer = setInterval(() => void heartbeat(), 5_000)
  if (presence) {
    void Promise.resolve(presence.subscribe('*', () => void refreshPresence(), { filter })).then((fn) => {
      unsubPresence = fn
    })
  }

  return {
    enabled: true,
    send: messages.send,
    leave: () => {
      clearInterval(timer)
      messages.leave()
      unsubPresence?.()
      if (presence && presenceId) void presence.delete(presenceId)
    },
  }
}
