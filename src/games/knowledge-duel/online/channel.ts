// 知识对战 · 在线对战频道：镜像 platform/realtime.ts 的 draw:<code> 模式，建一个
// duel:<code> 的 Supabase Realtime 频道。除了广播出招事件，还用 Realtime Presence
// 追踪「对手是否在场」（join/leave/掉线），从而显示连接状态、优雅处理断线。
//
// 设计取舍（见 protocol.ts 顶注）：双方各答自己的题，把每次作答结果广播出去；
// 谁先把对方血打空谁赢。host 只负责约定 maxHp/band/topic（开局握手），不做逐题权威。

import { supabase } from '@/platform/supabase'
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

type PresenceState = Record<string, Array<Partial<DuelPresenceMeta>>>

function flatten(state: PresenceState): DuelPresenceMeta[] {
  const out: DuelPresenceMeta[] = []
  for (const list of Object.values(state)) {
    for (const m of list) {
      if (m && typeof m.uid === 'string') {
        out.push({
          uid: m.uid,
          name: m.name ?? '玩家',
          emoji: m.emoji ?? '🙂',
          role: m.role === 'host' ? 'host' : 'guest',
        })
      }
    }
  }
  return out
}

/** 加入对战频道。返回发送器；自动用 presence 跟踪在场，未配置后端时安全降级为空操作。 */
export function joinDuelChannel(opts: JoinOpts): DuelChannel {
  const sb = supabase
  if (!sb) return { send: () => {}, leave: () => {}, enabled: false }

  const ch = sb.channel(`duel:${opts.code}`, {
    config: {
      broadcast: { self: false },
      // 用 uid 作为 presence key，自己一份，便于对端区分
      presence: { key: opts.me.uid },
    },
  })

  ch.on('broadcast', { event: 'm' }, (e: { payload: unknown }) => {
    opts.onMessage(e.payload as DuelMsg)
  })
  ch.on('presence', { event: 'sync' }, () => {
    opts.onPresence(flatten(ch.presenceState() as PresenceState))
  })
  ch.on('presence', { event: 'join' }, () => {
    opts.onPresence(flatten(ch.presenceState() as PresenceState))
  })
  ch.on('presence', { event: 'leave' }, () => {
    opts.onPresence(flatten(ch.presenceState() as PresenceState))
  })

  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      void ch.track(opts.me)
    }
  })

  return {
    enabled: true,
    send: (msg) => {
      void ch.send({ type: 'broadcast', event: 'm', payload: msg })
    },
    leave: () => {
      void ch.untrack()
      void sb.removeChannel(ch)
    },
  }
}
