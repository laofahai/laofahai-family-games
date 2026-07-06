import { useEffect, useMemo, useRef, useState } from 'react'
import { Crown, DoorOpen, Gamepad2, LogOut, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ACTIVE_GAME_IDS, GAMES, type GameMeta } from './catalog'
import { getCurrentPlayer } from './progress'
import { getPlayers } from './players'
import { RoomAudioPanel } from './RoomAudioPanel'
import { RoomCode } from './RoomCode'
import { PresenceStrip } from './PresenceStrip'
import type { PresenceUser } from './presence'
import { createRoom, hostSet, joinRoom, leaveRoom, subscribeRoom, type RoomSnapshot } from './rooms'

interface PartyRoomProps {
  initialGame?: string | null
  presenceUsers: PresenceUser[]
  onReady: (code: string) => void
  onLeave: () => void
  onLaunch: (gameId: string) => void
}

export function PartyRoom({ initialGame, presenceUsers, onReady, onLeave, onLaunch }: PartyRoomProps) {
  const me = useMemo(() => getPlayers().find((p) => p.id === getCurrentPlayer()), [])
  const [name, setName] = useState(me?.name ?? '')
  const emoji = me?.emoji ?? '🙂'
  const [code, setCode] = useState<string | null>(null)
  const [snap, setSnap] = useState<RoomSnapshot | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const lastLaunchRef = useRef('')
  const initialGameSentRef = useRef('')

  const isHost = snap?.you?.is_host ?? false
  const members = snap?.members ?? []
  const partyGames = GAMES.filter((game) => ACTIVE_GAME_IDS.has(game.id) && game.supportsRoom)

  useEffect(() => {
    if (!code) return
    onReady(code)
    const unsub = subscribeRoom(code, setSnap)
    return unsub
  }, [code, onReady])

  useEffect(() => {
    if (!code || !snap) return
    const payload = snap.payload as { selectedGame?: string; selectedAt?: number }
    const selectedGame = payload.selectedGame
    if (!selectedGame) return
    const sig = `${selectedGame}:${payload.selectedAt ?? ''}`
    if (sig === lastLaunchRef.current) return
    lastLaunchRef.current = sig
    onLaunch(selectedGame)
  }, [code, onLaunch, snap])

  useEffect(() => {
    if (!code || !snap || !initialGame || !isHost) return
    if (initialGameSentRef.current === `${code}:${initialGame}`) return
    initialGameSentRef.current = `${code}:${initialGame}`
    void chooseGame(initialGame)
    // initialGame should fire once after the host room exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, snap, isHost, initialGame])

  const create = async () => {
    setBusy(true)
    setErr('')
    const c = await createRoom('party', name.trim() || '房主', emoji)
    setBusy(false)
    if (c) setCode(c)
    else setErr('建房失败，再试一次')
  }

  const join = async () => {
    const c = joinCode.replace(/\D/g, '')
    if (c.length < 3) {
      setErr('房号至少 3 位')
      return
    }
    setBusy(true)
    setErr('')
    const seat = await joinRoom(c, name.trim() || '玩家', emoji)
    setBusy(false)
    if (seat > 0) setCode(c)
    else setErr(seat === -1 ? '没找到这个房间' : '连不上，检查下网络')
  }

  const chooseGame = async (gameId: string) => {
    if (!code || !isHost) return
    setBusy(true)
    setErr('')
    const ok = await hostSet(code, {
      state: 'lobby',
      payload: { selectedGame: gameId, selectedAt: Date.now() },
    })
    setBusy(false)
    if (!ok) setErr('切换游戏失败，请重试')
  }

  const doLeave = async () => {
    if (code) await leaveRoom(code)
    setCode(null)
    setSnap(null)
    onLeave()
  }

  if (!code || !snap) {
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <DoorOpen className="h-5 w-5 text-melon-600" />
            一起玩儿
          </CardTitle>
          <CardDescription>先进同一个小组房，语音会一直保持；进来后再一起选游戏。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>你的名字</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="比如 爸爸"
              maxLength={8}
              className="h-12 w-full rounded-2xl border border-ink-200 px-3 text-sm outline-none focus:border-melon-400"
            />
          </div>
          <Button onClick={create} disabled={busy} className="h-12 w-full gap-2 bg-orange-500 text-white hover:bg-orange-600">
            <Crown className="h-4 w-4" />
            创建小组
          </Button>
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <div className="h-px flex-1 bg-ink-100" />
            或者加入别人小组
            <div className="h-px flex-1 bg-ink-100" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void join()
              }}
              placeholder="输房号"
              maxLength={6}
              className="min-h-14 flex-1 rounded-2xl border border-ink-200 px-3 text-center text-xl tracking-widest outline-none focus:border-melon-400"
            />
            <Button onClick={join} disabled={busy} variant="outline" className="min-h-14 w-full sm:w-auto">
              加入
            </Button>
          </div>
          {err && <p className="text-sm text-rose-500">{err}</p>}
        </CardContent>
        <CardFooter>
          <Button variant="ghost" onClick={onLeave} className="text-ink-500">
            返回首页
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <DoorOpen className="h-5 w-5 text-melon-600" />
          小组房号 <RoomCode code={code} />
        </CardTitle>
        <CardDescription>语音已经属于这个小组。换游戏不会断，另一组用另一个房号就是另一条频道。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RoomAudioPanel code={code} roomState={snap.state} myName={name} autoJoin />
        <PresenceStrip users={presenceUsers} currentPlayerId={me?.id} roomCode={code} />

        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span
              key={m.seat}
              className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-3 py-1 text-sm text-ink-700"
            >
              <span className="text-ink-400">{m.seat}.</span>
              <span>{m.emoji}</span>
              <span>{m.name}</span>
              <span className={m.online ? 'h-1.5 w-1.5 rounded-full bg-emerald-500' : 'h-1.5 w-1.5 rounded-full bg-ink-200'} />
              {m.is_host && <Crown className="h-3.5 w-3.5 text-orange-500" />}
            </span>
          ))}
        </div>

        {isHost ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {partyGames.map((game: GameMeta) => (
              <button
                key={game.id}
                type="button"
                onClick={() => void chooseGame(game.id)}
                disabled={busy}
                className="min-h-24 rounded-2xl border border-ink-100 bg-white p-4 text-left shadow-sm transition hover:border-orange-200 hover:bg-orange-50 disabled:opacity-60"
              >
                <div className="flex items-center gap-2 font-display text-xl text-ink-900">
                  <Gamepad2 className="h-4 w-4 text-orange-500" />
                  {game.name}
                </div>
                <div className="mt-1 text-xs text-ink-500">{game.desc}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-4 text-center text-sm text-ink-500">
            等房主选游戏。语音可以先聊着。
          </div>
        )}

        {err && <p className="text-sm text-rose-500">{err}</p>}
      </CardContent>
      <CardFooter className="justify-between">
        <div className="flex items-center gap-1 text-xs text-ink-500">
          <Users className="h-3.5 w-3.5" />
          已加入 {members.length} 人
        </div>
        <Button variant="ghost" onClick={doLeave} className="gap-1 text-ink-500">
          <LogOut className="h-4 w-4" />
          退出小组
        </Button>
      </CardFooter>
    </Card>
  )
}
