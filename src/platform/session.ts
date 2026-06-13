// 本局名单：这一局有谁坐在桌上（有序）。供"传手机"类多人游戏取真名做提示。
// 跨游戏记住上次选的人，默认全家。纯本地。

import { getPlayers, type Player } from './players'

const KEY = 'fg:roster'

function loadIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function saveIds(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    /* 忽略 */
  }
}

/** 本局玩家（有序）。没存过就默认全家成员。 */
export function getRoster(): Player[] {
  const all = getPlayers()
  const chosen = loadIds()
    .map((id) => all.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))
  return chosen.length ? chosen : all.filter((p) => p.kind === 'family')
}

export function getRosterIds(): string[] {
  return getRoster().map((p) => p.id)
}

export function setRoster(ids: string[]): void {
  saveIds(ids)
}
