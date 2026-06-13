// 谁是卧底 · 远程模式：每人在自己手机上，只看到自己的词。
// 房主建房→大家凭房号加入→房主发词（按座位下发私密 secret）→各看各的→房主公布。
// 同步靠轮询房间快照（rooms.ts）；秘密词只回传给本人，旁人/外人都看不到。

import { useEffect, useMemo, useRef, useState } from 'react'
import { Crown, Eye, EyeOff, LogOut, Shuffle, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { wordBank, type WordItem } from '@/data/word-bank'
import { contentFor } from '@/platform/content'
import { getPlayers } from '@/platform/players'
import { getCurrentPlayer, pickUnseen } from '@/platform/progress'
import { RemoteVoiceHint } from '@/platform/RemoteVoiceHint'
import { createRoom, hostSet, joinRoom, leaveRoom, subscribeRoom, type RoomSnapshot } from '@/platform/rooms'

function getMaxSpies(n: number) {
  if (n <= 4) return 1
  if (n <= 6) return 2
  if (n <= 8) return 3
  if (n <= 10) return 4
  return Math.max(4, Math.floor(n / 3))
}

function shuffle<T>(items: T[]) {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

interface HostAnswer {
  pair: [WordItem, WordItem]
  spyWord: WordItem
  spySeats: number[]
}

export function UndercoverRemote({ onBack }: { onBack: () => void }) {
  const me = useMemo(() => getPlayers().find((p) => p.id === getCurrentPlayer()), [])
  const [name, setName] = useState(me?.name ?? '')
  const emoji = me?.emoji ?? '🙂'

  const [code, setCode] = useState<string | null>(null)
  const [snap, setSnap] = useState<RoomSnapshot | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [spyCount, setSpyCount] = useState(1)
  const [hostAnswer, setHostAnswer] = useState<HostAnswer | null>(null)
  const [showWord, setShowWord] = useState(false)
  const lastStateRef = useRef<string | null>(null)

  useEffect(() => {
    if (!code) return
    const unsub = subscribeRoom(code, (next) => {
      // 一进入发词阶段，默认先盖住自己的词（回调在轮询里异步触发，安全）
      if (lastStateRef.current !== 'playing' && next.state === 'playing') setShowWord(false)
      lastStateRef.current = next.state
      setSnap(next)
    })
    return unsub
  }, [code])

  const isHost = snap?.you?.is_host ?? false
  const members = snap?.members ?? []
  const maxSpies = getMaxSpies(Math.max(members.length, 1))

  const create = async () => {
    setBusy(true)
    setErr('')
    const c = await createRoom('undercover', name.trim() || '房主', emoji)
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

  const startGame = async () => {
    if (!code || members.length < 3) return
    setBusy(true)
    // 运行时取云端/缓存词库（拿不到回退打包副本）
    const bank = contentFor('word-bank', wordBank)
    const [pair = bank[0]] = pickUnseen('undercover', shuffle(bank), (p) => p.id, 1)
    const [w0, w1] = pair.words
    const spyWord = Math.random() > 0.5 ? w0 : w1
    const civWord = spyWord === w0 ? w1 : w0
    const seats = members.map((m) => m.seat)
    const spies = Math.min(spyCount, getMaxSpies(seats.length))
    const spySeats = shuffle(seats).slice(0, spies)
    const secrets: Record<string, unknown> = {}
    for (const s of seats) secrets[String(s)] = { word: spySeats.includes(s) ? spyWord : civWord }
    setHostAnswer({ pair: [w0, w1], spyWord, spySeats })
    await hostSet(code, {
      state: 'playing',
      payload: { round: ((snap?.payload.round as number) ?? 0) + 1 },
      secrets,
    })
    setBusy(false)
  }

  const revealAll = async () => {
    if (!code || !hostAnswer) return
    setBusy(true)
    await hostSet(code, {
      state: 'reveal',
      payload: {
        round: (snap?.payload.round as number) ?? 1,
        pairText: [hostAnswer.pair[0].text, hostAnswer.pair[1].text],
        pairPinyin: [hostAnswer.pair[0].pinyin, hostAnswer.pair[1].pinyin],
        spyText: hostAnswer.spyWord.text,
        spyPinyin: hostAnswer.spyWord.pinyin,
        spies: hostAnswer.spySeats,
      },
    })
    setBusy(false)
  }

  const playAgain = async () => {
    if (!code) return
    setHostAnswer(null)
    await hostSet(code, { state: 'lobby', payload: {} })
  }

  const doLeave = async () => {
    if (code) await leaveRoom(code)
    setCode(null)
    setSnap(null)
    setHostAnswer(null)
    setJoinCode('')
  }

  // ── 入口：还没进房 ───────────────────────────────────────────────
  if (!code || !snap) {
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Users className="h-5 w-5 text-melon-600" />
            远程一起玩
          </CardTitle>
          <CardDescription>各自用自己的手机，只看到自己的词。建个房，把房号告诉大家。</CardDescription>
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
          <CardTitle className="flex items-center justify-between text-2xl">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5 text-melon-600" />
              房号 <span className="font-mono tracking-[0.3em] text-orange-600">{code}</span>
            </span>
          </CardTitle>
          <CardDescription>把房号告诉大家，等人到齐房主就开始。已经 {members.length} 人。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RemoteVoiceHint />
          {memberList}
          {isHost ? (
            <div className="space-y-3 rounded-2xl border border-ink-100 bg-white/70 p-4">
              <div className="space-y-2">
                <Label htmlFor="rspies">卧底人数（最多 {maxSpies}）</Label>
                <select
                  id="rspies"
                  value={Math.min(spyCount, maxSpies)}
                  onChange={(e) => setSpyCount(Number(e.target.value))}
                  className="h-11 w-full rounded-2xl border border-ink-200 bg-white px-3 text-sm"
                >
                  {Array.from({ length: maxSpies }, (_, i) => i + 1).map((v) => (
                    <option key={v} value={v}>
                      {v} 个
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={startGame}
                disabled={busy || members.length < 3}
                className="h-12 w-full gap-2 bg-orange-500 text-white hover:bg-orange-600"
              >
                <Shuffle className="h-4 w-4" />
                {members.length < 3 ? '至少 3 人才能开始' : '开始发词'}
              </Button>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-4 text-center text-sm text-ink-500">
              等房主开始…（人到齐了喊房主一声）
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-between">
          {leaveBtn}
        </CardFooter>
      </Card>
    )
  }

  // ── 发词阶段：各看各的词 ──────────────────────────────────────────
  if (snap.state === 'playing') {
    const secret = snap.you?.secret as { word: WordItem | null } | null | undefined
    const word = secret?.word ?? null
    const isBlank = secret != null && word == null
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Eye className="h-5 w-5 text-melon-600" />
            你的词
          </CardTitle>
          <CardDescription>只有你能看到。轮流描述，别说出词本身，找出谁不一样。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            type="button"
            onClick={() => setShowWord((v) => !v)}
            className="w-full min-h-[200px] rounded-3xl border border-ink-100/70 bg-white/85 p-6 text-center transition hover:shadow-md"
          >
            {showWord ? (
              isBlank ? (
                <div className="space-y-2">
                  <div className="font-display text-3xl text-ink-900">白板</div>
                  <div className="text-sm text-ink-500">你没有词，注意听别人怎么说</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="font-display text-4xl text-ink-900">{word?.text}</div>
                  <div className="text-sm tracking-widest text-ink-500">{word?.pinyin}</div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center gap-2 text-ink-400">
                <EyeOff className="h-7 w-7" />
                <div className="text-sm">点一下看你的词</div>
              </div>
            )}
          </button>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-ink-500">在场的人（描述顺序按座位）</div>
            {memberList}
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          {leaveBtn}
          {isHost && (
            <Button onClick={revealAll} disabled={busy} className="gap-2">
              公布答案
            </Button>
          )}
        </CardFooter>
      </Card>
    )
  }

  // ── 公布 ─────────────────────────────────────────────────────────
  if (snap.state === 'reveal') {
    const p = snap.payload as {
      pairText?: [string, string]
      pairPinyin?: [string, string]
      spyText?: string
      spyPinyin?: string
      spies?: number[]
    }
    const spies = new Set(p.spies ?? [])
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Users className="h-5 w-5 text-melon-600" />
            公布答案
          </CardTitle>
          <CardDescription>谁是卧底？答案揭晓。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-ink-100/70 bg-white/80 p-4">
              <div className="text-xs text-ink-500">词语组合</div>
              <div className="mt-1 text-lg font-semibold text-ink-900">
                {p.pairText?.[0]} / {p.pairText?.[1]}
              </div>
              <div className="text-xs text-ink-500">
                {p.pairPinyin?.[0]} / {p.pairPinyin?.[1]}
              </div>
            </div>
            <div className="rounded-2xl border border-melon-200/70 bg-melon-50 p-4">
              <div className="text-xs text-melon-600">卧底词</div>
              <div className="mt-1 text-lg font-semibold text-melon-700">{p.spyText}</div>
              <div className="text-xs text-melon-600">{p.spyPinyin}</div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-ink-500">身份</div>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const spy = spies.has(m.seat)
                return (
                  <span
                    key={m.seat}
                    className={
                      'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ' +
                      (spy ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-ink-200 bg-white text-ink-700')
                    }
                  >
                    <span>{m.emoji}</span>
                    <span>{m.name}</span>
                    <span className="text-xs font-semibold">{spy ? '卧底' : '平民'}</span>
                  </span>
                )
              })}
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          {leaveBtn}
          {isHost && (
            <Button onClick={playAgain} variant="outline" className="gap-2">
              再来一局
            </Button>
          )}
        </CardFooter>
      </Card>
    )
  }

  return null
}
