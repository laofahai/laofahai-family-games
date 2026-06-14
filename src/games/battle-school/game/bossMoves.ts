// 老师 BOSS 主动攻击招式池（纯数据 + 选招/调参助手）。设计依据：design §7「老师主动攻击」。
//
// ── 这是一个纯模块 ──────────────────────────────────────────────
//   只导出数据(MOVE_POOL)、类型(TeacherMove…)与纯函数(movesForBoss / moveTotalMs)。
//   不 import 场景、不访问运行时、不调用 Math.random / Date.now —— 所以可被状态机自由消费、可摇树。
//   选招的随机性由调用方注入的 `pick` 决定（见下「联机一致性」）。
//
// ── Enemy / ArenaScene 如何驱动这套招式 ─────────────────────────
//   Boss 的主动攻击是一个三段式状态机循环，由 Enemy（行为/表演）配合 ArenaScene（数值/答题闸/碰撞）跑：
//
//     idle/逼近  ──冷却到 & 满足触发──▶  TELEGRAPH（预警）
//                                          │  必须展示 ≥ telegraphMs(≥500ms) 的「起手 tell」
//                                          │  —— 画面给玩家看得见的预兆（拍桌前抬手 / 粉笔头蓄力 / 地面红圈…），
//                                          │     这段时间正是玩家做出 dodge 反应的窗口。
//                                          ▼
//                                       ACTIVE（命中判定生效）持续 activeMs
//                                          │  按 move.effect 在 ArenaScene 里结算实际效果与碰撞：
//                                          │    ground-shock → 地面冲击波，dodge='jump'（跳起的无敌帧/离地躲过）
//                                          │    projectile   → 飞射粉笔头，dodge='move'（左右走位闪开），用 projectileSpeed/range
//                                          │    cone         → 扇形唾沫范围，dodge='move'（退出扇区）
//                                          │    root         → 把主角钉住「罚站」，dodge='mash'（狂点挣脱）
//                                          │    aoe-drop     → 头顶落下「作业山」砸落点，dodge='move'
//                                          │    forced-quiz  → 强制弹题「我点名了」，dodge='answer'（答对免伤/反伤）
//                                          │    disable-skill→「没收」临时封技能，dodge='answer'（答对取回）
//                                          │    gaze-stun    → 眼神杀短眩晕，dodge='move'（背身/离开视线锥）
//                                          │    enrage       → 「拖堂」自增益（加速/加伤），无直接命中，玩家靠输出抢血压制
//                                          │    damage-down  → 「最差的一届」对主角施加减伤 debuff，dodge='answer'（答题驱散）
//                                          ▼
//                                       RECOVER（后摇/破绽）持续 recoverMs
//                                          │  Boss 收招露破绽 —— 鼓励玩家此刻贴脸输出/触发答题反打。
//                                          ▼
//                                       回到 idle/逼近，下次冷却到后再选下一招。
//
//   · dodge 语义统一映射到四种玩家操作：'jump' 跳 / 'move' 走位 / 'mash' 狂点 / 'answer' 答题。
//     状态机据此决定「这一招看哪种输入算躲过」。
//   · 触发期由场景管理（冷却、与答题闸/hitstop 互斥、同屏只允许一招生效等），本模块不持有任何计时状态。
//   · 联机一致性：选招走 movesForBoss({…, pick})，pick 由调用方用「带种子的确定性 RNG」实现
//     （同一局所有 co-op 客户端用同一种子）—— 因此各端选出的招式序列收敛一致，无需同步招式本身。

import type Phaser from 'phaser'

// 让「只 import 类型」也算用到 Phaser（保持与同目录模块一致的依赖、且被摇树时无副作用）。
export type TeacherMovePhaserHint = Phaser.Types.Math.Vector2Like

/** 招式的效果类型 —— 决定 ArenaScene 用哪套碰撞/结算逻辑。 */
export type TeacherMoveEffect =
  | 'ground-shock' // 地面冲击波（拍桌子）
  | 'projectile' // 飞射物（粉笔头）
  | 'cone' // 扇形范围（唾沫横飞）
  | 'root' // 定身/钉住（出来罚站）
  | 'aoe-drop' // 头顶落下范围（作业山）
  | 'forced-quiz' // 强制弹题（我点名了）
  | 'disable-skill' // 封禁技能（没收）
  | 'gaze-stun' // 注视眩晕（眼神杀）
  | 'enrage' // 自身狂暴增益（拖堂）
  | 'damage-down' // 对主角施加减伤 debuff（最差的一届）

/** 玩家躲招的操作语义 —— 状态机据此判定「看哪种输入算躲过」。 */
export type TeacherMoveDodge = 'jump' | 'move' | 'mash' | 'answer'

/**
 * 一招老师主动攻击。三段时长描述 telegraph→active→recover 循环；其余为可选调参字段。
 * 纯数据：不含任何运行时状态（计时由场景持有）。
 */
export interface TeacherMove {
  id: string
  /** 中文招名，如「拍桌子」。 */
  label: string
  effect: TeacherMoveEffect
  /** 预警时长（ms），必须 ≥ 500，给玩家看得见的反应窗口。 */
  telegraphMs: number
  /** 命中判定生效时长（ms）。 */
  activeMs: number
  /** 后摇/破绽时长（ms），收招露破绽供玩家反打。 */
  recoverMs: number
  /** 躲招操作语义。 */
  dodge: TeacherMoveDodge
  /** 限定科目（subject-special 专属招才填；通用招不填）。 */
  subject?: string

  // ── 可选调参字段（ArenaScene 结算时按需取用）──────────────
  /** 命中伤害（对主角）。enrage 等无直接命中的招可省略。 */
  damage?: number
  /** 有效作用距离/半径（px），按 effect 含义不同：冲击波半径 / 扇形长度 / 落点半径 / 注视锥长。 */
  range?: number
  /** 飞射物速度（px/s），仅 projectile 用。 */
  projectileSpeed?: number
  /** 飞射物/落点个数，projectile / aoe-drop 用。 */
  count?: number
  /** 效果持续时长（ms）：定身/封技能/眩晕/增益/减伤这类「附加状态」的持续，区别于 activeMs（命中窗口）。 */
  durationMs?: number
  /** 增益/减伤倍率（如 enrage 提速 1.4、damage-down 减伤到 0.5）。 */
  potency?: number
}

/**
 * 全部 §7 招式池。每招 telegraphMs ≥ 500（高威胁招给更长预警，公平可躲）。
 * 通用招（无 subject）+ 科目专属招（subject 命中各科 Boss）。
 */
export const MOVE_POOL: readonly TeacherMove[] = [
  // ── 通用招（任何老师都可能用）──────────────────────────────
  {
    id: 'desk-slam',
    label: '拍桌子',
    effect: 'ground-shock',
    telegraphMs: 600,
    activeMs: 280,
    recoverMs: 520,
    dodge: 'jump', // 地面冲击波 —— 跳起来躲
    damage: 1,
    range: 220,
  },
  {
    id: 'chalk-throw',
    label: '粉笔头',
    effect: 'projectile',
    telegraphMs: 520,
    activeMs: 200,
    recoverMs: 360,
    dodge: 'move', // 飞射物 —— 走位闪开
    damage: 1,
    range: 900,
    projectileSpeed: 520,
    count: 1,
  },
  {
    id: 'spit-storm',
    label: '唾沫横飞',
    effect: 'cone',
    telegraphMs: 560,
    activeMs: 420,
    recoverMs: 420,
    dodge: 'move', // 扇形范围 —— 退出扇区
    damage: 1,
    range: 320,
  },
  {
    id: 'stand-punish',
    label: '出来罚站',
    effect: 'root',
    telegraphMs: 640,
    activeMs: 160,
    recoverMs: 480,
    dodge: 'mash', // 定身 —— 狂点挣脱
    damage: 0,
    range: 260,
    durationMs: 1400,
  },
  {
    id: 'homework-avalanche',
    label: '作业山',
    effect: 'aoe-drop',
    telegraphMs: 800,
    activeMs: 360,
    recoverMs: 560,
    dodge: 'move', // 头顶落下 —— 走开落点
    damage: 1,
    range: 140,
    count: 3,
  },
  {
    id: 'roll-call',
    label: '我点名了',
    effect: 'forced-quiz',
    telegraphMs: 700,
    activeMs: 120,
    recoverMs: 600,
    dodge: 'answer', // 强制弹题 —— 答对免伤/反打
    damage: 2,
    durationMs: 6000, // 答题限时窗口
  },
  {
    id: 'confiscate',
    label: '没收',
    effect: 'disable-skill',
    telegraphMs: 560,
    activeMs: 160,
    recoverMs: 420,
    dodge: 'answer', // 封技能 —— 答对取回
    range: 360,
    durationMs: 5000,
  },
  {
    id: 'death-gaze',
    label: '眼神杀',
    effect: 'gaze-stun',
    telegraphMs: 620,
    activeMs: 240,
    recoverMs: 400,
    dodge: 'move', // 注视眩晕 —— 离开视线锥/背身
    damage: 0,
    range: 480,
    durationMs: 900,
  },
  {
    id: 'overtime-class',
    label: '拖堂',
    effect: 'enrage',
    telegraphMs: 900,
    activeMs: 200,
    recoverMs: 300,
    dodge: 'move', // 自增益无直接命中 —— 靠输出抢血压制（走位拉扯）
    durationMs: 7000,
    potency: 1.4, // 提速/加伤倍率
  },
  {
    id: 'worst-class-ever',
    label: '最差的一届',
    effect: 'damage-down',
    telegraphMs: 760,
    activeMs: 200,
    recoverMs: 420,
    dodge: 'answer', // 减伤 debuff —— 答题驱散
    range: 520,
    durationMs: 6000,
    potency: 0.5, // 主角伤害降到 5 折
  },

  // ── 科目专属招（命中对应科目的 Boss）──────────────────────
  {
    id: 'math-pop-quiz',
    label: '随堂测验',
    effect: 'forced-quiz',
    telegraphMs: 700,
    activeMs: 120,
    recoverMs: 560,
    dodge: 'answer',
    subject: 'math',
    damage: 2,
    durationMs: 6000,
  },
  {
    id: 'chinese-recite',
    label: '全文背诵',
    effect: 'root',
    telegraphMs: 660,
    activeMs: 160,
    recoverMs: 500,
    dodge: 'mash',
    subject: 'chinese',
    damage: 0,
    range: 280,
    durationMs: 1600,
  },
  {
    id: 'english-dictation',
    label: '听写单词',
    effect: 'forced-quiz',
    telegraphMs: 700,
    activeMs: 120,
    recoverMs: 560,
    dodge: 'answer',
    subject: 'english',
    damage: 2,
    durationMs: 6000,
  },
  {
    id: 'science-experiment',
    label: '危险实验',
    effect: 'aoe-drop',
    telegraphMs: 820,
    activeMs: 380,
    recoverMs: 560,
    dodge: 'move',
    subject: 'science',
    damage: 1,
    range: 150,
    count: 4,
  },
  {
    id: 'sports-laps',
    label: '罚跑十圈',
    effect: 'cone',
    telegraphMs: 540,
    activeMs: 460,
    recoverMs: 380,
    dodge: 'move',
    subject: 'sports',
    damage: 1,
    range: 360,
  },
] as const

const GENERIC_MOVE_IDS = MOVE_POOL.filter((m) => !m.subject).map((m) => m.id)

/** 招式速查表，便于按 id 取（如 override 指定 id）。 */
const MOVE_BY_ID: Record<string, TeacherMove> = Object.fromEntries(
  MOVE_POOL.map((m) => [m.id, m]),
)

/** 整套招式一轮的总时长（telegraph + active + recover），便于场景排期/预算。 */
export function moveTotalMs(move: TeacherMove): number {
  return move.telegraphMs + move.activeMs + move.recoverMs
}

/** 难度带的「温和 ↔ 凶」分档：low 招少、high 招多。 */
const GENERIC_COUNT_BY_BAND: Record<'low' | 'high', number> = {
  low: 2, // low band → 更少、更温和
  high: 3, // high band → 更多
}

export interface MovesForBossOpts {
  /** Boss 出哪科 —— 用于挑科目专属招。 */
  subject?: string
  /** 难度带：low 少/温和，high 多/快。 */
  band: 'low' | 'high'
  /** 显式指定招式 id 列表（给定则原样按 id 取出，忽略随机挑选）。 */
  override?: string[]
  /**
   * 注入的确定性挑选器（从数组里挑一个元素）。
   * 调用方用「带种子的 RNG」实现，使各 co-op 客户端选出的招式序列一致。
   * 本模块绝不调用 Math.random。
   */
  pick: <T>(arr: T[]) => T
}

/**
 * 为某个 Boss 组建招式组：2–3 个通用招 + 1 个科目专属招（若该科有专属招）。
 * 通过注入的 `pick` 做确定性选择；给了 `override` 则直接按 id 取。
 *
 * - low band → 更少通用招（更温和）；high band → 更多通用招（更快/更密）。
 * - 选出的通用招去重；科目专属招优先该科，缺则不强加。
 */
export function movesForBoss(opts: MovesForBossOpts): TeacherMove[] {
  const { subject, band, override, pick } = opts

  // 显式覆盖：按 id 原样取出（保留顺序、过滤未知 id）。
  if (override && override.length > 0) {
    return override.map((id) => MOVE_BY_ID[id]).filter((m): m is TeacherMove => Boolean(m))
  }

  const wantGeneric = GENERIC_COUNT_BY_BAND[band]

  // 从通用招池里确定性地挑 wantGeneric 个不重复的（用注入 pick 反复抽、去重）。
  const pool = [...GENERIC_MOVE_IDS]
  const chosenIds: string[] = []
  while (chosenIds.length < wantGeneric && pool.length > 0) {
    const id = pick(pool)
    chosenIds.push(id)
    pool.splice(pool.indexOf(id), 1) // 抽出即移除，保证不重复
  }

  const moves = chosenIds.map((id) => MOVE_BY_ID[id])

  // 科目专属招：该科有则补一个（high band 才必然加；low band 也加但整体仍偏少）。
  if (subject) {
    const specials = MOVE_POOL.filter((m) => m.subject === subject)
    if (specials.length > 0) {
      const special = pick([...specials])
      // 避免与通用招重复 id（专属招 id 与通用招不重叠，这里仅作防御）。
      if (!moves.some((m) => m.id === special.id)) moves.push(special)
    }
  }

  return moves
}
