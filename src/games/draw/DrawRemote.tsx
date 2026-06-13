// 你画我猜 · 远程模式：轮流当画手。房间(轮询)管大厅/轮换/出词（词只发给画手），
// 画笔走 Supabase Realtime 广播实时同步——画手画、其他人实时看着猜（语音说出来）。

import { useEffect, useMemo, useRef, useState } from 'react'
import { Crown, LogOut, Paintbrush, Shuffle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { getPlayers } from '@/platform/players'
import { getCurrentPlayer } from '@/platform/progress'
import { RemoteVoiceHint } from '@/platform/RemoteVoiceHint'
import { joinDrawChannel, type DrawChannel } from '@/platform/realtime'
import { createRoom, hostSet, joinRoom, leaveRoom, subscribeRoom, type RoomSnapshot } from '@/platform/rooms'
import { RemoteCanvas, type DrawMsg, type RemoteCanvasHandle } from './components/RemoteCanvas'
import { pickWord } from './utils/pickWord'
import type { DrawDifficulty } from './types'

const ALL_DIFF: ReadonlySet<DrawDifficulty> = new Set<DrawDifficulty>(['easy', 'medium', 'hard'])

export function DrawRemote({ onBack }: { onBack: () => void }) {
  const me = useMemo(() => getPlayers().find((p) => p.id === getCurrentPlayer()), [])
  const [name, setName] = useState(me?.name ?? '')
  const emoji = me?.emoji ?? '🙂'

  const [code, setCode] = useState<string | null>(null)
  const [snap, setSnap] = useState<RoomSnapshot | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const canvasRef = useRef<RemoteCanvasHandle | null>(null)
  const chanRef = useRef<DrawChannel | null>(null)
  const lastRoundRef = useRef(-1)
  const usedRef = useRef<Set<string>>(new Set())

  // 房间状态轮询；轮次变化时清空画板
  useEffect(() => {
    if (!code) return
    const unsub = subscribeRoom(code, (next) => {
      const round = (next.payload.round as number) ?? 0
      if (round !== lastRoundRef.current) {
        lastRoundRef.current = round
        canvasRef.current?.reset()
      }
      setSnap(next)
    })
    return unsub
  }, [code])

  // 画笔实时频道：进房就连，收到别人的笔触就画到画板上
  useEffect(() => {
    if (!code) return
    const ch = joinDrawChannel(code, (msg) => canvasRef.current?.apply(msg as DrawMsg))
    chanRef.current = ch
    return () => {
      ch.leave()
      chanRef.current = null
    }
  }, [code])

  const isHost = snap?.you?.is_host ?? false
  const mySeat = snap?.you?.seat ?? -1
  const members = snap?.members ?? []
  const drawerSeat = (snap?.payload.drawerSeat as number) ?? -1
  const drawerName = (snap?.payload.drawerName as string) ?? ''
  const iAmDrawer = mySeat === drawerSeat
  const secret = snap?.you?.secret as { word?: string; hint?: string } | null | undefined

  const create = async () => {
    setBusy(true)
    setErr('')
    const c = await createRoom('draw', name.trim() || '房主', emoji)
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
    else setErr(seat === -1 ? '没找到这个房间' : seat === -2 ? '这一局已经开始了' : '连不上，检查下网络')
  }

  // 出新一轮：换画手 + 出词（词只发给画手那一座），并清空各端画板
  const newRound = async (roundNum: number, seat: number) => {
    if (!code) return
    setBusy(true)
    const word = pickWord(ALL_DIFF, usedRef.current)
    usedRef.current.add(word.text)
    const who = members.find((m) => m.seat === seat)
    const secrets = Object.fromEntries(
      members.map((m) => [String(m.seat), m.seat === seat ? { word: word.text, hint: word.hint } : { word: null }])
    )
    chanRef.current?.send({ t: 'clear' })
    canvasRef.current?.reset()
    await hostSet(code, {
      state: 'playing',
      payload: { drawerSeat: seat, drawerName: who?.name ?? `${seat}号`, round: roundNum },
      secrets,
    })
    setBusy(false)
  }

  const start = async () => {
    if (members.length < 2) return
    await newRound(1, members[0].seat)
  }

  const nextDrawer = async () => {
    const round = (snap?.payload.round as number) ?? 1
    const nextSeat = members[round % members.length]?.seat ?? members[0].seat
    await newRound(round + 1, nextSeat)
  }

  const swapWord = async () => {
    const round = (snap?.payload.round as number) ?? 1
    await newRound(round + 1, drawerSeat) // 同一个画手、换词、清板
  }

  const doLeave = async () => {
    if (code) await leaveRoom(code)
    chanRef.current?.leave()
    setCode(null)
    setSnap(null)
    setJoinCode('')
    usedRef.current = new Set()
    lastRoundRef.current = -1
  }

  const sendDraw = (msg: DrawMsg) => chanRef.current?.send(msg)

  // ── 入口 ─────────────────────────────────────────────────────────
  if (!code || !snap) {
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Paintbrush className="h-5 w-5 text-melon-600" />
            远程你画我猜
          </CardTitle>
          <CardDescription>各自用自己手机，画手画、大家实时看着猜。建个房，把房号告诉大家。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RemoteVoiceHint />
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
            我来建房
          </Button>
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <div className="h-px flex-1 bg-ink-100" />
            或者加入别人的房
            <div className="h-px flex-1 bg-ink-100" />
          </div>
          <div className="flex gap-2">
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
              className="h-12 flex-1 rounded-2xl border border-ink-200 px-3 text-center text-lg tracking-widest outline-none focus:border-melon-400"
            />
            <Button onClick={join} disabled={busy} variant="outline" className="h-12 shrink-0">
              加入
            </Button>
          </div>
          {err && <p className="text-sm text-rose-500">{err}</p>}
        </CardContent>
        <CardFooter>
          <Button variant="ghost" onClick={onBack} className="text-ink-500">
            ← 改用同屏玩
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const memberList = (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => (
        <span
          key={m.seat}
          className={
            'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ' +
            (m.seat === drawerSeat ? 'border-melon-400 bg-melon-50 text-melon-700' : 'border-ink-200 bg-white text-ink-700')
          }
        >
          <span className="text-ink-400">{m.seat}.</span>
          <span>{m.emoji}</span>
          <span>{m.name}</span>
          {m.is_host && <Crown className="h-3.5 w-3.5 text-orange-500" />}
        </span>
      ))}
    </div>
  )

  const leaveBtn = (
    <Button variant="ghost" onClick={doLeave} className="gap-1 text-ink-500">
      <LogOut className="h-4 w-4" />
      退出房间
    </Button>
  )

  // ── 大厅 ─────────────────────────────────────────────────────────
  if (snap.state === 'lobby') {
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Paintbrush className="h-5 w-5 text-melon-600" />
            房号 <span className="font-mono tracking-[0.3em] text-orange-600">{code}</span>
          </CardTitle>
          <CardDescription>把房号告诉大家，人到齐房主就开始。已经 {members.length} 人。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RemoteVoiceHint />
          {memberList}
          {isHost ? (
            <Button
              onClick={start}
              disabled={busy || members.length < 2}
              className="h-12 w-full gap-2 bg-orange-500 text-white hover:bg-orange-600"
            >
              <Shuffle className="h-4 w-4" />
              {members.length < 2 ? '至少 2 人才能开始' : '开始（轮流当画手）'}
            </Button>
          ) : (
            <p className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-4 text-center text-sm text-ink-500">
              等房主开始…
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-between">{leaveBtn}</CardFooter>
      </Card>
    )
  }

  // ── 画 / 猜 ───────────────────────────────────────────────────────
  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Paintbrush className="h-5 w-5 text-melon-600" />
          {iAmDrawer ? '轮到你画' : `${drawerName} 在画`}
        </CardTitle>
        <CardDescription>
          {iAmDrawer ? '把词画出来，别写字、别比口型。' : '看 TA 画，猜出来就大声喊（开着微信视频）。'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {iAmDrawer ? (
          <div className="rounded-2xl border border-melon-200 bg-melon-50 p-3 text-center">
            <span className="text-sm text-melon-600">你要画：</span>
            <span className="font-display text-2xl text-ink-900"> {secret?.word}</span>
            {secret?.hint && <span className="ml-2 text-xs text-ink-500">（{secret.hint}）</span>}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-2 text-center text-sm text-ink-500">
            🎨 实时看 {drawerName} 画，猜到就喊出来！
          </div>
        )}
        <RemoteCanvas key="canvas" ref={canvasRef} editable={iAmDrawer} onSend={iAmDrawer ? sendDraw : undefined} />
        {memberList}
      </CardContent>
      <CardFooter className="justify-between gap-2">
        {leaveBtn}
        {isHost && (
          <span className="flex gap-2">
            <Button onClick={swapWord} variant="outline" disabled={busy}>
              换个词
            </Button>
            <Button onClick={nextDrawer} disabled={busy} className="gap-2">
              下一位
            </Button>
          </span>
        )}
      </CardFooter>
    </Card>
  )
}
