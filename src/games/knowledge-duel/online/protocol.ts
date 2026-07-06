// 知识对战 · 在线协议（频道事件 / 载荷 / 谁权威 / 同步取舍）。
//
// ── 设计（选「简单且稳健」的一种）──────────────────────────────────────
// 每个玩家在自己手机上答自己的题（各自独立题集，不锁步同步题目）。每答一题，把
// 「结果」广播给对手：答对/答错、招式、伤害、暴击。对手据此播动画并改血。
//
// 权威规则（关键，避免写冲突 / 血量漂移）：**每个角色的血量只由它自己的玩家写。**
//   · 我答【对】→ 攻击对手：我【不】替对手算血，只发「我打了你 damage 点」(target:'enemy')。
//     对手收到后【自己】把这 damage 扣到自己头上 → 对手是它自己血量的唯一写者。
//   · 我答【错】→ 自损：我扣自己的血，发「我自损了，我现在 myHpAfter 点」(target:'self')。
//     对手收到后只把【对我的镜像血量】对齐到 myHpAfter（不参与计算）。
//   · 每条 strike 都带 myHpAfter（发送方当下自己的真实血量）：对手用它把镜像对齐，
//     即便上一条自损消息丢了也能纠偏。
//   这样每个角色血量「单写者」、伤害按 delta 正确累加，不会因绝对值覆盖而漏算。
//
// 不需要 host 逐题权威、不需要双端题目种子同步 → 实现简单、抗丢包。
// 胜负：当任一方血量 ≤ 0，双方各自从本地两份血量确定性判定（血先空者负）；
//   倒下方再发一条 'down' 兜底（防最后一拍 strike 丢失）。
//
// host 的唯一权威：开局握手时由 host 定 band/topic/maxHp（'hello' 里带），guest 采纳，
// 保证规则一致（题集仍各抽各的，互不影响）。
//
// 频道：PocketBase `rt_events`，kind='duel'、room=<code>、event='m'，自己发送的不回显。
// presence：track 各端 {uid,name,emoji,role}，用 sync/join/leave 判断对手在场/掉线。

import type { Band } from '@/games/_battle/core'
import type { AttackKind } from '../duelTypes'
import type { TopicMode } from '../types'

/** host 开局握手：把规则告诉 guest（guest 采纳）。 */
export interface HelloMsg {
  t: 'hello'
  uid: string
  name: string
  emoji: string
  band: Band
  topic: TopicMode
  maxHp: number
}

/** guest 回握：把自己的名字/头像告诉 host。 */
export interface HiMsg {
  t: 'hi'
  uid: string
  name: string
  emoji: string
}

/** 双方就绪、开打。host 在两端都到齐后发。 */
export interface StartMsg {
  t: 'start'
}

/** 一次作答结果。每个角色血量只由其所有者写（见顶注）。 */
export interface StrikeMsg {
  t: 'strike'
  uid: string // 发送方端 id
  correct: boolean
  crit: boolean
  damage: number
  kind: AttackKind
  /** enemy=答对打对方（对手收到后给自己扣 damage）；self=答错自损。 */
  target: 'enemy' | 'self'
  /** 这一击后【发送方自己】的真实血量：对手用来对齐对我方的镜像血量（纠偏）。 */
  myHpAfter: number
  /** 发送方当前连对数（仅用于对端展示对手🔥连击）。 */
  streak: number
}

/** 倒下兜底：发送方宣告自己已被打倒（防最后一拍 strike 丢失）。 */
export interface DownMsg {
  t: 'down'
  uid: string
}

/** 主动离开（点退出）。 */
export interface ByeMsg {
  t: 'bye'
  uid: string
}

/** 再来一局：host 发起，重置双方血量、重抽题。 */
export interface RematchMsg {
  t: 'rematch'
}

export type DuelMsg = HelloMsg | HiMsg | StartMsg | StrikeMsg | DownMsg | ByeMsg | RematchMsg
