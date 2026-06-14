// 多人共斗房间钩子：管理 Supabase Realtime 频道生命周期、玩家名单、心跳与重连同步。
// 「连接 + 名单 + 收发」在这里；「共享 Boss 血量 / 推进」的业务编排在 PlayingView 里（host 权威）。
//
// 设计：第一个建房的人是 host，持有玩家名单真源。guest 进房 send hello，host 收 hello 入册并把
// 名单回广播。心跳：guest 每 3s 重发 hello；host 据时间戳剔除掉线者。频道实例放进 state，
// 就绪后触发重渲染，PlayingView 才能拿到它去注册 host 命中回调 / 发广播。
//
// ESLint 合规：所有 setState 都在「频道消息回调 / setInterval 回调 / 用户事件」里（允许），
// effect 体内不同步 setState 业务（频道是在用户点「建房/进房」时才建，不在挂载 effect 里）。

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  joinCoopChannel,
  makeRoomCode,
  type CoopChannel,
  type CoopPlayer,
  type CoopShared,
} from '@/games/_battle/coop'
import type { Band } from '@/games/_battle/core'

const HEARTBEAT_MS = 3000
const STALE_MS = 9000 // 超过这么久没心跳视为掉线（host 剔除）

export interface CoopMe {
  id: string
  name: string
  emoji: string
  band: Band
  heroMaxHp: number
}

/** PlayingView 注册的业务回调（host 用 onHit 扣共享血；guest 用 onShared 对齐）。 */
export interface CoopSinks {
  onHit?: (hit: { byId: string; byName: string; damage: number; crit: boolean }) => void
  onShared?: (shared: CoopShared) => void
}

export interface UseCoopRoom {
  channel: CoopChannel | null // 当前频道（state，就绪后触发重渲染）
  code: string | null
  isHost: boolean
  players: CoopPlayer[]
  host: (me: CoopMe) => void
  join: (joinCode: string, me: CoopMe) => void
  leave: () => void
  setSinks: (sinks: CoopSinks) => void
  reportHp: (heroHp: number, down: boolean) => void
  /** host：把当前在线玩家名单读出来（用于算共享血上限）。 */
  playerCount: () => number
}

export function useCoopRoom(): UseCoopRoom {
  const [channel, setChannel] = useState<CoopChannel | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [players, setPlayers] = useState<CoopPlayer[]>([])

  const meRef = useRef<CoopMe | null>(null)
  const isHostRef = useRef(false)
  const lastSeenRef = useRef<Map<string, number>>(new Map())
  const rosterRef = useRef<Map<string, CoopPlayer>>(new Map())
  const sinksRef = useRef<CoopSinks>({})
  const chanRef = useRef<CoopChannel | null>(null)

  const flushPlayers = useCallback(() => {
    setPlayers(Array.from(rosterRef.current.values()))
  }, [])

  const host = useCallback(
    (me: CoopMe) => {
      const c = makeRoomCode()
      meRef.current = me
      isHostRef.current = true
      rosterRef.current = new Map()
      lastSeenRef.current = new Map()
      rosterRef.current.set(me.id, {
        id: me.id, name: me.name, emoji: me.emoji, band: me.band,
        heroHp: me.heroMaxHp, heroMaxHp: me.heroMaxHp, isHost: true, down: false,
      })
      lastSeenRef.current.set(me.id, Date.now())

      const ch = joinCoopChannel(c, true, {
        onHello: (p) => {
          const existed = rosterRef.current.has(p.id)
          rosterRef.current.set(p.id, { ...p, isHost: false })
          lastSeenRef.current.set(p.id, Date.now())
          flushPlayers()
          if (!existed) {
            // 新人：把名单回广播一遍，让大家（含新人）对齐
            ch.broadcastShared(lobbyShared(c, me.id, listOf(rosterRef.current)))
          }
        },
        onBye: (id) => {
          rosterRef.current.delete(id)
          lastSeenRef.current.delete(id)
          flushPlayers()
        },
        onHit: (hit) => {
          lastSeenRef.current.set(hit.byId, Date.now())
          sinksRef.current.onHit?.(hit)
        },
        onHp: (hp) => {
          const ex = rosterRef.current.get(hp.id)
          if (ex) rosterRef.current.set(hp.id, { ...ex, heroHp: hp.heroHp, down: hp.down })
          lastSeenRef.current.set(hp.id, Date.now())
          flushPlayers()
        },
        onSyncRequest: () => {
          ch.broadcastShared(lobbyShared(c, me.id, listOf(rosterRef.current)))
        },
      })
      chanRef.current = ch
      setChannel(ch)
      setCode(c)
      setIsHost(true)
      flushPlayers()
    },
    [flushPlayers]
  )

  const join = useCallback((joinCode: string, me: CoopMe) => {
    meRef.current = me
    isHostRef.current = false
    const ch = joinCoopChannel(joinCode, false, {
      onShared: (shared) => {
        setPlayers(shared.players)
        sinksRef.current.onShared?.(shared)
      },
    })
    chanRef.current = ch
    setChannel(ch)
    setCode(joinCode)
    setIsHost(false)
    ch.hello({
      id: me.id, name: me.name, emoji: me.emoji, band: me.band,
      heroHp: me.heroMaxHp, heroMaxHp: me.heroMaxHp, down: false,
    })
    ch.requestSync()
  }, [])

  const leave = useCallback(() => {
    chanRef.current?.leave()
    chanRef.current = null
    rosterRef.current = new Map()
    lastSeenRef.current = new Map()
    setChannel(null)
    setCode(null)
    setIsHost(false)
    setPlayers([])
    isHostRef.current = false
  }, [])

  const reportHp = useCallback((heroHp: number, down: boolean) => {
    const me = meRef.current
    const ch = chanRef.current
    if (!me || !ch) return
    if (isHostRef.current) {
      const ex = rosterRef.current.get(me.id)
      if (ex) {
        rosterRef.current.set(me.id, { ...ex, heroHp, down })
        flushPlayers()
      }
    } else {
      ch.sendHp({ id: me.id, heroHp, down })
    }
  }, [flushPlayers])

  const setSinks = useCallback((sinks: CoopSinks) => {
    sinksRef.current = sinks
  }, [])

  const playerCount = useCallback(() => Math.max(1, rosterRef.current.size), [])

  // 心跳
  useEffect(() => {
    if (!code) return
    const id = window.setInterval(() => {
      const me = meRef.current
      const ch = chanRef.current
      if (!me || !ch) return
      if (isHostRef.current) {
        const now = Date.now()
        let changed = false
        for (const [pid, seen] of lastSeenRef.current) {
          if (pid !== me.id && now - seen > STALE_MS) {
            lastSeenRef.current.delete(pid)
            rosterRef.current.delete(pid)
            changed = true
          }
        }
        if (changed) flushPlayers()
      } else {
        ch.hello({
          id: me.id, name: me.name, emoji: me.emoji, band: me.band,
          heroHp: me.heroMaxHp, heroMaxHp: me.heroMaxHp, down: false,
        })
      }
    }, HEARTBEAT_MS)
    return () => window.clearInterval(id)
  }, [code, flushPlayers])

  // 卸载清理
  useEffect(() => () => {
    chanRef.current?.leave()
    chanRef.current = null
  }, [])

  return { channel, code, isHost, players, host, join, leave, setSinks, reportHp, playerCount }
}

function listOf(m: Map<string, CoopPlayer>): CoopPlayer[] {
  return Array.from(m.values())
}

function lobbyShared(code: string, hostId: string, players: CoopPlayer[]): CoopShared {
  return {
    rev: Date.now(), code, hostId,
    levelIndex: 0, stepIndex: 0,
    bossId: 'lobby', bossName: '', bossEmoji: '🙂', bossHp: 0, bossMaxHp: 0,
    phase: 'lobby', players,
  }
}
