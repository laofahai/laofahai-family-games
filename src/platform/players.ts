// 玩家档案：谁在玩。默认是家庭成员，可随时添加朋友/其他人一起参与。
// 每个玩家有独立 id，进度/已见库据此分开记录。
// Phase 0 存 localStorage；Phase 2 接 Supabase 时把自定义玩家同步到 players 表即可。

import { FAMILY } from './people'

export type PlayerKind = 'family' | 'guest'

export interface Player {
  id: string
  name: string
  emoji: string
  kind: PlayerKind
}

const CUSTOM_KEY = 'fg:players'

const FAMILY_PLAYERS: Player[] = FAMILY.map((p) => ({
  id: p.id,
  name: p.name,
  emoji: p.emoji ?? '🙂',
  kind: 'family',
}))

const EMOJIS = ['😀', '😎', '🦊', '🐼', '🐯', '🦄', '🐸', '🐙', '🌟', '🎈', '🍡', '🚀', '🐱', '🐶', '🦉', '🐳']

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

/** 自定义加进来的玩家（朋友/其他人） */
export function getCustomPlayers(): Player[] {
  const raw = safeGet(CUSTOM_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as Player[]
  } catch {
    return []
  }
}

/** 全部玩家：家庭成员 + 自定义加入的人 */
export function getPlayers(): Player[] {
  return [...FAMILY_PLAYERS, ...getCustomPlayers()]
}

function makeId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `p_${crypto.randomUUID().slice(0, 8)}`
  } catch {
    /* 退化到时间戳 */
  }
  return `p_${Date.now().toString(36)}`
}

/** 添加一个新玩家（朋友/其他人），返回新建的玩家 */
export function addPlayer(name: string): Player {
  const custom = getCustomPlayers()
  const player: Player = {
    id: makeId(),
    name: name.trim() || '新朋友',
    emoji: EMOJIS[custom.length % EMOJIS.length],
    kind: 'guest',
  }
  safeSet(CUSTOM_KEY, JSON.stringify([...custom, player]))
  return player
}

/** 移除一个自定义玩家（家庭成员不可移除） */
export function removePlayer(id: string): void {
  safeSet(CUSTOM_KEY, JSON.stringify(getCustomPlayers().filter((p) => p.id !== id)))
}

export function playerName(id: string): string {
  return getPlayers().find((p) => p.id === id)?.name ?? '访客'
}
