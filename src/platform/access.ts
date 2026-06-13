// 设备解锁状态：一次性「识别码解锁这台设备」，之后本设备直接进、随便玩。
// 仅当配置了云端时才设门；未配置（纯本地）则永远视为已解锁，零门槛。

import { cloudAvailable, redeemLogin } from './cloud'

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

/** 登录成功时若是「个人码」，带回这个人是谁（用于自动选中 TA + 绑定个人码同步）。 */
export interface UnlockResult {
  ok: boolean
  person?: { name: string; emoji: string | null; code: string }
}

export async function tryUnlock(code: string): Promise<UnlockResult> {
  const trimmed = code.trim()
  const r = await redeemLogin(trimmed)
  if (!r.valid) return { ok: false }
  save({ code: trimmed, isAdmin: r.isAdmin })
  if (r.isPerson && r.name) {
    return { ok: true, person: { name: r.name, emoji: r.emoji, code: trimmed } }
  }
  return { ok: true }
}

export function lock(): void {
  save(null)
}
