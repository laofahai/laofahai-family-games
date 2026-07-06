// 云端内容库：题库 / 词库 / 卡片的【唯一真源在数据库】（管理员或 AI 随时改）。
// 首页不拉全量内容；进游戏前只拉该游戏需要的内容库，之后离线走缓存。
//
// 用法：游戏在「开局、构建牌库」那一刻调用 contentFor('charades', [])，
// 拿到的是云端最新内容（拉到了）或本机缓存（上次拉过）；都没有则空数组，
// 由 App 的游戏入口保证进游戏前内容已就绪。
// 不要在模块顶层求值 contentFor —— 那会过早（启动拉取还没回来）锁死成空。

import { fgPost } from './pocketbase'

const CACHE_KEY = 'fg:content'

type Bank = unknown[]
let store: Record<string, Bank> = {}
let loaded = false

const GAME_CONTENT_KEYS: Record<string, readonly string[]> = {
  charades: ['charades'],
  draw: ['draw'],
  undercover: ['word-bank'],
  knowYou: ['know-you', 'know-family'],
  price: ['price'],
}

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
 * 取某个内容库：有云端/缓存就用，没有则用传入的 fallback（现统一传 []）。
 * 在「开局构建牌库」时调用，不要在模块顶层调用。
 */
export function contentFor<T>(key: string, fallback: readonly T[]): T[] {
  const v = store[key]
  if (Array.isArray(v) && v.length > 0) return v as T[]
  return fallback as T[]
}

export function contentKeysForGame(gameId: string): readonly string[] {
  return GAME_CONTENT_KEYS[gameId] ?? []
}

function hasContent(key: string): boolean {
  const v = store[key]
  return Array.isArray(v) && v.length > 0
}

/** 是否已经有内容（缓存或云端）。 */
export function contentReady(): boolean {
  return loaded
}

/** 确保这些内容库可用；进游戏前按游戏小范围刷新，失败时允许使用已有缓存。 */
export async function ensureContent(keys: readonly string[]): Promise<boolean> {
  const uniqueKeys = Array.from(new Set(keys))
  if (uniqueKeys.length === 0) return true
  const pulled = await refreshContent(uniqueKeys)
  return pulled || uniqueKeys.every(hasContent)
}

/** 从云端拉内容并写入缓存。传 keys 时按需拉；不传时保留旧的全量拉取能力。 */
export async function refreshContent(keys?: readonly string[]): Promise<boolean> {
  const uniqueKeys = keys ? Array.from(new Set(keys)) : []
  const result = await fgPost<{ content: { game: string; data: unknown }[] }>('/get-content', { games: uniqueKeys })
  const data = result?.content
  if (!Array.isArray(data)) return false
  const next: Record<string, Bank> = uniqueKeys.length ? { ...store } : {}
  for (const row of data) {
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
  return uniqueKeys.length ? uniqueKeys.every(hasContent) : true
}
