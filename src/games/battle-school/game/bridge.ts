// 事件桥（typed）：Phaser 场景 ←→ React 浮层之间唯一的通信通道。
// 场景是唯一事实来源（single source of truth）：它把状态 emit 出来，React 只渲染；
// React 通过 callbacks 把玩家意图（触屏按钮、答题、静音）喂回场景。这里不含任何游戏逻辑。
//
// 用一个极简的 mitt 风格 emitter（零依赖、强类型），不耦合 Phaser 的事件系统，
// 这样 React 端 import 它不会牵连整个 Phaser 包，类型也更干净。

import type { BattleQuestion, Band } from '@/games/_battle/core'

/** 移动方向：-1 左 / 0 停 / 1 右。 */
export type MoveDir = -1 | 0 | 1

/** 当前选用哪种大招（技能槽满时按 K 触发）。 */
export type SkillKind = 'nova' | 'heal'

/** 推给 HUD 的整盘状态快照（场景每帧/每次变化 emit）。 */
export interface HudState {
  hp: number
  maxHp: number
  level: number // 1-based 当前第几关
  totalLevels: number
  waveIndex: number // 1-based 当前第几波（含 Boss 波）
  waveTotal: number // 本关总波数（含 Boss 波）
  waveRemaining: number // 当前波场上还剩多少敌人
  isBossWave: boolean
  bossHp: number // Boss 当前血（非 Boss 波为 0）
  bossMaxHp: number
  bossName: string
  energy: number // 0-1 技能能量
  combo: number // 当前连杀
  skill: SkillKind // 当前选中的大招
  muted: boolean
  biome: string // 当前场景名（操场/森林…）
}

/** 答题面板打开的来源：boss=关底老师知识闸；skill=学霸大招触发。 */
export type QuizSource = 'boss' | 'skill'

export interface QuizOpenPayload {
  question: BattleQuestion
  source: QuizSource
  seconds: number // 限时（秒），用于 React 端倒计时
  subjectLabel: string
}

/** 一次答题结果的闪现反馈。 */
export interface ResultPayload {
  ok: boolean
  crit: boolean
  title: string
  detail?: string
}

export type GameOverResult = 'won' | 'lost'

/** 场景 → React 的事件表。 */
export interface BridgeEvents {
  hud: HudState
  'quiz:open': QuizOpenPayload
  'quiz:close': void
  result: ResultPayload
  gameover: GameOverResult
  ready: void // 资源加载完、首帧可玩
  loading: number // 0-1 资源加载进度
}

type Handler<T> = (payload: T) => void
type AnyHandler = (payload: never) => void

/** 极简强类型 emitter（mitt 风格）。内部用 Map<string, Set<fn>> 存，公开 API 仍强类型。 */
export class GameBridge {
  private handlers = new Map<keyof BridgeEvents, Set<AnyHandler>>()

  on<K extends keyof BridgeEvents>(type: K, fn: Handler<BridgeEvents[K]>): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(fn as AnyHandler)
    return () => set!.delete(fn as AnyHandler)
  }

  emit<K extends keyof BridgeEvents>(type: K, payload: BridgeEvents[K]): void {
    const set = this.handlers.get(type)
    if (!set) return
    for (const fn of set) (fn as Handler<BridgeEvents[K]>)(payload)
  }

  clear(): void {
    this.handlers.clear()
  }
}

/** React 调回场景的接口（触屏/答题/静音）。场景在 create() 后把实现挂上。 */
export interface GameControls {
  setMove(dir: MoveDir): void
  jump(): void
  attack(): void
  triggerSkill(): void // 技能满时弹大招题；未满则无效
  switchSkill(): void // 切换 nova/heal
  submitAnswer(choiceId: string | null): void // null = 超时/放弃
  toggleMute(): boolean
  restart(): void // Lose 后重开本关
}

/** 传给 Phaser 场景 init() 的配置。 */
export interface SceneConfig {
  player: string // 玩家 id（如 'shuner' / 'yiyi'），用于 rosterFor
  band: Band
  startLevel: number // 从第几关开（0-based）
  bridge: GameBridge
  /** 场景准备好后把它的控制接口回填给宿主，供 React 调用。 */
  onControls: (controls: GameControls) => void
}
