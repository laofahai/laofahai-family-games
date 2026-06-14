// 进度持久化：把「已闯到第几关」存 localStorage（key: fg:battle:${player}:level）。

export function saveKey(player: string) {
  return `fg:battle:${player}:level`
}

/** 读「已闯到第几关」(0-based 已通过的关数；null=无存档)。 */
export function loadSavedLevel(player: string): number | null {
  try {
    const raw = localStorage.getItem(saveKey(player))
    if (raw == null) return null
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : null
  } catch {
    return null
  }
}

export function saveLevel(player: string, level: number) {
  try {
    localStorage.setItem(saveKey(player), String(level))
  } catch {
    /* ignore */
  }
}
