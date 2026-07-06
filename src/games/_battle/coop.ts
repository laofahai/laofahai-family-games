// 打老师·多人协作（共斗）传输层。镜像「你画我猜」的 Supabase Realtime 广播玩法：
// 频道 `battle:<code>`，纯广播（不落库、低延迟、匿名公钥即可收发）。env 没配时安全降级为「单人房」。
//
// 协作模型（产品锁定）：
//  · 共享 Boss 血量（所有人一起打同一个 Boss）；
//  · 每个玩家答**自己年龄段**的题（low/high 各取各的）；
//  · 一起推进关卡，全员通关 = 「美好的回忆」结局。
//
// 权威模型：第一个进房的人当 host（房主），host 持有「共享 Boss 血量 / 当前关卡 / 玩家名单」唯一真源。
// 每个客户端只广播自己这次作答打出的伤害（hit 事件）；host 收齐后把伤害结算进共享 Boss 血量，
// 再低频（事件触发，非每帧）广播最新共享状态（boss hp / level / 在线玩家 / 最近一次命中特效）。
// 客户端渲染：共享 Boss 血量 + 自己的玩家血量。单人玩 = 一人房，走完全相同的代码路径（没有 peer 而已）。

import { joinRecordChannel, pocketBaseAvailable } from '@/platform/pocketbase'
import type { Band } from './core'

// ── 房号 ────────────────────────────────────────────────────────────
/** 生成一个简短好念的房号（4 位数字，跟其它远程玩法一致，方便口头报号）。 */
export function makeRoomCode(): string {
  return String(1000 + Math.floor(Math.random() * 9000))
}

/** 本设备稳定身份（同一台设备多次进房用同一个 id，host 据此去重 / 认人）。 */
export function selfPeerId(): string {
  const KEY = 'fg:battle:peer'
  try {
    const cached = localStorage.getItem(KEY)
    if (cached) return cached
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(KEY, id)
    return id
  } catch {
    // 隐私模式：本会话内用内存值（每次新建，至少这一局稳定）
    return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }
}

// ── 在线玩家 ─────────────────────────────────────────────────────────
/** 共享状态里对外可见的一名玩家。 */
export interface CoopPlayer {
  id: string // peer id
  name: string
  emoji: string
  band: Band // 该玩家自己的年龄段（决定他抽什么难度的题）
  heroHp: number // 该玩家自己的血量（各自独立，给名单展示用）
  heroMaxHp: number
  isHost: boolean
  down: boolean // 自己血空（倒下）了——其他人可继续，全员倒下才算团灭
}

/** host 低频广播的共享对局快照（唯一真源）。 */
export interface CoopShared {
  rev: number // 修订号，单调递增，客户端用它丢弃过期快照
  code: string
  hostId: string
  levelIndex: number // 当前第几关（共享）
  stepIndex: number // 当前关里第几步（共享小怪/Boss 进度）
  bossId: string // 当前敌人标识（spawn 同步用）
  bossName: string
  bossEmoji: string
  bossHp: number // 共享 Boss/敌人当前血量
  bossMaxHp: number
  phase: 'lobby' | 'playing' | 'won' | 'lost'
  players: CoopPlayer[] // 在线玩家名单（含自己）
  // 最近一次命中（给所有端播一次攻击特效，非每帧）
  lastHit?: { byId: string; byName: string; damage: number; crit: boolean; seq: number }
}

// ── 广播消息协议（event 'm'）────────────────────────────────────────
type CoopMsg =
  // guest → host：我来了 / 心跳（携带自身资料）
  | { t: 'hello'; player: Omit<CoopPlayer, 'isHost'> }
  // guest → host：我离开了
  | { t: 'bye'; id: string }
  // guest → host：我这次作答打出了多少伤害（命中共享 Boss）
  | { t: 'hit'; byId: string; byName: string; damage: number; crit: boolean }
  // guest → host：我自己血量变化（受击 / 倒下），让名单与团灭判断同步
  | { t: 'hp'; id: string; heroHp: number; down: boolean }
  // host → all：最新共享快照（唯一真源）
  | { t: 'state'; shared: CoopShared }
  // any → host：请把当前快照重发一遍（新人入房 / 掉线重连）
  | { t: 'sync?' }

export interface CoopHandlers {
  /** 收到 host 广播的共享快照（host 自己不会收到自己的，靠本地直接 setShared）。 */
  onShared?: (shared: CoopShared) => void
  /** host 专用：有 guest 打招呼（带资料），host 应把它并进名单。 */
  onHello?: (player: Omit<CoopPlayer, 'isHost'>) => void
  /** host 专用：有 guest 离开。 */
  onBye?: (id: string) => void
  /** host 专用：收到某 guest 的命中，host 据此扣共享 Boss 血。 */
  onHit?: (hit: { byId: string; byName: string; damage: number; crit: boolean }) => void
  /** host 专用：某 guest 自身血量变化。 */
  onHp?: (hp: { id: string; heroHp: number; down: boolean }) => void
  /** host 专用：有人请求重新同步当前快照。 */
  onSyncRequest?: () => void
}

export interface CoopChannel {
  /** 我是不是 host（建房 = host）。 */
  readonly isHost: boolean
  readonly code: string
  /** guest：报到 / 心跳。 */
  hello: (player: Omit<CoopPlayer, 'isHost'>) => void
  /** guest：上报一次命中。 */
  sendHit: (hit: { byId: string; byName: string; damage: number; crit: boolean }) => void
  /** guest：上报自身血量。 */
  sendHp: (hp: { id: string; heroHp: number; down: boolean }) => void
  /** guest / 重连：请求 host 重发快照。 */
  requestSync: () => void
  /** host：广播最新共享快照。 */
  broadcastShared: (shared: CoopShared) => void
  /** 离开频道（清理订阅）。 */
  leave: () => void
  /** 云端是否真的可用（false=单人降级，没有真实 peer）。 */
  readonly online: boolean
}

/**
 * 加入一个共斗频道。镜像 joinDrawChannel：`battle:<code>` + broadcast(self:false)。
 * @param code 房号
 * @param isHost 是否房主（建房的人 true）
 * @param handlers 各类消息回调
 */
export function joinCoopChannel(code: string, isHost: boolean, handlers: CoopHandlers): CoopChannel {
  const peerId = selfPeerId()
  const ch = joinRecordChannel({
    kind: 'battle',
    room: code,
    event: 'm',
    sender: peerId,
    ttlSeconds: 300,
    onMessage: (payload) => {
      const msg = payload as CoopMsg
      if (!msg || typeof msg !== 'object') return
      switch (msg.t) {
        case 'state':
          handlers.onShared?.(msg.shared)
          break
        case 'hello':
          handlers.onHello?.(msg.player)
          break
        case 'bye':
          handlers.onBye?.(msg.id)
          break
        case 'hit':
          handlers.onHit?.({ byId: msg.byId, byName: msg.byName, damage: msg.damage, crit: msg.crit })
          break
        case 'hp':
          handlers.onHp?.({ id: msg.id, heroHp: msg.heroHp, down: msg.down })
          break
        case 'sync?':
          handlers.onSyncRequest?.()
          break
        default:
          break
      }
    },
  })

  const send = (m: CoopMsg) => {
    ch.send(m)
  }

  return {
    isHost,
    code,
    online: pocketBaseAvailable(),
    hello: (player) => send({ t: 'hello', player }),
    sendHit: (hit) => send({ t: 'hit', ...hit }),
    sendHp: (hp) => send({ t: 'hp', ...hp }),
    requestSync: () => send({ t: 'sync?' }),
    broadcastShared: (shared) => send({ t: 'state', shared }),
    leave: ch.leave,
  }
}

/** 云端是否配置（决定是真多人还是单人降级）。 */
export function coopOnline(): boolean {
  return pocketBaseAvailable()
}
