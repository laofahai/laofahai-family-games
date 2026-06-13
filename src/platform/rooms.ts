// 远程协作房间：客户端编排层。封装设备令牌、房号生成、轮询订阅。
// 一台设备一个固定令牌（标识“我是这个参与者”），房号是可分享的短数字。
// 同步靠轮询快照（家庭小局足够稳，免去 Realtime 配置）；之后要更跟手可换 Realtime。

import {
  clearSubmissionsRpc,
  cloudAvailable,
  collectSubmissionsRpc,
  createRoomRpc,
  hostSetRpc,
  joinRoomRpc,
  leaveRoomRpc,
  memberSubmitRpc,
  roomSnapshotRpc,
  type RoomSnapshot,
} from './cloud'

export type { RoomSnapshot, RoomMemberPublic, CollectedSubmission } from './cloud'

const TOKEN_KEY = 'fg:roomtoken'

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** 本设备固定令牌（私密，不外传）。第一次用时生成并存住。 */
export function deviceToken(): string {
  let t = safeGet(TOKEN_KEY)
  if (t) return t
  try {
    t = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `t_${Date.now().toString(36)}`
  } catch {
    t = `t_${Date.now().toString(36)}`
  }
  try {
    localStorage.setItem(TOKEN_KEY, t)
  } catch {
    /* 隐私模式：本会话内用内存值也行，但至少这一局稳定 */
  }
  return t
}

export function roomsAvailable(): boolean {
  return cloudAvailable()
}

function numericRoomCode(): string {
  return String(1000 + Math.floor(Math.random() * 9000)) // 4 位
}

/** 建房，自动避开撞号。返回房号；失败返回 null。 */
export async function createRoom(game: string, name: string, emoji: string): Promise<string | null> {
  const token = deviceToken()
  for (let i = 0; i < 6; i++) {
    const code = numericRoomCode()
    if (await createRoomRpc(code, token, game, name, emoji)) return code
  }
  return null
}

/** 加入房间。返回座位号；-1 房不存在 / -2 已开局 / -3 网络。 */
export async function joinRoom(code: string, name: string, emoji: string): Promise<number> {
  return joinRoomRpc(code, deviceToken(), name, emoji)
}

/** 房主：改状态 + 公共 payload + 给每人下发私密 secret（{ token: secret }）。 */
export async function hostSet(
  code: string,
  opts: { state?: string; payload?: Record<string, unknown>; secrets?: Record<string, unknown> }
): Promise<boolean> {
  return hostSetRpc(code, deviceToken(), opts.state ?? null, opts.payload ?? null, opts.secrets ?? null)
}

export async function snapshot(code: string): Promise<RoomSnapshot | null> {
  return roomSnapshotRpc(code, deviceToken())
}

export async function leaveRoom(code: string): Promise<void> {
  return leaveRoomRpc(code, deviceToken())
}

/** 成员写自己的私密提交（每个玩家自己出价/投票）。 */
export async function memberSubmit(code: string, data: unknown): Promise<boolean> {
  return memberSubmitRpc(code, deviceToken(), data)
}

/** 房主汇总所有人的提交（公布算分）。 */
export async function collectSubmissions(code: string) {
  return collectSubmissionsRpc(code, deviceToken())
}

/** 房主清空提交（开新一轮前）。 */
export async function clearSubmissions(code: string): Promise<boolean> {
  return clearSubmissionsRpc(code, deviceToken())
}

/**
 * 订阅房间：定时拉快照，内容有变化才回调。返回取消函数。
 * 比对整个快照（成员加入不会动 rooms.updated_at，所以不能只看时间戳）。
 */
export function subscribeRoom(
  code: string,
  onChange: (snap: RoomSnapshot) => void,
  intervalMs = 1500
): () => void {
  let alive = true
  let last = ''
  let timer: ReturnType<typeof setTimeout> | undefined

  const tick = async () => {
    if (!alive) return
    const snap = await snapshot(code)
    if (alive && snap) {
      const sig = JSON.stringify(snap)
      if (sig !== last) {
        last = sig
        onChange(snap)
      }
    }
    if (alive) timer = setTimeout(tick, intervalMs)
  }
  void tick()

  return () => {
    alive = false
    if (timer) clearTimeout(timer)
  }
}
