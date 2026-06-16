// 《觉醒者》成长系统：经验/等级/称号 + 金币 + 战斗勋章。
// 设计同 progress.ts / badges.ts：localStorage 是同步的事实源；连了个人同步码的玩家
// 写入时顺手推上云、进场时从云拉回合并。
// 云端不新建表——整份进度塞进既有 learn 表的 game='progression' 这一行（复用 pull/pushLearn）。

import { pullLearn, pushLearn } from './cloud'
import { getCurrentPlayer, getSyncCode } from './progress'

// ── localStorage 小工具（与 progress.ts 同款，静默降级）────────────────
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
    /* 隐私模式 / 容量满：静默忽略 */
  }
}

// ── 类型 ────────────────────────────────────────────────────────────
export interface Progress {
  xp: number
  level: number
  title: string
  coins: number
  badges: string[]
}

/** 升级回执：awardXp 返回，方便 UI 弹「叮——升级！」 */
export interface LevelUp {
  leveledUp: boolean
  level: number
  title: string
}

export interface BadgeDef {
  id: string
  name: string
  desc: string
  emoji: string
}

// ── 等级曲线：累计 XP 阈值 → 等级 N ────────────────────────────────────
// 第 N 级所需「累计」总经验。曲线渐陡（新手快、后期肝），共 6 段称号。
// 落在最后一档之后继续按同档称号涨级。
const LEVEL_THRESHOLDS: readonly number[] = [
  0, // Lv.1
  100, // Lv.2
  250, // Lv.3
  500, // Lv.4
  900, // Lv.5
  1500, // Lv.6
  2400, // Lv.7
  3600, // Lv.8
  5200, // Lv.9
  7200, // Lv.10
  9800, // Lv.11
  13000, // Lv.12
]

/** 称号分段：每段覆盖若干等级，中二感拉满。 */
interface TitleBand {
  /** 进入该称号的最低等级 */
  minLevel: number
  title: string
}
const TITLE_BANDS: readonly TitleBand[] = [
  { minLevel: 1, title: '觉醒新星' },
  { minLevel: 3, title: '思考者' },
  { minLevel: 5, title: '学霸' },
  { minLevel: 7, title: '学神' },
  { minLevel: 9, title: '脑力领主' },
  { minLevel: 11, title: '觉醒之王' },
]

/** 累计 XP → 等级（1 起步）。超过表尾后每 +4000 XP 涨一级。 */
export function levelForXp(xp: number): number {
  const safe = Math.max(0, Math.floor(xp))
  let level = 1
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (safe >= LEVEL_THRESHOLDS[i]) level = i + 1
    else return level
  }
  // 超出预设表：线性外推，每 4000 XP 一级
  const last = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
  return LEVEL_THRESHOLDS.length + Math.floor((safe - last) / 4000)
}

/** 等级 → 中二称号 */
export function titleForLevel(level: number): string {
  let title = TITLE_BANDS[0].title
  for (const band of TITLE_BANDS) {
    if (level >= band.minLevel) title = band.title
  }
  return title
}

/** 进入「下一级」还差的 XP 区间，供 UI 画经验条。已是外推区间时按 4000 计。 */
export function levelBounds(xp: number): { level: number; floor: number; ceil: number } {
  const level = levelForXp(xp)
  const last = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
  // floor = 当前等级起点 = 「达到该 level 所需累计 XP」= ceil(level-1)。
  // 表内（level-1 在表内）直接查表；外推区（level-1 >= 表长，即 Lv.13+）
  // 用与 ceil 相同的 4000 步长规则推出上一级阈值，而非塌缩成 0。
  const floor =
    level - 1 < LEVEL_THRESHOLDS.length
      ? LEVEL_THRESHOLDS[level - 1]
      : last + 4000 * (level - LEVEL_THRESHOLDS.length)
  const ceil =
    level < LEVEL_THRESHOLDS.length
      ? LEVEL_THRESHOLDS[level]
      : last + 4000 * (level - LEVEL_THRESHOLDS.length + 1)
  return { level, floor, ceil }
}

// ── 战斗勋章定义 ──────────────────────────────────────────────────────
export const BATTLE_BADGES: readonly BadgeDef[] = [
  { id: 'first-clear', name: '首次通关', desc: '第一次打穿《觉醒者》，迈出觉醒第一步', emoji: '🏆' },
  { id: 'combo-20', name: '连对20', desc: '一气呵成连续答对 20 题，势如破竹', emoji: '🔥' },
  { id: 'all-subjects-perfect', name: '全科满分', desc: '所有学科全部满分通关，无懈可击', emoji: '💯' },
  { id: 'flawless', name: '无伤通关', desc: '全程零失误通关，滴水不漏', emoji: '🛡️' },
  { id: 'rescue-100', name: '解救满100同学', desc: '累计解救 100 名同学，救世主降临', emoji: '🦸' },
]

const BADGE_IDS = new Set(BATTLE_BADGES.map((b) => b.id))

// ── 本地存储 ──────────────────────────────────────────────────────────
const SLOT = 'progression' // learn 表里的 game key
const PREFIX = 'fg:progression'

function key(player: string): string {
  return `${PREFIX}:${player}`
}

const EMPTY: Progress = { xp: 0, level: 1, title: titleForLevel(1), coins: 0, badges: [] }

/** 读本地缓存的进度（带兜底；自动校正 level/title 与 xp 一致）。 */
export function getProgress(playerId: string = getCurrentPlayer()): Progress {
  const raw = safeGet(key(playerId))
  if (!raw) return { ...EMPTY }
  try {
    const p = JSON.parse(raw) as Partial<Progress>
    const xp = Math.max(0, Math.floor(p.xp ?? 0))
    const coins = Math.max(0, Math.floor(p.coins ?? 0))
    const badges = Array.isArray(p.badges) ? p.badges.filter((b) => BADGE_IDS.has(b)) : []
    const level = levelForXp(xp)
    return { xp, level, title: titleForLevel(level), coins, badges }
  } catch {
    return { ...EMPTY }
  }
}

function save(playerId: string, p: Progress): void {
  safeSet(key(playerId), JSON.stringify(p))
  const code = getSyncCode(playerId)
  if (code) void pushLearn(code, SLOT, p) // 连了云就顺手推，失败不影响本地
}

// ── 经验 / 升级 ───────────────────────────────────────────────────────
/** 加经验，落地本地+云，返回是否升级及新等级/称号。amount<=0 为空操作。 */
export function awardXp(playerId: string = getCurrentPlayer(), amount: number): LevelUp {
  const cur = getProgress(playerId)
  if (amount <= 0) return { leveledUp: false, level: cur.level, title: cur.title }
  const xp = cur.xp + Math.floor(amount)
  const level = levelForXp(xp)
  const title = titleForLevel(level)
  save(playerId, { ...cur, xp, level, title })
  return { leveledUp: level > cur.level, level, title }
}

// ── 金币 ──────────────────────────────────────────────────────────────
export function awardCoins(playerId: string = getCurrentPlayer(), n: number): void {
  if (n <= 0) return
  const cur = getProgress(playerId)
  save(playerId, { ...cur, coins: cur.coins + Math.floor(n) })
}

/** 花金币：不够返回 false 且不扣，够则扣并落地返回 true。 */
export function spendCoins(playerId: string = getCurrentPlayer(), n: number): boolean {
  const amount = Math.floor(n)
  if (amount <= 0) return true
  const cur = getProgress(playerId)
  if (cur.coins < amount) return false
  save(playerId, { ...cur, coins: cur.coins - amount })
  return true
}

// ── 勋章 ──────────────────────────────────────────────────────────────
/** 授予战斗勋章（幂等）：未知 id 或已有则返回 false 不写；新授返回 true。 */
export function grantBadge(playerId: string = getCurrentPlayer(), badgeId: string): boolean {
  if (!BADGE_IDS.has(badgeId)) return false
  const cur = getProgress(playerId)
  if (cur.badges.includes(badgeId)) return false
  save(playerId, { ...cur, badges: [...cur.badges, badgeId] })
  return true
}

// ── 云同步：进度跟着「个人码」走（复用 learn 表的 game='progression'）────
/** 进场/切人时把云端进度并回本地；连了码才动，返回是否同步过（call-safe）。 */
export async function hydrateProgress(playerId: string = getCurrentPlayer()): Promise<boolean> {
  const code = getSyncCode(playerId)
  if (!code) return false
  try {
    const remote = await pullLearn(code)
    const blob = remote[SLOT] as Partial<Progress> | undefined
    const local = getProgress(playerId)
    if (!blob) {
      // 云端还没有：把本地播上去
      if (local.xp > 0 || local.coins > 0 || local.badges.length) await pushLearn(code, SLOT, local)
      return true
    }
    // 合并：xp/coins 取较大值，勋章取并集
    const xp = Math.max(local.xp, Math.max(0, Math.floor(blob.xp ?? 0)))
    const coins = Math.max(local.coins, Math.max(0, Math.floor(blob.coins ?? 0)))
    const cloudBadges = Array.isArray(blob.badges) ? blob.badges.filter((b) => BADGE_IDS.has(b)) : []
    const badges = [...new Set([...local.badges, ...cloudBadges])]
    const level = levelForXp(xp)
    const merged: Progress = { xp, level, title: titleForLevel(level), coins, badges }
    save(playerId, merged) // 写回本地并把合并结果推回云，保持两端一致
    return true
  } catch {
    return false // 网络抖动不影响本地玩
  }
}
