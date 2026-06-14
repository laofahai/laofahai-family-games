// 云端名册：从 get_roster() RPC 读人物（家人/老师/同学 + 性别/班级/meta），缓存到 localStorage。
// 真源在数据库 profiles（迁移 0010）；代码不再硬编码人和性别。
// 用法：App 启动时 loadRoster() 拉一次缓存；游戏侧用 rosterRows()/rosterByName()/rosterById() 同步读。
// 模块顶层先把上次缓存读进来，让最早的开局也能用上。

import { supabase } from './supabase'

export type Gender = 'male' | 'female'

export interface RosterRow {
  id: string
  name: string
  emoji: string | null
  role: 'family' | 'teacher' | 'classmate'
  gender: Gender | null
  class_id: string | null
  meta: { subject?: string; hp?: number } | null
}

const CACHE_KEY = 'fg:roster'
let rows: RosterRow[] = []
let loaded = false

try {
  const raw = localStorage.getItem(CACHE_KEY)
  if (raw) {
    const parsed = JSON.parse(raw) as RosterRow[]
    if (Array.isArray(parsed)) {
      rows = parsed
      loaded = true
    }
  }
} catch {
  /* 隐私模式 / 解析失败：当作没缓存 */
}

export function rosterRows(): RosterRow[] {
  return rows
}

export function rosterReady(): boolean {
  return loaded
}

/** 从云端拉名册并写缓存。失败（离线/未配置/迁移未应用）返回 false，调用方回退硬编码。 */
export async function loadRoster(): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('get_roster')
  if (error || !Array.isArray(data)) return false
  rows = data as RosterRow[]
  loaded = true
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows))
  } catch {
    /* 容量满 / 隐私模式：内存里有就行 */
  }
  return true
}

export function rosterByName(name: string): RosterRow | undefined {
  return rows.find((r) => r.name === name)
}

export function rosterById(id: string): RosterRow | undefined {
  return rows.find((r) => r.id === id)
}

/** 取某班某角色的人（如某玩家班上的同学/老师）。 */
export function rosterIn(classId: string, role: RosterRow['role']): RosterRow[] {
  return rows.filter((r) => r.class_id === classId && r.role === role)
}
