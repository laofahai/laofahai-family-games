// 打老师·单人版：全部游戏逻辑用 React useReducer 管，这里是状态/动作/视图模型。
// Phaser 只当可视化舞台，由 React 调方法驱动；逻辑与渲染严格分离。

import type { Fighter, BattleQuestion } from '@/games/_battle/core'
import type { Encounter } from '@/games/_battle/encounters'
import type { BossDef, RosterDef } from '@/games/_battle/roster'

// 一关 = 先遇 2~3 个同学小怪，再打关底老师 Boss。
// 把这些预生成成「步骤队列」，逐个推进，逻辑清晰、好复现。

/** 攻击/受击的搞笑招式，双向都用。 */
export type AttackKind = 'slap' | 'kick' | 'tickle' | 'spit'
export const ATTACK_KINDS: AttackKind[] = ['slap', 'kick', 'tickle', 'spit']
export const ATTACK_META: Record<AttackKind, { emoji: string; label: string }> = {
  slap: { emoji: '👋', label: '扇大耳刮子' },
  kick: { emoji: '🦵', label: '踹一脚' },
  tickle: { emoji: '🤣', label: '挠痒痒' },
  spit: { emoji: '💦', label: '吐口痰' },
}

export function randomAttackKind(): AttackKind {
  return ATTACK_KINDS[Math.floor(Math.random() * ATTACK_KINDS.length)]
}

/** 小怪互动类型：melee=直接动手打（动作为主）；其余为偶发的「知识/社交」点缀。 */
export type MobMode = 'melee' | 'encounter' | 'question' | 'diss' | 'fitness'

/** 一个小怪步骤：是同学，给它名字/表情，以及它本回合用哪种互动。 */
export interface MobStep {
  kind: 'mob'
  name: string
  emoji: string
  hp: number
  mode: MobMode
}

// ── 损人/嘴炮：预设来自 contentFor<DissLine>('battle-disses', []) ──────────
/** 一句预设的损人台词。band 标年龄段；free-text 自定义不在此列。 */
export interface DissLine {
  id: string
  text: string
  band: 'low' | 'high'
}

// ── 体测传感器挑战：参数来自 contentFor<FitnessChallenge>('battle-fitness', []) ──
/** 一个体测挑战：用手机运动/方向传感器完成，达标=大伤害，失败=自己掉血。 */
export interface FitnessChallenge {
  id: string
  sport: 'rope' | 'situp' | 'sitreach' // 跳绳 / 仰卧起坐 / 坐位体前屈
  name: string // 给人看的名字，如「跳绳」
  emoji: string
  target: number // 达标目标（次数 / 秒数）
  unit: string // 单位，如「个」「秒」
  durationSec: number // 限时
  band: 'low' | 'high'
}

/** Boss 步骤：关底老师。 */
export interface BossStep {
  kind: 'boss'
  boss: BossDef
}

export type Step = MobStep | BossStep

/** 当前正等待玩家作答的「题目挑战」（来自 Boss 或好玩题小怪）。 */
export interface QuestionChallenge {
  type: 'question'
  question: BattleQuestion
}

/** 当前的社交遭遇挑战（来自社交小怪）。 */
export interface EncounterChallenge {
  type: 'encounter'
  encounter: Encounter
}

/** 损人/嘴炮挑战：可选预设台词，也可自己打字。低伤害但「侮辱性极强」的演出。 */
export interface DissChallenge {
  type: 'diss'
  presets: DissLine[] // 可选的预设损人台词（已按年龄段筛）
}

/** 体测传感器挑战：跳绳 / 仰卧起坐 / 坐位体前屈。 */
export interface FitnessChallengeState {
  type: 'fitness'
  challenge: FitnessChallenge
}

/** 纯动作小怪：没有题，走近用 👊 普攻打。 */
export interface MeleeChallenge {
  type: 'melee'
}

export type Challenge =
  | MeleeChallenge
  | QuestionChallenge
  | EncounterChallenge
  | DissChallenge
  | FitnessChallengeState

export type Phase =
  | 'playing' // 战斗进行中，等待玩家操作（答题/选择）
  | 'won' // 通关
  | 'lost' // 主角血空，失败

/** 一关（一个 Boss）的内容：前面的小怪队列 + Boss。 */
export interface LevelPlan {
  levelIndex: number // 0-based
  mobs: MobStep[]
  boss: BossStep
}

export interface GameState {
  roster: RosterDef
  band: 'low' | 'high'
  player: string
  hero: Fighter
  enemy: Fighter // 当前出场的敌人（小怪或 Boss）
  levels: LevelPlan[]
  levelIndex: number // 当前第几关（0-based）
  stepIndex: number // 当前关里第几个步骤（0..mobs.length，等于 mobs.length 时是 Boss）
  challenge: Challenge // 当前挑战
  streak: number // 连对数
  phase: Phase
  // 上一次结算的瞬时反馈（用于 React 浮层显示，不驱动 Phaser）
  lastResult: ResultFeedback | null
  // 触发 Phaser 动画的「指令序号」：每次 +1，组件用 effect 监听变化驱动场景
  fxSeq: number
  fx: BattleFx | null
  // 多人共斗：true=共享 Boss 血量由 host 权威覆盖（敌人血量不由本地结算决定，
  // 而是听 COOP_SYNC）。单人=false，走原有本地结算路径。
  coop: boolean
  // 学科大招「待答题」：按下⚡后弹一道学科题（模态），答对才放得出大招、答错哑火。
  // null=没有待答的大招题。学习类技能专属机制（回血不需要答题）。
  skillQuiz: { question: BattleQuestion } | null
}

/** 一次结算给 UI 看的反馈。 */
export interface ResultFeedback {
  ok: boolean // 是否「成功」(答对 / win)
  text: string // 主标题，如「答对啦！」「搞定他！」
  detail?: string // 解析 / 同学回复
  crit?: boolean
}

/** 要 Phaser 播的动画指令（声明式，组件读它来调 scene 方法）。 */
export interface BattleFx {
  kind:
    | 'hero-attack' // 主角攻击敌人
    | 'enemy-attack' // 敌人攻击主角
    | 'enemy-down' // 敌人倒下
    | 'spawn' // 新敌人登场
    | 'diss' // 损人嘴炮：大字 + 屏幕抖 + emoji 爆发（侮辱性极强）
    | 'peer-hit' // 队友（多人共斗）打出的命中：从天而降一记，标记是谁打的
    | 'none'
  attack?: AttackKind
  crit?: boolean
  damage?: number
  enemyEmoji?: string
  enemyName?: string
  isBoss?: boolean // spawn 用：是否老师 Boss（形象/血条区分）
  text?: string // diss 用：要砸在屏上的那句话
  byName?: string // peer-hit 用：队友名字
}

export type Action =
  | { type: 'MELEE' } // 普攻：走近用拳头打当前小怪（Boss 免疫，得用知识）
  | { type: 'ARM_NOVA' } // 学科大招·起手：弹一道学科题（设 skillQuiz），答对才放得出
  | { type: 'RESOLVE_NOVA'; choiceId: string } // 学科大招·结算：答对放招（秒小怪/重击老师），答错哑火
  | { type: 'SKILL_HEAL'; amount: number } // 技能·回血：主角恢复 amount 点血（不超上限，非学习类不需答题）
  | { type: 'ANSWER'; choiceId: string } // 答题：选了某选项
  | { type: 'TIMEOUT' } // 答题超时（算答错）
  | { type: 'PICK_ENCOUNTER'; optionId: string } // 社交遭遇：选了某回应
  | { type: 'DISS'; text: string; band?: 'low' | 'high' } // 损人嘴炮：选了预设或自己打字（text=那句话）
  | { type: 'FITNESS_DONE'; passed: boolean; reps: number } // 体测挑战结束：是否达标 + 完成次数
  | { type: 'ADVANCE' } // 敌人倒下后推进到下一个敌人/关卡/通关
  | { type: 'CLEAR_RESULT' } // 收起反馈浮层，继续战斗
  | { type: 'RESTART' } // 失败后从本关重来（或从头，外层决定）
  // ── 多人共斗（host 权威）：把共享 Boss 血量等覆盖进本地 state ──────────
  | { type: 'COOP_SYNC'; bossHp: number; bossMaxHp: number; levelIndex: number; stepIndex: number } // host 快照同步
  | { type: 'COOP_PEER_HIT'; byName: string; damage: number; crit: boolean } // 队友打出一记命中（播特效 + 扣共享血）
  | {
      type: 'COOP_ADVANCE' // host 指挥：换到下一个共享敌人（带新进度，全员同步）
      levelIndex: number
      stepIndex: number
      enemyEmoji: string
      enemyName: string
      enemyHp: number
      isBoss: boolean
    }
  | { type: 'COOP_WON' } // host 指挥：全部共享 Boss 打完 = 通关（美好的回忆结局）
