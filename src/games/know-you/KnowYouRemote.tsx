// 我知道你不知道 · 远程模式：房主当出题人（看着答案），抛出关于某个家人的知识题，
// 每人在自己手机上私密打字猜答案，房主当裁判勾对错，再公布答案 + 积分。
// 各端轮询房间快照；猜测用 member_submit（私密），公布时房主 collect_submissions 汇总。

import { useEffect, useMemo, useState } from 'react'
import { Brain, Crown, LogOut, Shuffle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { getPlayers } from '@/platform/players'
import { getCurrentPlayer, pickUnseen } from '@/platform/progress'
import { RemoteVoiceHint } from '@/platform/RemoteVoiceHint'
import {
  clearSubmissions,
  collectSubmissions,
  createRoom,
  hostSet,
  joinRoom,
  leaveRoom,
  memberSubmit,
  subscribeRoom,
  type CollectedSubmission,
  type RoomSnapshot,
} from '@/platform/rooms'
import { contentFor } from '@/platform/content'
import { ROLE_MAP } from './types'
import type { KnowQuestion } from './types'

function shuffle<T>(items: T[]) {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

interface RevealPayload {
  text?: string
  roleName?: string
  emoji?: string
  answer?: string
  round?: number
  guesses?: { seat: number; name: string; emoji: string; guess: string; correct: boolean }[]
  scores?: Record<string, number>
}

export function KnowYouRemote({ onBack }: { onBack: () => void }) {
  const me = useMemo(() => getPlayers().find((p) => p.id === getCurrentPlayer()), [])
  const [name, setName] = useState(me?.name ?? '')
  const emoji = me?.emoji ?? '🙂'

  const [code, setCode] = useState<string | null>(null)
  const [snap, setSnap] = useState<RoomSnapshot | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [guess, setGuess] = useState('')

  // 房主本地保存：当前题目（含答案，不进公共 payload）+ 累计分 + 轮次
  const [question, setQuestion] = useState<KnowQuestion | null>(null)
  const [scores, setScores] = useState<Record<number, number>>({})
  const [round, setRound] = useState(1)

  // 房主裁判态：本地展开「看大家答案」，勾对错
  const [judging, setJudging] = useState(false)
  const [collected, setCollected] = useState<CollectedSubmission[]>([])
  const [correctSet, setCorrectSet] = useState<Set<number>>(new Set())

  // 订阅房间：code 变化时建立轮询
  useEffect(() => {
    if (!code) return
    const unsub = subscribeRoom(code, setSnap)
    return unsub
  }, [code])

  const isHost = snap?.you?.is_host ?? false
  const members = snap?.members ?? []
  const hostSeat = members.find((m) => m.is_host)?.seat ?? -1
  const mySubmission = snap?.you?.submission as { guess?: string } | null | undefined

  const create = async () => {
    setBusy(true)
    setErr('')
    const c = await createRoom('knowYou', name.trim() || '房主', emoji)
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

  const nextQuestion = async (nextRound: number) => {
    if (!code) return
    setBusy(true)
    await clearSubmissions(code)
    const triviaQuestions = contentFor<KnowQuestion>('know-you', []).filter(
      (q) => q.kind === 'trivia' && q.answer,
    )
    const [picked = triviaQuestions[0]] = pickUnseen('knowYou:remote', shuffle(triviaQuestions), (q) => q.text, 1)
    setQuestion(picked)
    setRound(nextRound)
    setJudging(false)
    setCollected([])
    setCorrectSet(new Set())
    setGuess('')
    await hostSet(code, {
      state: 'playing',
      payload: {
        text: picked.text,
        emoji: picked.emoji,
        roleName: ROLE_MAP[picked.role].name,
        round: nextRound,
      },
    })
    setBusy(false)
  }

  const openJudging = async () => {
    if (!code) return
    setBusy(true)
    const subs = await collectSubmissions(code)
    const guesses = subs.filter(
      (s) => s.seat !== hostSeat && (s.submission as { guess?: string } | null)?.guess
    )
    setCollected(guesses)
    setCorrectSet(new Set())
    setJudging(true)
    setBusy(false)
  }

  const toggleCorrect = (seat: number) => {
    setCorrectSet((prev) => {
      const next = new Set(prev)
      if (next.has(seat)) next.delete(seat)
      else next.add(seat)
      return next
    })
  }

  const publish = async () => {
    if (!code || !question) return
    setBusy(true)
    const next = { ...scores }
    for (const seat of correctSet) next[seat] = (next[seat] ?? 0) + 1
    setScores(next)
    await hostSet(code, {
      state: 'reveal',
      payload: {
        text: question.text,
        roleName: ROLE_MAP[question.role].name,
        emoji: question.emoji,
        answer: question.answer,
        round,
        guesses: collected.map((c) => ({
          seat: c.seat,
          name: c.name,
          emoji: c.emoji,
          guess: (c.submission as { guess?: string } | null)?.guess ?? '',
          correct: correctSet.has(c.seat),
        })),
        scores: Object.fromEntries(Object.entries(next)),
      },
    })
    setJudging(false)
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
    setRound(1)
    setQuestion(null)
    setJudging(false)
    setCollected([])
    setCorrectSet(new Set())
    await hostSet(code, { state: 'lobby', payload: {} })
  }

  const doLeave = async () => {
    if (code) await leaveRoom(code)
    setCode(null)
    setSnap(null)
    setQuestion(null)
    setScores({})
    setRound(1)
    setJudging(false)
    setCollected([])
    setCorrectSet(new Set())
    setJoinCode('')
  }

  const submitGuess = async () => {
    if (!code) return
    const v = guess.trim()
    if (!v) {
      setErr('先写下你的猜测')
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
            <Brain className="h-5 w-5 text-melon-600" />
            远程我知道你
          </CardTitle>
          <CardDescription>各自用自己手机猜，房主出题当裁判。建个房，把房号告诉大家。</CardDescription>
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
            <Brain className="h-5 w-5 text-melon-600" />
            房号 <span className="font-mono tracking-[0.3em] text-orange-600">{code}</span>
          </CardTitle>
          <CardDescription>把房号告诉大家，人到齐房主就出第一道题。已经 {members.length} 人。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RemoteVoiceHint />
          {memberList}
          {isHost ? (
            <Button
              onClick={() => nextQuestion(1)}
              disabled={busy || members.length < 2}
              className="h-12 w-full gap-2 bg-orange-500 text-white hover:bg-orange-600"
            >
              <Shuffle className="h-4 w-4" />
              {members.length < 2 ? '至少 2 人才能开始' : '出第一道题'}
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

  // ── 答题阶段 ──────────────────────────────────────────────────────
  if (snap.state === 'playing') {
    const p = snap.payload as { text?: string; emoji?: string; roleName?: string; round?: number }
    const submitted = mySubmission?.guess != null
    const questionCard = (
      <div className="rounded-3xl border border-ink-100/70 bg-white/85 p-5 text-center">
        <div className="text-sm text-ink-500">关于「{p.roleName}」</div>
        <div className="mt-2 font-display text-xl text-ink-900">
          {p.emoji} {p.text}
        </div>
      </div>
    )

    // 房主裁判态：看大家的答案、勾对错、公布
    if (isHost && judging) {
      return (
        <Card className="paper-grid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Brain className="h-5 w-5 text-melon-600" />
              第 {p.round ?? 1} 题 · 谁答对了？
            </CardTitle>
            <CardDescription>对照答案，点「对/错」给每个人判分，判完点公布。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {questionCard}
            <div className="rounded-2xl border border-melon-300 bg-melon-50 p-4 text-center">
              <div className="text-xs font-semibold text-melon-600">参考答案</div>
              <div className="mt-1 text-base font-semibold text-ink-900">{question?.answer}</div>
            </div>
            {collected.length ? (
              <div className="space-y-2">
                {collected.map((c) => {
                  const ok = correctSet.has(c.seat)
                  return (
                    <div
                      key={c.seat}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-2 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span>{c.emoji}</span>
                        <span className="font-semibold text-ink-800">{c.name}：</span>
                        <span className="truncate text-ink-600">
                          {(c.submission as { guess?: string } | null)?.guess}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCorrect(c.seat)}
                        className={
                          'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ' +
                          (ok
                            ? 'border border-emerald-300 bg-emerald-100 text-emerald-700'
                            : 'border border-ink-200 bg-white text-ink-400')
                        }
                      >
                        {ok ? '对 ✓' : '错 ✗'}
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-3 text-center text-sm text-ink-500">
                还没人提交答案。
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-between gap-2">
            <Button variant="ghost" onClick={() => setJudging(false)} className="text-ink-500">
              ← 返回
            </Button>
            <Button onClick={publish} disabled={busy} className="gap-2">
              公布结果
            </Button>
          </CardFooter>
        </Card>
      )
    }

    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Brain className="h-5 w-5 text-melon-600" />
            第 {p.round ?? 1} 题 · 你知道吗？
          </CardTitle>
          <CardDescription>各自打字猜，只有你看得到自己写的。房主收齐就判分。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {questionCard}
          {isHost ? (
            <>
              <p className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-3 text-center text-sm text-ink-500">
                你是出题人，看着答案当裁判，不参与猜。
              </p>
              <div className="rounded-2xl border border-melon-300 bg-melon-50 p-4 text-center">
                <div className="text-xs font-semibold text-melon-600">答案（只有你看得到）</div>
                <div className="mt-1 text-base font-semibold text-ink-900">{question?.answer}</div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="guess">你的猜测</Label>
                  <input
                    id="guess"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitGuess()
                    }}
                    placeholder={submitted ? `已提交：${mySubmission?.guess}，可改` : '写下你的答案'}
                    maxLength={60}
                    className="h-12 w-full rounded-2xl border border-ink-200 px-3 text-base outline-none focus:border-melon-400"
                  />
                </div>
                <Button onClick={submitGuess} disabled={busy} className="h-12 shrink-0">
                  {submitted ? '改一下' : '提交'}
                </Button>
              </div>
              {submitted && <p className="text-sm text-emerald-600">已提交：{mySubmission?.guess}，可改</p>}
              {err && <p className="text-sm text-rose-500">{err}</p>}
            </>
          )}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-ink-500">
              已答 {snap.submittedCount}/{Math.max(members.length - 1, 0)} 人
            </div>
            {memberList}
          </div>
          {scoreboard((snap.payload.scores as Record<string, number>) ?? {})}
        </CardContent>
        <CardFooter className="justify-between">
          {leaveBtn}
          {isHost && (
            <Button onClick={openJudging} disabled={busy || snap.submittedCount === 0} className="gap-2">
              看大家的答案
            </Button>
          )}
        </CardFooter>
      </Card>
    )
  }

  // ── 公布 ─────────────────────────────────────────────────────────
  if (snap.state === 'reveal') {
    const p = snap.payload as RevealPayload
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Brain className="h-5 w-5 text-melon-600" />
            答案揭晓
          </CardTitle>
          <CardDescription>
            关于「{p.roleName}」：{p.emoji} {p.text}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-melon-300 bg-melon-50 p-4 text-center">
            <div className="text-xs font-semibold text-melon-600">正确答案</div>
            <div className="mt-1 text-base font-semibold text-ink-900">{p.answer}</div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-ink-500">大家的猜测</div>
            {(p.guesses ?? []).length ? (
              <div className="space-y-1.5">
                {(p.guesses ?? []).map((g) => (
                  <div
                    key={g.seat}
                    className={
                      'flex items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-sm ' +
                      (g.correct ? 'border-emerald-300 bg-emerald-50' : 'border-ink-100 bg-white')
                    }
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span>{g.emoji}</span>
                      <span className="font-semibold text-ink-800">{g.name}：</span>
                      <span className="truncate text-ink-600">{g.guess}</span>
                    </span>
                    <span className={'shrink-0 text-sm font-semibold ' + (g.correct ? 'text-emerald-600' : 'text-ink-400')}>
                      {g.correct ? '✓' : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-3 text-center text-sm text-ink-500">
                这题没人作答。
              </p>
            )}
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
              <Button onClick={() => nextQuestion((p.round ?? 1) + 1)} disabled={busy} className="gap-2">
                下一题
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
          <CardDescription>谁最懂这一家人？</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{scoreboard(p.scores ?? {}) ?? <p className="text-sm text-ink-500">还没有积分。</p>}</CardContent>
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
