// 云端内容库：题库 / 词库 / 卡片的真源在数据库（管理员或 AI 随时改），
// App 启动拉一次缓存到 localStorage；离线或没配后端时回退到代码里的打包副本。
//
// 用法：游戏在「开局、构建牌库」那一刻调用 contentFor('charades', 打包副本)，
// 拿到的就是云端最新内容（拉到了）或缓存（上次拉过）或打包副本（首次离线）。
// 不要在模块顶层求值 contentFor —— 那会过早（启动拉取还没回来）锁死成打包副本。

import { supabase } from './supabase'

const CACHE_KEY = 'fg:content'

type Bank = unknown[]
let store: Record<string, Bank> = {}
let loaded = false

// 模块加载时先把上次缓存同步读进来，让最早的开局也能用上云端内容
try {
  const raw = localStorage.getItem(CACHE_KEY)
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, Bank>
    if (parsed && typeof parsed === 'object') {
      store = parsed
      loaded = true
    }
  }
} catch {
  /* 隐私模式 / 解析失败：当作没缓存 */
}

/**
 * 取某个内容库。有云端/缓存就用云端/缓存，否则回退到传入的打包副本。
 * 在「开局构建牌库」时调用，不要在模块顶层调用。
 */
export function contentFor<T>(key: string, fallback: readonly T[]): T[] {
  const v = store[key]
  if (Array.isArray(v) && v.length > 0) return v as T[]
  return fallback as T[]
}

/** 是否已经有内容（缓存或云端）。 */
export function contentReady(): boolean {
  return loaded
}

/** 从云端拉全部内容并写入缓存。失败（离线/未配置）返回 false，沿用缓存/打包副本。 */
export async function refreshContent(): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('get_all_content')
  if (error || !Array.isArray(data)) return false
  const next: Record<string, Bank> = {}
  for (const row of data as { game: string; data: unknown }[]) {
    if (row && typeof row.game === 'string' && Array.isArray(row.data)) {
      next[row.game] = row.data as Bank
    }
  }
  store = next
  loaded = true
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  } catch {
    /* 容量满 / 隐私模式：内存里有就行 */
  }
  return true
}
