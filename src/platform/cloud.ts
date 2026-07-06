// 云端 API 客户端：全部走 PocketBase custom routes。
// env 未配置时所有调用安全降级，App 退回纯本地模式。

import { fgPost, pocketBaseAvailable } from './pocketbase'

export interface CodeRow {
  code: string
  is_admin: boolean
  label: string | null
  revoked: boolean
  created_at: string
}

export function cloudAvailable(): boolean {
  return pocketBaseAvailable()
}

export async function redeemCode(code: string): Promise<{ valid: boolean; isAdmin: boolean }> {
  const row = await fgPost<{ valid: boolean; is_admin: boolean }>('/redeem-code', { code })
  if (!row) return { valid: false, isAdmin: false }
  return { valid: Boolean(row.valid), isAdmin: Boolean(row.is_admin) }
}

export interface LoginResult {
  valid: boolean
  isAdmin: boolean
  isPerson: boolean
  name: string | null
  emoji: string | null
}

export async function redeemLogin(code: string): Promise<LoginResult> {
  const miss: LoginResult = { valid: false, isAdmin: false, isPerson: false, name: null, emoji: null }
  const row = await fgPost<{ valid: boolean; is_admin: boolean; is_person: boolean; name: string | null; emoji: string | null }>(
    '/redeem-login',
    { code }
  )
  if (!row) return miss
  return {
    valid: Boolean(row.valid),
    isAdmin: Boolean(row.is_admin),
    isPerson: Boolean(row.is_person),
    name: row.name ?? null,
    emoji: row.emoji ?? null,
  }
}

export async function adminLogin(code: string, name: string): Promise<boolean> {
  const data = await fgPost<{ ok: boolean }>('/admin-login', { code, name })
  return data?.ok === true
}

export async function mintCode(
  adminCode: string,
  newCode: string,
  label: string,
  isAdmin = false
): Promise<boolean> {
  const data = await fgPost<{ ok: boolean }>('/mint-code', {
    adminCode,
    newCode,
    label,
    isAdmin,
  })
  return data?.ok === true
}

export async function listCodes(adminCode: string): Promise<CodeRow[]> {
  const data = await fgPost<{ codes: CodeRow[] }>('/list-codes', { adminCode })
  return Array.isArray(data?.codes) ? data.codes : []
}

export async function setCodeRevoked(adminCode: string, code: string, revoked: boolean): Promise<boolean> {
  const data = await fgPost<{ ok: boolean }>('/set-code-revoked', { adminCode, code, revoked })
  return data?.ok === true
}

export interface ProfileRow {
  id: string
  name: string
  emoji: string | null
  kind: string
  sync_code: string | null
  created_at: string
}

export async function adminListProfiles(adminCode: string): Promise<ProfileRow[]> {
  const data = await fgPost<{ profiles: ProfileRow[] }>('/admin-list-profiles', { adminCode })
  return Array.isArray(data?.profiles) ? data.profiles : []
}

export async function adminCreateProfile(
  adminCode: string,
  name: string,
  newCode: string,
  emoji = '🙂'
): Promise<ProfileRow | null> {
  const data = await fgPost<{ ok: boolean; profile: ProfileRow | null }>('/admin-create-profile', {
    adminCode,
    name,
    newCode,
    emoji,
  })
  return data?.ok === true ? data.profile : null
}

export async function adminResetProfileCode(
  adminCode: string,
  id: string,
  newCode: string
): Promise<boolean> {
  const data = await fgPost<{ ok: boolean }>('/admin-reset-profile-code', { adminCode, id, newCode })
  return data?.ok === true
}

export async function adminDeleteProfile(adminCode: string, id: string): Promise<boolean> {
  const data = await fgPost<{ ok: boolean }>('/admin-delete-profile', { adminCode, id })
  return data?.ok === true
}

export async function claimProfile(
  syncCode: string,
  name: string,
  emoji: string,
  kind: string
): Promise<string | null> {
  const data = await fgPost<{ id: string | null }>('/claim-profile', { code: syncCode, name, emoji, kind })
  return data?.id ?? null
}

export async function pullSeen(syncCode: string): Promise<Record<string, string[]>> {
  const data = await fgPost<{ seen: { scope: string; item_ids: string[] }[] }>('/pull-seen', { code: syncCode })
  const out: Record<string, string[]> = {}
  for (const row of data?.seen ?? []) {
    if (typeof row.scope === 'string' && Array.isArray(row.item_ids)) out[row.scope] = row.item_ids
  }
  return out
}

export async function pushSeen(syncCode: string, scope: string, itemIds: string[]): Promise<void> {
  await fgPost('/push-seen', { code: syncCode, scope, itemIds })
}

export async function pullLearn(code: string): Promise<Record<string, unknown>> {
  const data = await fgPost<{ learn: { game: string; data: unknown }[] }>('/pull-learn', { code })
  const out: Record<string, unknown> = {}
  for (const row of data?.learn ?? []) {
    if (typeof row.game === 'string') out[row.game] = row.data
  }
  return out
}

export async function pushLearn(code: string, game: string, data: unknown): Promise<void> {
  await fgPost('/push-learn', { code, game, data })
}

export interface RoomMemberPublic {
  name: string
  emoji: string
  seat: number
  is_host: boolean
  online?: boolean
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
  const data = await fgPost<{ ok: boolean }>('/create-room', { code, hostToken, game, name, emoji })
  return data?.ok === true
}

export async function joinRoomRpc(code: string, token: string, name: string, emoji: string): Promise<number> {
  const data = await fgPost<{ seat: number }>('/join-room', { code, token, name, emoji })
  return typeof data?.seat === 'number' ? data.seat : -3
}

export async function hostSetRpc(
  code: string,
  hostToken: string,
  state: string | null,
  payload: Record<string, unknown> | null,
  secrets: Record<string, unknown> | null
): Promise<boolean> {
  const data = await fgPost<{ ok: boolean }>('/host-set', { code, hostToken, state, payload, secrets })
  return data?.ok === true
}

export async function roomSnapshotRpc(code: string, token: string): Promise<RoomSnapshot | null> {
  return fgPost<RoomSnapshot>('/room-snapshot', { code, token })
}

export async function leaveRoomRpc(code: string, token: string): Promise<void> {
  await fgPost('/leave-room', { code, token })
}

export async function memberSubmitRpc(code: string, token: string, data: unknown): Promise<boolean> {
  const result = await fgPost<{ ok: boolean }>('/member-submit', { code, token, data })
  return result?.ok === true
}

export async function collectSubmissionsRpc(code: string, hostToken: string): Promise<CollectedSubmission[]> {
  const data = await fgPost<{ submissions: CollectedSubmission[] }>('/collect-submissions', { code, hostToken })
  return Array.isArray(data?.submissions) ? data.submissions : []
}

export async function clearSubmissionsRpc(code: string, hostToken: string): Promise<boolean> {
  const data = await fgPost<{ ok: boolean }>('/clear-submissions', { code, hostToken })
  return data?.ok === true
}

export interface LiveKitJoinInfo {
  ok: boolean
  url: string | null
  token: string | null
  room: string | null
  identity: string | null
}

export async function liveKitTokenRpc(
  code: string,
  token: string,
  purpose: 'audio' | 'charades' = 'audio'
): Promise<LiveKitJoinInfo | null> {
  return fgPost<LiveKitJoinInfo>('/livekit-token', { code, token, purpose })
}

export interface PresenceUser {
  peer_id: string
  name: string
  emoji: string
  player_id: string
  room_code: string
  updated_at: string
  expires_at: string
  expires_ms?: number
}

export async function presencePingRpc(args: {
  token: string
  name: string
  emoji: string
  playerId: string
  roomCode?: string | null
  ttlSeconds?: number
}): Promise<boolean> {
  const data = await fgPost<{ ok: boolean }>('/presence-ping', args)
  return data?.ok === true
}

export async function presenceListRpc(): Promise<PresenceUser[]> {
  const data = await fgPost<{ users: PresenceUser[] }>('/presence-list', {})
  return Array.isArray(data?.users) ? data.users : []
}
