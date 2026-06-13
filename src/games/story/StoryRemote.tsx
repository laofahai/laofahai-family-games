// 编故事 · 远程模式：房主抽一组关键词卡，所有人在各自手机上看同样的卡 + 同步倒计时。
// 卡片是公开的（房主通过房间 payload 广播），无需私密提交；大家开着微信视频轮流开讲。

import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Clock, Crown, LogOut, Shuffle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { getPlayers } from '@/platform/players'
import { getCurrentPlayer } from '@/platform/progress'
import { RemoteVoiceHint } from '@/platform/RemoteVoiceHint'
import { createRoom, hostSet, joinRoom, leaveRoom, subscribeRoom, type RoomSnapshot } from '@/platform/rooms'
import { storyCards } from './data/story-cards'
import { CATEGORY_LABEL, THEME_LABEL, type Category, type Theme } from './types'
import { drawCards } from './utils/shuffle'

const ALL_THEMES: Set<Theme> = new Set(Object.keys(THEME_LABEL) as Theme[])

interface PlayingPayload {
  cards?: { text: string; category: Category }[]
  round?: number
  durationSec?: number
}

function mmss(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function StoryRemote({ onBack }: { onBack: () => void }) {
  const me = useMemo(() => getPlayers().find((p) => p.id === getCurrentPlayer()), [])
  const [name, setName] = useState(me?.name ?? '')
  const emoji = me?.emoji ?? '🙂'

  const [code, setCode] = useState<string | null>(null)
  const [snap, setSnap] = useState<RoomSnapshot | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // 订阅房间：code 变化时建立轮询
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
    const c = await createRoom('story', name.trim() || '房主', emoji)
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

  const drawRound = async (nextRound: number) => {
    if (!code) return
    setBusy(true)
    const cards = drawCards(storyCards, ALL_THEMES, 4)
    await hostSet(code, {
      state: 'playing',
      payload: {
        cards: cards.map((c) => ({ text: c.text, category: c.category })),
        round: nextRound,
        durationSec: 90,
      },
    })
    setBusy(false)
  }

  const doLeave = async () => {
    if (code) await leaveRoom(code)
    setCode(null)
    setSnap(null)
    setJoinCode('')
  }

  // ── 入口 ─────────────────────────────────────────────────────────
  if (!code || !snap) {
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <BookOpen className="h-5 w-5 text-melon-600" />
            远程编故事
          </CardTitle>
          <CardDescription>各自用自己手机，看同一组关键词，轮流开讲。建个房，把房号告诉大家。</CardDescription>
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
            <BookOpen className="h-5 w-5 text-melon-600" />
            房号 <span className="font-mono tracking-[0.3em] text-orange-600">{code}</span>
          </CardTitle>
          <CardDescription>把房号告诉大家，人到齐房主就出第一组词。已经 {members.length} 人。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RemoteVoiceHint />
          {memberList}
          {isHost ? (
            <Button
              onClick={() => drawRound(1)}
              disabled={busy || members.length < 1}
              className="h-12 w-full gap-2 bg-orange-500 text-white hover:bg-orange-600"
            >
              <Shuffle className="h-4 w-4" />
              出第一组词
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

  // ── 编故事阶段 ────────────────────────────────────────────────────
  if (snap.state === 'playing') {
    const p = snap.payload as PlayingPayload
    const cards = p.cards ?? []
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <BookOpen className="h-5 w-5 text-melon-600" />
            第 {p.round ?? 1} 组词
          </CardTitle>
          <CardDescription>用上这些词，轮到的人开讲（开着微信视频，大家听）。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RemoteCountdown round={p.round ?? 1} durationSec={p.durationSec ?? 90} />
          <div className="grid grid-cols-2 gap-2">
            {cards.map((c, i) => (
              <div
                key={`${c.text}-${i}`}
                className="flex flex-col gap-1 rounded-2xl border border-ink-100/70 bg-white/85 p-4 text-center"
              >
                <span className="text-xs font-semibold text-melon-600">{CATEGORY_LABEL[c.category]}</span>
                <span className="font-display text-lg text-ink-900">{c.text}</span>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-2">
          {leaveBtn}
          {isHost && (
            <Button onClick={() => drawRound((p.round ?? 1) + 1)} disabled={busy} className="gap-2">
              <Shuffle className="h-4 w-4" />
              下一组
            </Button>
          )}
        </CardFooter>
      </Card>
    )
  }

  return null
}

// 本地倒计时：每台设备各自跑，round 变化就重新开始。
// 用 setInterval 在 effect 内异步推进，避免 effect 体内同步 setState。
function RemoteCountdown({ round, durationSec }: { round: number; durationSec: number }) {
  const [secondsLeft, setSecondsLeft] = useState(durationSec)
  const deadlineRef = useRef(0)

  useEffect(() => {
    deadlineRef.current = Date.now() + durationSec * 1000
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) clearInterval(id)
    }, 250)
    return () => clearInterval(id)
  }, [round, durationSec])

  const done = secondsLeft <= 0
  return (
    <div
      className={
        'flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-center ' +
        (done ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-melon-200 bg-melon-50 text-melon-700')
      }
    >
      <Clock className="h-5 w-5" />
      {done ? (
        <span className="text-lg font-semibold">⏰ 时间到！</span>
      ) : (
        <span className="font-mono text-2xl font-semibold tabular-nums">{mmss(secondsLeft)}</span>
      )}
    </div>
  )
}
