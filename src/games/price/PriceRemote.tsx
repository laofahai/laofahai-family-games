// 猜价格 · 远程模式：房主出一件商品，每人在自己手机上私密出价，房主公布谁最接近。
// 各端轮询房间快照；出价用 member_submit（私密），公布时房主 collect_submissions 汇总算分。

import { useEffect, useMemo, useState } from 'react'
import { Crown, LogOut, Shuffle, Tag } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { getPlayers } from '@/platform/players'
import { getCurrentPlayer, pickUnseen } from '@/platform/progress'
import { RemoteVoiceHint } from '@/platform/RemoteVoiceHint'
import { RoomAudioPanel } from '@/platform/RoomAudioPanel'
import { RoomCode } from '@/platform/RoomCode'
import {
  clearSubmissions,
  collectSubmissions,
  createRoom,
  hostSet,
  joinRoom,
  leaveRoom,
  memberSubmit,
  subscribeRoom,
  type RoomSnapshot,
} from '@/platform/rooms'
import { contentFor } from '@/platform/content'
import type { PriceItem } from './types'

function shuffle<T>(items: T[]) {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

interface RevealPayload {
  name?: string
  unit?: string
  note?: string
  price?: number
  round?: number
  guesses?: { seat: number; name: string; emoji: string; guess: number }[]
  winners?: number[]
  scores?: Record<string, number>
}

export function PriceRemote({ onBack }: { onBack: () => void }) {
  const me = useMemo(() => getPlayers().find((p) => p.id === getCurrentPlayer()), [])
  const [name, setName] = useState(me?.name ?? '')
  const emoji = me?.emoji ?? '🙂'

  const [code, setCode] = useState<string | null>(null)
  const [snap, setSnap] = useState<RoomSnapshot | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [guess, setGuess] = useState('')

  // 房主本地保存：当前商品（含真实价，不进公共 payload）+ 累计分 + 轮次
  const [item, setItem] = useState<PriceItem | null>(null)
  const [scores, setScores] = useState<Record<number, number>>({})
  const [round, setRound] = useState(0)

  // 订阅房间：code 变化时建立轮询
  useEffect(() => {
    if (!code) return
    const unsub = subscribeRoom(code, setSnap)
    return unsub
  }, [code])

  const isHost = snap?.you?.is_host ?? false
  const members = snap?.members ?? []
  const mySubmission = snap?.you?.submission as { guess?: number } | null | undefined

  const create = async () => {
    setBusy(true)
    setErr('')
    const c = await createRoom('price', name.trim() || '房主', emoji)
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

  const nextItem = async (nextRound: number) => {
    if (!code) return
    setBusy(true)
    await clearSubmissions(code)
    // 运行时读取云端/缓存内容，拿不到回退到打包副本。
    const items = contentFor<PriceItem>('price', [])
    const [picked = items[0]] = pickUnseen('price', shuffle(items), (it) => it.name, 1)
    setItem(picked)
    setRound(nextRound)
    await hostSet(code, {
      state: 'playing',
      payload: { name: picked.name, unit: picked.unit ?? '', round: nextRound },
    })
    setBusy(false)
  }

  const reveal = async () => {
    if (!code || !item) return
    setBusy(true)
    const subs = await collectSubmissions(code)
    const entries = subs
      .map((s) => ({ ...s, guess: Number((s.submission as { guess?: number } | null)?.guess) }))
      .filter((s) => Number.isFinite(s.guess))
    let winners: number[] = []
    let sharp = false
    if (entries.length) {
      const bestDiff = Math.min(...entries.map((e) => Math.abs(e.guess - item.price)))
      winners = entries.filter((e) => Math.abs(e.guess - item.price) === bestDiff).map((e) => e.seat)
      sharp = bestDiff <= item.price * 0.1
    }
    const nextScores = { ...scores }
    for (const w of winners) nextScores[w] = (nextScores[w] ?? 0) + (sharp ? 2 : 1)
    setScores(nextScores)
    await hostSet(code, {
      state: 'reveal',
      payload: {
        name: item.name,
        unit: item.unit ?? '',
        note: item.note ?? '',
        price: item.price,
        round,
        guesses: entries.map((e) => ({ seat: e.seat, name: e.name, emoji: e.emoji, guess: e.guess })),
        winners,
        scores: Object.fromEntries(Object.entries(nextScores)),
      },
    })
    setBusy(false)
  }

  const finish = async () => {
    if (!code) return
    setBusy(true)
    await hostSet(code, { state: 'result', payload: { scores: Object.fromEntries(Object.entries(scores)) } })
    setBusy(false)
  }

  const playAgain = async () => {
    if (!code) return
    setScores({})
    setRound(0)
    setItem(null)
    await hostSet(code, { state: 'lobby', payload: {} })
  }

  const doLeave = async () => {
    if (code) await leaveRoom(code)
    setCode(null)
    setSnap(null)
    setItem(null)
    setScores({})
    setRound(0)
    setJoinCode('')
  }

  const submitGuess = async () => {
    if (!code) return
    const v = Number(guess)
    if (!Number.isFinite(v) || v <= 0) {
      setErr('填个大于 0 的数字')
      return
    }
    setErr('')
    setBusy(true)
    await memberSubmit(code, { guess: v })
    setBusy(false)
  }

  // ── 入口 ─────────────────────────────────────────────────────────
  if (!code || !snap) {
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Tag className="h-5 w-5 text-melon-600" />
            远程猜价格
          </CardTitle>
          <CardDescription>各自用自己手机出价，房主公布谁最接近。建个房，把房号告诉大家。</CardDescription>
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
          <Button variant="ghost" onClick={onBack} className="text-ink-500">
            ← 改用同屏轮流玩
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

  const nameBySeat = (seat: number) => members.find((m) => m.seat === seat)?.name ?? `${seat}号`
  const emojiBySeat = (seat: number) => members.find((m) => m.seat === seat)?.emoji ?? '🙂'

  const scoreboard = (scoresObj: Record<string, number>) => {
    const rows = Object.entries(scoresObj)
      .map(([seat, pts]) => ({ seat: Number(seat), pts }))
      .sort((a, b) => b.pts - a.pts)
    if (!rows.length) return null
    return (
      <div className="space-y-1">
        <div className="text-xs font-semibold text-ink-500">累计积分</div>
        <div className="flex flex-wrap gap-2">
          {rows.map((r) => (
            <span key={r.seat} className="inline-flex items-center gap-1 rounded-full border border-melon-200 bg-melon-50 px-3 py-1 text-sm text-melon-700">
              <span>{emojiBySeat(r.seat)}</span>
              <span>{nameBySeat(r.seat)}</span>
              <span className="font-semibold">{r.pts} 分</span>
            </span>
          ))}
        </div>
      </div>
    )
  }

  // ── 大厅 ─────────────────────────────────────────────────────────
  if (snap.state === 'lobby') {
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Tag className="h-5 w-5 text-melon-600" />
            房号 <RoomCode code={code} />
          </CardTitle>
          <CardDescription>把房号告诉大家，人到齐房主就出第一件商品。已经 {members.length} 人。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RoomAudioPanel code={code} roomState={snap.state} myName={name} />
          <RemoteVoiceHint />
          {memberList}
          {isHost ? (
            <Button
              onClick={() => nextItem(1)}
              disabled={busy || members.length < 2}
              className="h-12 w-full gap-2 bg-orange-500 text-white hover:bg-orange-600"
            >
              <Shuffle className="h-4 w-4" />
              {members.length < 2 ? '至少 2 人才能开始' : '出第一件商品'}
            </Button>
          ) : (
            <p className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-4 text-center text-sm text-ink-500">
              等房主出题…
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-between">{leaveBtn}</CardFooter>
      </Card>
    )
  }

  // ── 出价阶段 ──────────────────────────────────────────────────────
  if (snap.state === 'playing') {
    const p = snap.payload as { name?: string; unit?: string; round?: number }
    const submitted = mySubmission?.guess != null
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Tag className="h-5 w-5 text-melon-600" />
            第 {p.round ?? 1} 件 · 这个多少钱？
          </CardTitle>
          <CardDescription>各自出价，只有你看得到自己填的。房主收齐就公布。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RoomAudioPanel code={code} roomState={snap.state} myName={name} />
          <div className="rounded-3xl border border-ink-100/70 bg-white/85 p-5 text-center">
            <div className="font-display text-2xl text-ink-900">{p.name}</div>
            {p.unit && <div className="mt-1 text-sm text-ink-500">{p.unit}</div>}
          </div>
          {isHost ? (
            <p className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-3 text-center text-sm text-ink-500">
              你是出题人，知道价、不参与猜。大家出完价点「公布答案」。
            </p>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="guess">你出价（元）</Label>
                  <input
                    id="guess"
                    inputMode="decimal"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value.replace(/[^\d.]/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitGuess()
                    }}
                    placeholder={submitted ? `已提交 ${mySubmission?.guess} 元，可改` : '比如 19.9'}
                    className="h-12 w-full rounded-2xl border border-ink-200 px-3 text-center text-lg outline-none focus:border-melon-400"
                  />
                </div>
                <Button onClick={submitGuess} disabled={busy} className="h-12 shrink-0">
                  {submitted ? '改一下' : '提交'}
                </Button>
              </div>
              {submitted && <p className="text-sm text-emerald-600">已提交 {mySubmission?.guess} 元，等其他人…</p>}
              {err && <p className="text-sm text-rose-500">{err}</p>}
            </>
          )}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-ink-500">
              已出价 {snap.submittedCount}/{Math.max(members.length - 1, 0)} 人
            </div>
            {memberList}
          </div>
          {scoreboard((snap.payload.scores as Record<string, number>) ?? {})}
        </CardContent>
        <CardFooter className="justify-between">
          {leaveBtn}
          {isHost && (
            <Button onClick={reveal} disabled={busy || snap.submittedCount === 0} className="gap-2">
              公布答案
            </Button>
          )}
        </CardFooter>
      </Card>
    )
  }

  // ── 公布 ─────────────────────────────────────────────────────────
  if (snap.state === 'reveal') {
    const p = snap.payload as RevealPayload
    const winners = new Set(p.winners ?? [])
    const ranked = [...(p.guesses ?? [])].sort(
      (a, b) => Math.abs(a.guess - (p.price ?? 0)) - Math.abs(b.guess - (p.price ?? 0))
    )
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Tag className="h-5 w-5 text-melon-600" />
            真实价：{p.price} 元
          </CardTitle>
          <CardDescription>{p.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RoomAudioPanel code={code} roomState={snap.state} myName={name} />
          {p.note && (
            <div className="rounded-2xl border border-ink-100/70 bg-white/80 p-4 text-sm text-ink-600">{p.note}</div>
          )}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-ink-500">大家的出价（越接近越靠前）</div>
            <div className="space-y-1.5">
              {ranked.map((g) => {
                const win = winners.has(g.seat)
                const diff = Math.abs(g.guess - (p.price ?? 0))
                return (
                  <div
                    key={g.seat}
                    className={
                      'flex items-center justify-between rounded-2xl border px-4 py-2 text-sm ' +
                      (win ? 'border-melon-300 bg-melon-50' : 'border-ink-100 bg-white')
                    }
                  >
                    <span className="flex items-center gap-2">
                      <span>{g.emoji}</span>
                      <span className="font-semibold text-ink-800">{g.name}</span>
                      {win && <span className="text-xs font-semibold text-melon-600">最接近 🏆</span>}
                    </span>
                    <span className="text-ink-600">
                      {g.guess} 元 <span className="text-xs text-ink-400">差 {Math.round(diff * 10) / 10}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
          {scoreboard(p.scores ?? {})}
        </CardContent>
        <CardFooter className="justify-between gap-2">
          {leaveBtn}
          {isHost && (
            <span className="flex gap-2">
              <Button onClick={finish} variant="outline" disabled={busy}>
                结束看排名
              </Button>
              <Button onClick={() => nextItem((p.round ?? 1) + 1)} disabled={busy} className="gap-2">
                下一件
              </Button>
            </span>
          )}
        </CardFooter>
      </Card>
    )
  }

  // ── 总排名 ───────────────────────────────────────────────────────
  if (snap.state === 'result') {
    const p = snap.payload as { scores?: Record<string, number> }
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Crown className="h-5 w-5 text-melon-600" />
            最终排名
          </CardTitle>
          <CardDescription>谁是家里的「行价王」？</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RoomAudioPanel code={code} roomState={snap.state} myName={name} />
          {scoreboard(p.scores ?? {}) ?? <p className="text-sm text-ink-500">还没有积分。</p>}
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
