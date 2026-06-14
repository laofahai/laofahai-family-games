// 勋章/徽章系统：给每个「人」攒成就，按稀有度分级——
//   白 普通 < 绿 优秀 < 蓝 稀有 < 紫 史诗 < 橙 传说（颜色越炫、门槛越高）。
// 两类来源——
//  · 学习勋章（learn）：闯关里程碑/连击火力/神准命中/坚持打卡/学科大师/错题翻盘，
//    按学习游戏(=孩子)评定，数据全来自 learning.ts 的 Report。
//  · 探索勋章（explore）：玩过几款游戏，所有人都能拿。
// 本地优先存 `fg:badges:<玩家>`（{勋章id: 解锁时间戳}）；连了「个人码」的人，
// 解锁后整份推上云（复用 learn 表的 game='badges' 这一行），换设备跟着走。

import { pullLearn, pushLearn } from './cloud'
import { getReport, KID_PLAYER, type LearnGame, type Report } from './learning'
import { getSyncCode } from './progress'

export type Tier = 'white' | 'green' | 'blue' | 'purple' | 'orange'
export const TIER_ORDER: Tier[] = ['white', 'green', 'blue', 'purple', 'orange']
export const TIER_LABEL: Record<Tier, string> = {
  white: '普通',
  green: '优秀',
  blue: '稀有',
  purple: '史诗',
  orange: '传说',
}
// 解锁后的卡片配色（越高越炫；写全字面量好让 Tailwind 扫描到）
export const TIER_STYLE: Record<Tier, string> = {
  white: 'border-ink-200 bg-white text-ink-700',
  green: 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white text-emerald-700',
  blue: 'border-sky-300 bg-gradient-to-br from-sky-50 to-white text-sky-700',
  purple: 'border-purple-300 bg-gradient-to-br from-purple-100 to-white text-purple-700 shadow-sm',
  orange:
    'border-amber-400 bg-gradient-to-br from-amber-100 via-orange-50 to-white text-amber-700 shadow-md ring-1 ring-amber-300',
}
// 小圆点（稀有度标识）
export const TIER_DOT: Record<Tier, string> = {
  white: 'bg-ink-300',
  green: 'bg-emerald-400',
  blue: 'bg-sky-400',
  purple: 'bg-purple-400',
  orange: 'bg-amber-400',
}

export interface BadgeDef {
  id: string
  name: string
  emoji: string
  desc: string
  group: string
  tier: Tier
}

interface LearnBadge extends BadgeDef {
  /** 只对某个学习游戏有效；留空=两个学习游戏都评 */
  game?: LearnGame
  /** 满足条件 = 解锁 */
  test: (r: Report) => boolean
  /** 锁定时显示「差多少」（可选） */
  progress?: (r: Report) => { cur: number; goal: number }
}

interface ExploreBadge extends BadgeDef {
  need: number // 玩过这么多款游戏即解锁
}

// ── 学习勋章定义 ───────────────────────────────────────────────────
const MILESTONE = '闯关里程碑'
const COMBO = '连击火力'
const SHARP = '神准命中'
const DAILY = '坚持打卡'
const MASTER = '学科大师'
const COMEBACK = '错题翻盘'

const milestone = (id: string, name: string, emoji: string, tier: Tier, goal: number): LearnBadge => ({
  id,
  name,
  emoji,
  tier,
  desc: `累计闯关 ${goal} 题`,
  group: MILESTONE,
  test: (r) => r.totalDone >= goal,
  progress: (r) => ({ cur: r.totalDone, goal }),
})

const combo = (id: string, name: string, emoji: string, tier: Tier, goal: number): LearnBadge => ({
  id,
  name,
  emoji,
  tier,
  desc: `一局里连对 ${goal} 题`,
  group: COMBO,
  test: (r) => r.maxStreak >= goal,
  progress: (r) => ({ cur: r.maxStreak, goal }),
})

const daily = (id: string, name: string, emoji: string, tier: Tier, goal: number): LearnBadge => ({
  id,
  name,
  emoji,
  tier,
  desc: `连续 ${goal} 天来玩`,
  group: DAILY,
  test: (r) => r.streak >= goal,
  progress: (r) => ({ cur: r.streak, goal }),
})

const comeback = (id: string, name: string, emoji: string, tier: Tier, goal: number): LearnBadge => ({
  id,
  name,
  emoji,
  tier,
  desc: `把错题翻盘 ${goal} 道（错题做对清掉）`,
  group: COMEBACK,
  test: (r) => r.defeated >= goal,
  progress: (r) => ({ cur: r.defeated, goal }),
})

// 学科大师：某科做够 18 题且正确率 ≥ 88%（紫·史诗）
const master = (game: LearnGame, subject: string, name: string, emoji: string): LearnBadge => ({
  id: `s_${game}_${subject}`,
  name,
  emoji,
  tier: 'purple',
  desc: `该科做够 18 题、正确率 88%+`,
  group: MASTER,
  game,
  test: (r) => {
    const row = r.subjects.find((s) => s.subject === subject)
    return !!row && row.done >= 18 && row.accuracy >= 0.88
  },
  progress: (r) => {
    const row = r.subjects.find((s) => s.subject === subject)
    return { cur: Math.min(row?.done ?? 0, 18), goal: 18 }
  },
})

// 全科大师：本游戏所有学科都达标（橙·传说）
const allMaster = (game: LearnGame, subjects: string[]): LearnBadge => ({
  id: `s_${game}_all`,
  name: '全科大师',
  emoji: '🎓',
  tier: 'orange',
  desc: '所有学科都拿到大师',
  group: MASTER,
  game,
  test: (r) =>
    subjects.every((sub) => {
      const row = r.subjects.find((s) => s.subject === sub)
      return !!row && row.done >= 18 && row.accuracy >= 0.88
    }),
})

export const LEARN_BADGES: LearnBadge[] = [
  // 里程碑（白→橙，门槛阶梯抬升）
  milestone('m10', '初出茅庐', '🐣', 'white', 10),
  milestone('m50', '小有所成', '🌱', 'green', 50),
  milestone('m100', '百题斩', '💯', 'blue', 100),
  milestone('m300', '闯关达人', '🏅', 'purple', 300),
  milestone('m600', '六百强', '👑', 'orange', 600),
  milestone('m1000', '千题封神', '🏆', 'orange', 1000),
  // 连击火力
  combo('c3', '三连星', '✨', 'white', 3),
  combo('c5', '五连霸', '🔥', 'green', 5),
  combo('c10', '十连绝杀', '⚡', 'blue', 10),
  combo('c20', '二十连·封神', '🐉', 'purple', 20),
  combo('c30', '三十连·传说', '🌌', 'orange', 30),
  // 神准命中
  {
    id: 'full1',
    name: '单局满分',
    emoji: '🎯',
    tier: 'white',
    desc: '一局题全做对（≥5 题）',
    group: SHARP,
    test: (r) => r.fullSessions >= 1,
  },
  {
    id: 'full5',
    name: '满分常客',
    emoji: '🎖️',
    tier: 'blue',
    desc: '拿到 5 次满分局',
    group: SHARP,
    test: (r) => r.fullSessions >= 5,
    progress: (r) => ({ cur: r.fullSessions, goal: 5 }),
  },
  {
    id: 'acc80',
    name: '稳如泰山',
    emoji: '🗿',
    tier: 'green',
    desc: '做够 50 题、总命中率 80%+',
    group: SHARP,
    test: (r) => r.totalDone >= 50 && r.accuracy >= 0.8,
  },
  {
    id: 'acc90',
    name: '神枪手',
    emoji: '🏹',
    tier: 'purple',
    desc: '做够 60 题、总命中率 90%+',
    group: SHARP,
    test: (r) => r.totalDone >= 60 && r.accuracy >= 0.9,
  },
  {
    id: 'accmaster',
    name: '百题神准',
    emoji: '🎯',
    tier: 'orange',
    desc: '做够 120 题、总命中率 92%+',
    group: SHARP,
    test: (r) => r.totalDone >= 120 && r.accuracy >= 0.92,
  },
  // 坚持打卡
  daily('d3', '三天打卡', '📅', 'white', 3),
  daily('d7', '一周不断', '🗓️', 'green', 7),
  daily('d14', '半月不断', '📆', 'blue', 14),
  daily('d30', '月度铁人', '🦾', 'purple', 30),
  daily('d60', '两月不断·传说', '🪐', 'orange', 60),
  // 错题翻盘
  comeback('def1', '翻盘第一战', '♻️', 'white', 1),
  comeback('def10', '改过自新', '🔧', 'green', 10),
  comeback('def50', '错题克星', '🧹', 'blue', 50),
  comeback('def150', '错题终结者', '🛡️', 'orange', 150),
  {
    id: 'clear',
    name: '清零时刻',
    emoji: '🧼',
    tier: 'purple',
    desc: '把再战卡一次清空（翻盘≥3）',
    group: COMEBACK,
    test: (r) => r.totalDone > 0 && r.mistakes.length === 0 && r.defeated >= 3,
  },
  // 学科大师（各游戏不同）
  master('yiyi', 'math', '数学大师', '➗'),
  master('yiyi', 'chinese', '语文达人', '📖'),
  master('yiyi', 'english', '英语小能手', '🔤'),
  master('yiyi', 'science', '科学家', '🔬'),
  allMaster('yiyi', ['math', 'chinese', 'english', 'science']),
  master('shiliu', 'detective', '推理小神探', '🔍'),
  master('shiliu', 'shop', '购物小掌柜', '🛒'),
  master('shiliu', 'vertical', '竖式小能手', '📝'),
  allMaster('shiliu', ['detective', 'shop', 'vertical']),
]

// ── 探索勋章定义（所有玩家通用）────────────────────────────────────
export const EXPLORE_BADGES: ExploreBadge[] = [
  { id: 'e3', name: '尝鲜', emoji: '🍢', tier: 'white', desc: '玩过 3 款游戏', group: '探索', need: 3 },
  { id: 'e6', name: '博览', emoji: '🎪', tier: 'blue', desc: '玩过 6 款游戏', group: '探索', need: 6 },
  { id: 'e12', name: '全图鉴·传说', emoji: '🗺️', tier: 'orange', desc: '12 款游戏全玩过', group: '探索', need: 12 },
]

function applicable(def: LearnBadge, game: LearnGame): boolean {
  return !def.game || def.game === game
}

// ── 本地存储：每个玩家一份 { 勋章id: 解锁时间戳 } ─────────────────────
function bKey(player: string): string {
  return `fg:badges:${player}`
}
function pKey(player: string): string {
  return `fg:played:${player}`
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 隐私模式/容量满：静默忽略 */
  }
}

type BadgeMap = Record<string, number>

function loadBadges(player: string): BadgeMap {
  const raw = safeGet(bKey(player))
  if (!raw) return {}
  try {
    const o = JSON.parse(raw) as BadgeMap
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}
function saveBadges(player: string, map: BadgeMap): void {
  safeSet(bKey(player), JSON.stringify(map))
}

/** 把一批「现在满足」的勋章 id 落库，返回这次新解锁的定义（用于弹庆祝）。 */
function commitUnlocks(player: string, ids: string[], defs: BadgeDef[]): BadgeDef[] {
  const map = loadBadges(player)
  const fresh: BadgeDef[] = []
  const now = Date.now()
  for (const id of ids) {
    if (map[id] == null) {
      map[id] = now
      const def = defs.find((d) => d.id === id)
      if (def) fresh.push(def)
    }
  }
  if (fresh.length) {
    saveBadges(player, map)
    void pushBadgesToCloud(player)
  }
  // 新解锁的按稀有度从高到低弹（橙的先亮相）
  return fresh.sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier))
}

// ── 玩过哪些游戏（探索勋章用）──────────────────────────────────────
function loadPlayed(player: string): Set<string> {
  const raw = safeGet(pKey(player))
  if (!raw) return new Set()
  try {
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

/** 记一次「这个人玩了这款游戏」，并评探索勋章；返回新解锁的勋章。 */
export function recordPlayed(player: string, gameId: string): BadgeDef[] {
  const played = loadPlayed(player)
  if (!played.has(gameId)) {
    played.add(gameId)
    safeSet(pKey(player), JSON.stringify([...played]))
  }
  const ids = EXPLORE_BADGES.filter((b) => played.size >= b.need).map((b) => b.id)
  return commitUnlocks(player, ids, EXPLORE_BADGES)
}

export function playedCount(player: string): number {
  return loadPlayed(player).size
}

// ── 评定 ────────────────────────────────────────────────────────
/** 评一个学习游戏的勋章，落库新解锁的，返回新解锁定义（给孩子那个玩家记）。 */
export function checkLearnBadges(game: LearnGame): BadgeDef[] {
  const player = KID_PLAYER[game]
  const report = getReport(game)
  const ids = LEARN_BADGES.filter((d) => applicable(d, game) && d.test(report)).map((d) => d.id)
  return commitUnlocks(player, ids, LEARN_BADGES)
}

export interface BadgeView extends BadgeDef {
  unlocked: boolean
  progress?: { cur: number; goal: number }
}

/** 勋章墙数据：某个玩家的全部勋章（解锁的 + 未解锁的）。
 *  learnGame 有值时把该学习游戏的学习勋章也算进来（按当前进度判定 + 进度条）。 */
export function getBadgeWall(player: string, learnGame?: LearnGame): BadgeView[] {
  const owned = loadBadges(player)
  const played = loadPlayed(player)
  const out: BadgeView[] = []

  if (learnGame) {
    const report = getReport(learnGame)
    for (const d of LEARN_BADGES) {
      if (!applicable(d, learnGame)) continue
      const unlocked = owned[d.id] != null || d.test(report)
      out.push({
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        desc: d.desc,
        group: d.group,
        tier: d.tier,
        unlocked,
        progress: !unlocked ? d.progress?.(report) : undefined,
      })
    }
  }

  for (const b of EXPLORE_BADGES) {
    const unlocked = owned[b.id] != null || played.size >= b.need
    out.push({
      id: b.id,
      name: b.name,
      emoji: b.emoji,
      desc: b.desc,
      group: b.group,
      tier: b.tier,
      unlocked,
      progress: !unlocked ? { cur: played.size, goal: b.need } : undefined,
    })
  }
  return out
}

export function badgeStats(player: string, learnGame?: LearnGame): { got: number; total: number } {
  const wall = getBadgeWall(player, learnGame)
  return { got: wall.filter((b) => b.unlocked).length, total: wall.length }
}

// ── 云同步：勋章跟着「个人码」走（复用 learn 表的 game='badges'）────────
const BADGE_SLOT = 'badges'

async function pushBadgesToCloud(player: string): Promise<void> {
  const code = getSyncCode(player)
  if (!code) return
  await pushLearn(code, BADGE_SLOT, { unlocked: loadBadges(player), played: [...loadPlayed(player)] })
}

/** 进场/切人时把云端勋章并回本地（取并集，保留较早的解锁时间）。连了码才动。 */
export async function hydrateBadges(player: string): Promise<boolean> {
  const code = getSyncCode(player)
  if (!code) return false
  const remote = await pullLearn(code)
  const blob = remote[BADGE_SLOT] as { unlocked?: BadgeMap; played?: string[] } | undefined
  if (!blob) {
    await pushBadgesToCloud(player) // 云端还没有：把本地播上去
    return true
  }
  // 合并勋章（并集，时间取早）
  const local = loadBadges(player)
  let changed = false
  for (const [id, ts] of Object.entries(blob.unlocked ?? {})) {
    if (local[id] == null || ts < local[id]) {
      local[id] = ts
      changed = true
    }
  }
  if (changed) saveBadges(player, local)
  // 合并玩过的游戏
  if (Array.isArray(blob.played) && blob.played.length) {
    const played = loadPlayed(player)
    const before = played.size
    for (const g of blob.played) played.add(g)
    if (played.size !== before) safeSet(pKey(player), JSON.stringify([...played]))
  }
  await pushBadgesToCloud(player) // 双向并集
  return true
}
