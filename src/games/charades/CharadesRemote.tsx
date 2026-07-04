// 你来比划 · 远程模式：每人在自己手机上。轮到的人「猜」——他看不到词；
// 其他人都看到词，开微信视频描述给他听，他大声说出那个词。
// 房主按座位轮流指定「猜的人」，并按座位下发私密 secret（猜的人收到 null，其余收到词）。
// 同步靠轮询房间快照（rooms.ts）；词只回传给本人，旁人/外人都看不到。

import { useEffect, useMemo, useState } from 'react'
import { Crown, Eye, EyeOff, LogOut, Shuffle, SkipForward, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { getPlayers } from '@/platform/players'
import { getCurrentPlayer, pickUnseen } from '@/platform/progress'
import { RemoteVoiceHint } from '@/platform/RemoteVoiceHint'
import { RoomAudioPanel } from '@/platform/RoomAudioPanel'
import { RoomCode } from '@/platform/RoomCode'
import { contentFor } from '@/platform/content'
import { createRoom, hostSet, joinRoom, leaveRoom, subscribeRoom, type RoomSnapshot } from '@/platform/rooms'
import { CharadesVideoPanel } from './components/CharadesVideoPanel'
import type { WordEntry } from './types'

function shuffle<T>(items: T[]) {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function CharadesRemote({ onBack }: { onBack: () => void }) {
  const me = useMemo(() => getPlayers().find((p) => p.id === getCurrentPlayer()), [])
  const [name, setName] = useState(me?.name ?? '')
  const emoji = me?.emoji ?? '🙂'

  const [code, setCode] = useState<string | null>(null)
  const [snap, setSnap] = useState<RoomSnapshot | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [round, setRound] = useState(1)

  useEffect(() => {
    if (!code) return
    const unsub = subscribeRoom(code, setSnap)
    return unsub
  }, [code])

  const isHost = snap?.you?.is_host ?? false
  const members = snap?.members ?? []

  const create = async () => {
    setBusy(true)
    setErr('')
    const c = await createRoom('charades', name.trim() || '房主', emoji)
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

  // 按座位下发：猜的人收到 null，其余人收到词
  const dealWord = async (guesserSeat: number, r: number) => {
    if (!code) return
    setBusy(true)
    const words = contentFor<WordEntry>('charades', [])
    const [word = words[0]] = pickUnseen('charades', shuffle(words), (w) => w.text, 1)
    const guesserName = members.find((m) => m.seat === guesserSeat)?.name ?? `${guesserSeat}号`
    await hostSet(code, {
      state: 'playing',
      payload: { guesserSeat, guesserName, round: r },
      secrets: Object.fromEntries(
        members.map((m) => [String(m.seat), { word: m.seat === guesserSeat ? null : { text: word.text } }])
      ),
    })
    setBusy(false)
  }

  // 开始 / 下一位：轮到第 r 轮（1-based）→ guesserSeat = members[(r-1) % n].seat
  const startRound = async (r: number) => {
    if (!members.length) return
    const guesserSeat = members[(r - 1) % members.length].seat
    setRound(r)
    await dealWord(guesserSeat, r)
  }

  // 换个词：同一个猜的人，重新发一张词
  const swapWord = async () => {
    const guesserSeat = snap?.payload.guesserSeat as number | undefined
    if (guesserSeat == null) return
    await dealWord(guesserSeat, round)
  }

  const doLeave = async () => {
    if (code) await leaveRoom(code)
    setCode(null)
    setSnap(null)
    setRound(1)
    setJoinCode('')
  }

  // ── 入口：还没进房 ───────────────────────────────────────────────
  if (!code || !snap) {
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-5 w-5 text-melon-600" />
            远程你来比划
          </CardTitle>
          <CardDescription>各自用自己的手机，轮到谁猜谁就看不到词，大家描述给他听。建个房，把房号告诉大家。</CardDescription>
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
            我来建房
          </Button>
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <div className="h-px flex-1 bg-ink-100" />
            或者加入别人的房
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
              className="h-12 flex-1 rounded-2xl border border-ink-200 px-3 text-center text-lg tracking-widest outline-none focus:border-melon-400"
            />
            <Button onClick={join} disabled={busy} variant="outline" className="h-12 w-full sm:w-auto">
              加入
            </Button>
          </div>
          {err && <p className="text-sm text-rose-500">{err}</p>}
        </CardContent>
        <CardFooter>
          <Button variant="ghost" onClick={onBack} className="text-ink-500">
            ← 改用同屏传手机
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
          className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-3 py-1 text-sm text-ink-700"
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
            <Sparkles className="h-5 w-5 text-melon-600" />
            房号 <RoomCode code={code} />
          </CardTitle>
          <CardDescription>把房号告诉大家，人到齐房主就开始。已经 {members.length} 人。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RoomAudioPanel code={code} roomState={snap.state} myName={name} />
          <RemoteVoiceHint />
          {memberList}
          {isHost ? (
            <Button
              onClick={() => startRound(1)}
              disabled={busy || members.length < 3}
              className="h-12 w-full gap-2 bg-orange-500 text-white hover:bg-orange-600"
            >
              <Shuffle className="h-4 w-4" />
              {members.length < 3 ? '至少 3 人才能开始' : '开始'}
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

  // ── 进行中：轮到谁猜，谁看不到词 ──────────────────────────────────
  if (snap.state === 'playing') {
    const p = snap.payload as { guesserSeat?: number; guesserName?: string; round?: number }
    const guesserSeat = p.guesserSeat
    const guesserName = p.guesserName ?? `${guesserSeat ?? ''}号`
    const iAmGuesser = snap.you?.seat === guesserSeat
    const secret = snap.you?.secret as { word: { text: string } | null } | null | undefined
    const word = secret?.word ?? null
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            {iAmGuesser ? <EyeOff className="h-5 w-5 text-melon-600" /> : <Eye className="h-5 w-5 text-melon-600" />}
            第 {p.round ?? 1} 轮
          </CardTitle>
          <CardDescription>这一轮由【{guesserName}】来猜，其他人开视频描述。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RoomAudioPanel code={code} roomState={snap.state} myName={name} />
          <CharadesVideoPanel
            code={code}
            roomState={snap.state}
            mySeat={snap.you?.seat}
            guesserSeat={guesserSeat}
            myName={name}
          />
          {iAmGuesser ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-3xl border border-ink-100/70 bg-white/85 p-6 text-center">
              <div className="text-5xl">🙈</div>
              <div className="font-display text-2xl text-ink-900">轮到你猜！</div>
              <div className="text-sm text-ink-500">大家在描述，你大声说出那个词</div>
            </div>
          ) : (
            <>
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-3xl border border-ink-100/70 bg-white/85 p-6 text-center">
                <div className="font-display text-4xl text-ink-900">{word?.text}</div>
              </div>
              <p className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-3 text-center text-sm text-ink-500">
                描述给【{guesserName}】听，别说出词本身、别用谐音。
              </p>
            </>
          )}
          {memberList}
        </CardContent>
        <CardFooter className="justify-between gap-2">
          {leaveBtn}
          {isHost && (
            <span className="flex gap-2">
              <Button onClick={swapWord} variant="outline" disabled={busy} className="gap-1">
                换个词
              </Button>
              <Button onClick={() => startRound(round + 1)} disabled={busy} className="gap-1">
                <SkipForward className="h-4 w-4" />
                下一位
              </Button>
            </span>
          )}
        </CardFooter>
      </Card>
    )
  }

  return null
}
