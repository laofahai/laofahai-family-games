// 云端「战斗名册」：老师 / 同学 / 玩家本人的角色行，唯一真源在数据库（管理员或 AI 随时改）。
// App 启动拉一次缓存到 localStorage；之后离线走缓存。空时各游戏回退到代码里的硬编码名单。
//
// 一行 RosterRow = 一个人在某个班级里的身份：
//   · id        稳定 id（与 people.ts 的人物 id 对齐，玩家本人也是一行）
//   · name      显示名（头顶名牌、台词里用）
//   · class_id  所属班级（= people.ts 的 circle：shuner-class / yiyi-class / family）
//   · role      在战斗里的角色：teacher（老师→Boss）/ classmate（同学→小怪）/ player（玩家本人）
//   · gender    可选，男/女（女版素材到位后用；现阶段游戏不据此换 Kenney 精灵）
//   · meta      角色附加：老师带 subject（出哪科题）/ hp（Boss 血量）/ emoji
//
// 用法：游戏在「开局、构建名册」那一刻调用 rosterIn(classId, role) / rosterById(id)，
// 拿到的是云端最新（拉到了）或本机缓存（上次拉过）；都没有则空，调用方回退硬编码。
// 不要在模块顶层求值 —— 那会过早（启动拉取还没回来）锁死成空。

import { supabase } from './supabase'

export type RosterRole = 'teacher' | 'classmate' | 'player' | 'family'

export interface RosterRowMeta {
  subject?: string // 老师出哪科的题（math / chinese / english / science…）
  hp?: number // Boss 血量
  emoji?: string
}

export interface RosterRow {
  id: string
  name: string
  class_id: string
  role: RosterRole
  gender?: 'male' | 'female'
  meta?: RosterRowMeta
}

const CACHE_KEY = 'fg:roster'

let rows: RosterRow[] = []
let loaded = false

// 模块加载时先把上次缓存同步读进来，让最早的开局也能用上云端名册。
try {
  const raw = localStorage.getItem(CACHE_KEY)
  if (raw) {
    const parsed = JSON.parse(raw) as RosterRow[]
    if (Array.isArray(parsed)) {
      rows = parsed
      loaded = parsed.length > 0
    }
  }
} catch {
  /* 隐私模式 / 解析失败：当作没缓存 */
}

/** 当前名册全部行（云端/缓存）。空数组表示还没有云端数据（调用方应回退硬编码）。 */
export function rosterRows(): RosterRow[] {
  return rows
}

/** 是否已经有名册（缓存或云端拉到过非空）。 */
export function rosterReady(): boolean {
  return loaded
}

/** 按 id 取一行（玩家本人/老师/同学都可）。 */
export function rosterById(id: string): RosterRow | undefined {
  return rows.find((r) => r.id === id)
}

/** 按显示名取一行（同名取第一个）。 */
export function rosterByName(name: string): RosterRow | undefined {
  return rows.find((r) => r.name === name)
}

/** 取某班某角色的全部行（如某班所有老师 / 所有同学）。 */
export function rosterIn(classId: string, role: RosterRole): RosterRow[] {
  return rows.filter((r) => r.class_id === classId && r.role === role)
}

/** 从云端拉名册并写入缓存。失败（离线/未配置/无表）返回 false，沿用缓存。 */
export async function loadRoster(): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('get_roster')
  if (error || !Array.isArray(data)) return false
  const next: RosterRow[] = []
  for (const raw of data as Record<string, unknown>[]) {
    if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string') continue
    if (typeof raw.class_id !== 'string' || typeof raw.role !== 'string') continue
    const role = raw.role as RosterRole
    if (role !== 'teacher' && role !== 'classmate' && role !== 'player' && role !== 'family') continue
    const row: RosterRow = { id: raw.id, name: raw.name, class_id: raw.class_id, role }
    if (raw.gender === 'male' || raw.gender === 'female') row.gender = raw.gender
    if (raw.meta && typeof raw.meta === 'object') row.meta = raw.meta as RosterRowMeta
    next.push(row)
  }
  rows = next
  loaded = next.length > 0
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  } catch {
    /* 容量满 / 隐私模式：内存里有就行 */
  }
  return true
}
