// 进度 / 已见库：按「玩家 + 范围」记住玩过哪些内容，出题时过滤，池子抽完自动回收。
// Phase 0 用 localStorage；Phase 2 接 Supabase 时，把读写换成远程同步即可，调用方不用改。

const SEEN_PREFIX = 'fg:seen'
const PLAYER_KEY = 'fg:player'

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

/** 当前在玩的玩家（角色 id）；未选择时返回 'guest' */
export function getCurrentPlayer(): string {
  return safeGet(PLAYER_KEY) ?? 'guest'
}

export function setCurrentPlayer(playerId: string): void {
  safeSet(PLAYER_KEY, playerId)
}

function seenKey(player: string, scope: string): string {
  return `${SEEN_PREFIX}:${player}:${scope}`
}

export function getSeen(scope: string, player = getCurrentPlayer()): Set<string> {
  const raw = safeGet(seenKey(player, scope))
  if (!raw) return new Set()
  try {
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

export function markSeen(scope: string, ids: string[], player = getCurrentPlayer()): void {
  if (ids.length === 0) return
  const seen = getSeen(scope, player)
  for (const id of ids) seen.add(id)
  safeSet(seenKey(player, scope), JSON.stringify([...seen]))
}

export function resetSeen(scope: string, player = getCurrentPlayer()): void {
  safeSet(seenKey(player, scope), JSON.stringify([]))
}

/**
 * 从 items 中挑 count 个「没见过」的，并自动标记为已见。
 * 没见过的不够时，先回收（清空已见）再补齐——保证总能凑够，且优先不重复。
 * idOf 把一项映射成稳定 id。order 决定挑选顺序（默认保持原序，传 shuffle 后的数组即可随机）。
 */
export function pickUnseen<T>(
  scope: string,
  items: readonly T[],
  idOf: (item: T) => string,
  count: number,
  player = getCurrentPlayer()
): T[] {
  if (items.length === 0) return []
  const seen = getSeen(scope, player)
  const fresh = items.filter((it) => !seen.has(idOf(it)))
  const picked: T[] = []

  for (const it of fresh) {
    if (picked.length >= count) break
    picked.push(it)
  }

  if (picked.length < count) {
    // 新鲜的不够了：回收，从剩下没选过的里继续补
    const chosenIds = new Set(picked.map(idOf))
    const rest = items.filter((it) => !chosenIds.has(idOf(it)))
    for (const it of rest) {
      if (picked.length >= count) break
      picked.push(it)
    }
    resetSeen(scope, player)
  }

  markSeen(scope, picked.map(idOf), player)
  return picked
}
