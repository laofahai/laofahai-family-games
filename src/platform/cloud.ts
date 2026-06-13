// 云端 API 客户端：全部走 Supabase RPC（凭码读写，公钥不能直读表）。
// env 未配置时所有调用安全降级（valid:false / 空 / 静默），App 退回纯本地模式。

import { supabase } from './supabase'

export interface CodeRow {
  code: string
  is_admin: boolean
  label: string | null
  revoked: boolean
  created_at: string
}

export function cloudAvailable(): boolean {
  return supabase !== null
}

// ── 访问码 / 管理员 ──────────────────────────────────────────────
export async function redeemCode(code: string): Promise<{ valid: boolean; isAdmin: boolean }> {
  if (!supabase) return { valid: false, isAdmin: false }
  const { data, error } = await supabase.rpc('redeem_code', { p_code: code })
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row) return { valid: false, isAdmin: false }
  return { valid: Boolean(row.valid), isAdmin: Boolean(row.is_admin) }
}

export async function mintCode(
  adminCode: string,
  newCode: string,
  label: string,
  isAdmin = false
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('mint_code', {
    p_admin_code: adminCode,
    p_new_code: newCode,
    p_label: label,
    p_is_admin: isAdmin,
  })
  return !error
}

export async function listCodes(adminCode: string): Promise<CodeRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('list_codes', { p_admin_code: adminCode })
  if (error || !Array.isArray(data)) return []
  return data as CodeRow[]
}

export async function setCodeRevoked(adminCode: string, code: string, revoked: boolean): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('set_code_revoked', {
    p_admin_code: adminCode,
    p_code: code,
    p_revoked: revoked,
  })
  return !error
}

// ── 个人同步（进度跨设备）──────────────────────────────────────────
export async function claimProfile(
  syncCode: string,
  name: string,
  emoji: string,
  kind: string
): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('claim_profile', {
    p_code: syncCode,
    p_name: name,
    p_emoji: emoji,
    p_kind: kind,
  })
  if (error) return null
  return (data as string) ?? null
}

export async function pullSeen(syncCode: string): Promise<Record<string, string[]>> {
  if (!supabase) return {}
  const { data, error } = await supabase.rpc('pull_seen', { p_code: syncCode })
  if (error || !Array.isArray(data)) return {}
  const out: Record<string, string[]> = {}
  for (const row of data as { scope: string; item_ids: string[] }[]) {
    out[row.scope] = Array.isArray(row.item_ids) ? row.item_ids : []
  }
  return out
}

export async function pushSeen(syncCode: string, scope: string, itemIds: string[]): Promise<void> {
  if (!supabase) return
  await supabase.rpc('push_seen', { p_code: syncCode, p_scope: scope, p_item_ids: itemIds })
}

// ── 远程协作房间（各自设备看各自的秘密）─────────────────────────────────
export interface RoomMemberPublic {
  name: string
  emoji: string
  seat: number
  is_host: boolean
}
export interface RoomSnapshot {
  state: string
  game: string
  payload: Record<string, unknown>
  you: { name: string; emoji: string; seat: number; is_host: boolean; secret: unknown; submission: unknown } | null
  members: RoomMemberPublic[]
  submittedCount: number
  updated_at: string
}

export interface CollectedSubmission {
  seat: number
  name: string
  emoji: string
  submission: unknown
}

export async function createRoomRpc(
  code: string,
  hostToken: string,
  game: string,
  name: string,
  emoji: string
): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('create_room', {
    p_code: code,
    p_host_token: hostToken,
    p_game: game,
    p_name: name,
    p_emoji: emoji,
  })
  return !error && data === true
}

/** 返回座位号；-1 房不存在 / -2 已开局谢绝新人 / -3 网络或未配置 */
export async function joinRoomRpc(code: string, token: string, name: string, emoji: string): Promise<number> {
  if (!supabase) return -3
  const { data, error } = await supabase.rpc('join_room', {
    p_code: code,
    p_token: token,
    p_name: name,
    p_emoji: emoji,
  })
  if (error) return -3
  return typeof data === 'number' ? data : -3
}

export async function hostSetRpc(
  code: string,
  hostToken: string,
  state: string | null,
  payload: Record<string, unknown> | null,
  secrets: Record<string, unknown> | null
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('host_set', {
    p_code: code,
    p_host_token: hostToken,
    p_state: state,
    p_payload: payload,
    p_secrets: secrets,
  })
  return !error
}

export async function roomSnapshotRpc(code: string, token: string): Promise<RoomSnapshot | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('room_snapshot', { p_code: code, p_token: token })
  if (error || !data) return null
  return data as RoomSnapshot
}

export async function leaveRoomRpc(code: string, token: string): Promise<void> {
  if (!supabase) return
  await supabase.rpc('leave_room', { p_code: code, p_token: token })
}

/** 成员写自己的私密提交（猜的价格、投票等）。 */
export async function memberSubmitRpc(code: string, token: string, data: unknown): Promise<boolean> {
  if (!supabase) return false
  const { data: ok, error } = await supabase.rpc('member_submit', { p_code: code, p_token: token, p_data: data })
  return !error && ok === true
}

/** 房主汇总所有人的提交（公布时算结果用）。 */
export async function collectSubmissionsRpc(code: string, hostToken: string): Promise<CollectedSubmission[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('collect_submissions', { p_code: code, p_host_token: hostToken })
  if (error || !Array.isArray(data)) return []
  return data as CollectedSubmission[]
}

/** 房主清空所有人提交（开新一轮前）。 */
export async function clearSubmissionsRpc(code: string, hostToken: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('clear_submissions', { p_code: code, p_host_token: hostToken })
  return !error
}
