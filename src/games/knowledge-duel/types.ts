import type { Band } from '@/games/_battle/questions'
import type { BattleQuestion, Fighter } from '@/games/_battle/core'

/** 对战模式：热座（同一台手机轮流）/ 人机。在线 PvP 见 TODO（暂未实现）。 */
export type DuelMode = 'hotseat' | 'cpu'

/** 题型偏好：纯学习 / 纯好玩 / 混合（一半一半）。 */
export type TopicMode = 'learn' | 'fun' | 'mix'

/** 电脑难度（仅 cpu 模式用）→ 影响命中率。 */
export type CpuLevel = 'easy' | 'normal' | 'hard'

export interface PlayerSetup {
  name: string
  emoji: string
}

export interface DuelConfig {
  mode: DuelMode
  band: Band
  topic: TopicMode
  cpuLevel: CpuLevel
  left: PlayerSetup
  right: PlayerSetup
  maxHp: number
}

/** 出招阶段：用于驱动动画与回合切换。 */
export type Phase =
  | 'intro' // 开场「准备战斗」横幅
  | 'asking' // 等待当前出招者作答
  | 'resolving' // 已作答，正在播放出招/受击动画
  | 'turnswap' // 回合切换提示
  | 'over' // 分出胜负

/** 一次出招的结算快照（给动画层读）。 */
export interface Strike {
  attacker: 'left' | 'right'
  correct: boolean
  crit: boolean
  damage: number
  target: 'enemy' | 'self'
  /** 被打的那一方（用于抖动/飘字定位）。 */
  victim: 'left' | 'right'
  chosen: string | null // 选了哪个选项 id（null=超时/未选）
}

export interface DuelState {
  phase: Phase
  left: Fighter
  right: Fighter
  turn: 'left' | 'right' // 当前轮到谁出招
  streak: { left: number; right: number } // 各自连对数
  round: number // 第几回合（双方各出一次算推进）
  queue: BattleQuestion[] // 题库队列
  qIndex: number // 当前题在队列中的位置
  current: BattleQuestion | null
  lastStrike: Strike | null
  winner: 'left' | 'right' | null
  log: string[] // 战报（最近若干条）
}
