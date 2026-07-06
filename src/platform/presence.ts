import { useEffect, useState } from 'react'

import { pocketBaseClient } from './pocketbase'
import { presenceListRpc, presencePingRpc, type PresenceUser } from './cloud'
import { deviceToken } from './rooms'

const HEARTBEAT_MS = 12_000
const TTL_SECONDS = 45

export type { PresenceUser }

function activeUsers(users: PresenceUser[]): PresenceUser[] {
  const now = Date.now()
  return users
    .filter((user) => {
      const expires = user.expires_ms || dateMs(user.expires_at)
      return Number.isFinite(expires) && expires > now
    })
    .sort((a, b) => dateMs(b.updated_at) - dateMs(a.updated_at))
}

function dateMs(value: string): number {
  const ms = Date.parse(value.replace(' ', 'T'))
  return Number.isFinite(ms) ? ms : 0
}

export function usePresence(args: {
  enabled: boolean
  playerId: string
  name: string
  emoji: string
  roomCode?: string | null
}): PresenceUser[] {
  const [users, setUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!args.enabled) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let unsubscribe: (() => void) | undefined

    const refresh = async () => {
      const next = await presenceListRpc()
      if (alive) setUsers(activeUsers(next))
    }

    const ping = async () => {
      await presencePingRpc({
        token: deviceToken(),
        name: args.name || '玩家',
        emoji: args.emoji || '🙂',
        playerId: args.playerId,
        roomCode: args.roomCode || '',
        ttlSeconds: TTL_SECONDS,
      })
      await refresh()
      if (alive) timer = setTimeout(ping, HEARTBEAT_MS)
    }

    const subscribe = async () => {
      try {
        const collection = pocketBaseClient()?.collection?.('rt_presence')
        if (!collection) return
        const off = await collection.subscribe(
          '*',
          () => {
            void refresh()
          },
          { filter: 'kind="user" && room="global"' }
        )
        unsubscribe = typeof off === 'function' ? off : undefined
      } catch {
        /* 订阅失败时保留心跳后的列表刷新。 */
      }
    }

    void subscribe()
    void ping()

    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      if (unsubscribe) unsubscribe()
    }
  }, [args.enabled, args.emoji, args.name, args.playerId, args.roomCode])

  return users
}
