// 进度 / 已见库：按「玩家 + 范围」记住玩过哪些内容，出题时过滤，池子抽完自动回收。
// localStorage 永远是同步的事实源；连了个人同步码的玩家，写入时顺手推上云、切人时从云拉回合并。

import { pullSeen, pushSeen } from './cloud'

const SEEN_PREFIX = 'fg:seen'
const PLAYER_KEY = 'fg:player'
const SYNC_KEY = 'fg:synccodes'

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
  const all = [...seen]
  safeSet(seenKey(player, scope), JSON.stringify(all))
  const code = getSyncCode(player)
  if (code) void pushSeen(code, scope, all) // 连了云就顺手推，失败不影响本地
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

// ── 个人同步码：让某个人的「玩过/进度」跟着 TA 换设备 ──────────────────────
// 存 { 玩家id: 同步码 } 的小表。连了码的玩家，markSeen 会上推，hydrate 会下拉合并。

function loadSyncMap(): Record<string, string> {
  const raw = safeGet(SYNC_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

/** 这个玩家连上的个人同步码（没连返回 null） */
export function getSyncCode(player = getCurrentPlayer()): string | null {
  return loadSyncMap()[player] ?? null
}

export function setSyncCode(code: string, player = getCurrentPlayer()): void {
  const map = loadSyncMap()
  map[player] = code
  safeSet(SYNC_KEY, JSON.stringify(map))
}

export function clearSyncCode(player = getCurrentPlayer()): void {
  const map = loadSyncMap()
  delete map[player]
  safeSet(SYNC_KEY, JSON.stringify(map))
}

/** 本地已有记录的全部 scope（首次连接时把本机进度也推上云用） */
function localScopes(player: string): string[] {
  const prefix = `${SEEN_PREFIX}:${player}:`
  const out: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length))
    }
  } catch {
    /* 忽略 */
  }
  return out
}

/** 从云端把进度并进本地（取并集）。连了码才动，返回是否同步过。 */
export async function hydratePlayer(player = getCurrentPlayer()): Promise<boolean> {
  const code = getSyncCode(player)
  if (!code) return false
  const remote = await pullSeen(code)
  for (const [scope, ids] of Object.entries(remote)) {
    const seen = getSeen(scope, player)
    for (const id of ids) seen.add(id)
    safeSet(seenKey(player, scope), JSON.stringify([...seen]))
  }
  return true
}

/** 把本机已有进度整体推上云（首次连接时合并方向：本地→云）。 */
export async function pushAllLocal(player = getCurrentPlayer()): Promise<void> {
  const code = getSyncCode(player)
  if (!code) return
  for (const scope of localScopes(player)) {
    const ids = [...getSeen(scope, player)]
    if (ids.length) await pushSeen(code, scope, ids)
  }
}
