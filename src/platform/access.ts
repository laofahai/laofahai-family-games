// 设备解锁状态：一次性「识别码解锁这台设备」，之后本设备直接进、随便玩。
// 仅当配置了云端时才设门；未配置（纯本地）则永远视为已解锁，零门槛。

import { cloudAvailable, redeemCode } from './cloud'

const KEY = 'fg:unlock'

interface UnlockState {
  code: string
  isAdmin: boolean
}

function load(): UnlockState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as UnlockState) : null
  } catch {
    return null
  }
}

function save(state: UnlockState | null): void {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state))
    else localStorage.removeItem(KEY)
  } catch {
    /* 忽略 */
  }
}

/** 是否设了门：只有配置了云端才需要解锁 */
export function gateActive(): boolean {
  return cloudAvailable()
}

/** 这台设备是否可进入 */
export function isUnlocked(): boolean {
  return !cloudAvailable() || load() !== null
}

export function isAdmin(): boolean {
  return load()?.isAdmin ?? false
}

/** 管理员码（仅管理员设备有），用于调管理类 RPC */
export function adminCode(): string | null {
  const u = load()
  return u?.isAdmin ? u.code : null
}

export async function tryUnlock(code: string): Promise<boolean> {
  const trimmed = code.trim()
  const r = await redeemCode(trimmed)
  if (!r.valid) return false
  save({ code: trimmed, isAdmin: r.isAdmin })
  return true
}

export function lock(): void {
  save(null)
}
