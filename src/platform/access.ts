// 设备解锁状态：一次性「码解锁这台设备」，之后本设备直接进。
// 仅当配置了云端时才设门；未配置（纯本地）则永远视为已解锁，零门槛。
//
// 登录分三种：
//  · 个人码（家人）：输码即认出是谁，解锁 + 带回身份。
//  · 管理码：先输码 → 再输「管理员名字」二次校验（防撞库），都对才解锁为管理员。
//  · 普通访问码：输码解锁，但不是谁、也不是管理员。
// 另外记一份「本机登录过谁」(deviceLogins)：身份切换只在登录过的人之间，切新人要输 TA 的码。

import { adminLogin, cloudAvailable, redeemLogin } from './cloud'

const KEY = 'fg:unlock'
const LOGINS_KEY = 'fg:deviceLogins'

interface UnlockState {
  code: string
  isAdmin: boolean
  adminName?: string
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

/** 管理员显示名（如「老法海」），仅管理员设备有 */
export function adminName(): string | null {
  const u = load()
  return u?.isAdmin ? (u.adminName ?? null) : null
}

// ── 本机登录过谁：身份切换只在这些人之间，切新人要输码 ──────────────────
function loadLogins(): string[] {
  try {
    const raw = localStorage.getItem(LOGINS_KEY)
    const arr = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function getDeviceLogins(): string[] {
  return loadLogins()
}

export function addDeviceLogin(playerId: string): void {
  const arr = loadLogins()
  if (!arr.includes(playerId)) {
    arr.push(playerId)
    try {
      localStorage.setItem(LOGINS_KEY, JSON.stringify(arr))
    } catch {
      /* 忽略 */
    }
  }
}

/** 登录结果：个人码带回是谁；管理码先返回 needAdminName，等再输名字。 */
export interface UnlockResult {
  ok: boolean
  needAdminName?: boolean
  person?: { name: string; emoji: string | null; code: string }
}

/** 第一步：校验码。管理码不直接放行，返回 needAdminName 让上层再要名字。 */
export async function tryUnlock(code: string): Promise<UnlockResult> {
  const trimmed = code.trim()
  const r = await redeemLogin(trimmed)
  if (!r.valid) return { ok: false }
  if (r.isPerson && r.name) {
    // 个人码优先：如果这个个人码同时是管理员码，直接以本人身份进入并保留管理权限。
    save({ code: trimmed, isAdmin: r.isAdmin, adminName: r.isAdmin ? r.name : undefined })
    return { ok: true, person: { name: r.name, emoji: r.emoji, code: trimmed } }
  }
  if (r.isAdmin) return { ok: false, needAdminName: true } // 纯管理码：还没解锁，等名字
  // 普通访问码：直接解锁
  save({ code: trimmed, isAdmin: false })
  return { ok: true }
}

/** 第二步（仅管理码）：用名字 + 码二次校验，过了才解锁为管理员。 */
export async function tryAdminLogin(code: string, name: string): Promise<UnlockResult> {
  const c = code.trim()
  const n = name.trim()
  if (!n) return { ok: false }
  const ok = await adminLogin(c, n)
  if (!ok) return { ok: false } // 不提示是码错还是名错
  save({ code: c, isAdmin: true, adminName: n })
  return { ok: true }
}

export function lock(): void {
  save(null)
}
