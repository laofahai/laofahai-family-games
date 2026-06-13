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
