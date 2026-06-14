// 两真一假 · 远程模式：轮流当主角。主角在自己手机上私密写「2 真 1 假」并标出假话，
// 房主公布三句话（藏起哪句假）→ 其他人各自投票猜假话 → 揭晓 + 计分。轮一圈出总排名。
// 两阶段都用 member_submit（私密）：主角写句子、其他人投票；房主 collect 汇总算分。

import { useEffect, useMemo, useRef, useState } from 'react'
import { Crown, Eye, LogOut, Vote } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { contentFor } from '@/platform/content'
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
  type RoomSnapshot,
} from '@/platform/rooms'
import type { TruthTopic } from './types'

function shuffle<T>(items: readonly T[]) {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function TruthLieRemote({ onBack }: { onBack: () => void }) {
  const me = useMemo(() => getPlayers().find((p) => p.id === getCurrentPlayer()), [])
  const [name, setName] = useState(me?.name ?? '')
  const emoji = me?.emoji ?? '🙂'

  const [code, setCode] = useState<string | null>(null)
  const [snap, setSnap] = useState<RoomSnapshot | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // 主角写的三句话 + 标出哪句假
  const [s1, setS1] = useState('')
  const [s2, setS2] = useState('')
  const [s3, setS3] = useState('')
  const [liePick, setLiePick] = useState(0) // 1/2/3
  // 投票猜哪句假
  const [votePick, setVotePick] = useState(0)

  // 房主本地：轮次 + 累计分
  const [scores, setScores] = useState<Record<number, number>>({})

  const lastKeyRef = useRef('')
  useEffect(() => {
    if (!code) return
    const unsub = subscribeRoom(code, (next) => {
      // 进入新阶段/新主角时清掉本地输入（回调在轮询里异步触发，安全）
      const key = `${next.state}:${(next.payload.round as number) ?? 0}`
      if (key !== lastKeyRef.current) {
        lastKeyRef.current = key
        if (next.state === 'tell') {
          setS1('')
          setS2('')
          setS3('')
          setLiePick(0)
        }
        if (next.state === 'vote') setVotePick(0)
      }
      setSnap(next)
    })
    return unsub
  }, [code])

  const isHost = snap?.you?.is_host ?? false
  const mySeat = snap?.you?.seat ?? -1
  const members = snap?.members ?? []
  const tellerSeat = (snap?.payload.tellerSeat as number) ?? -1
  const tellerName = (snap?.payload.tellerName as string) ?? ''
  const iAmTeller = mySeat === tellerSeat

  const create = async () => {
    setBusy(true)
    setErr('')
    const c = await createRoom('truthLie', name.trim() || '房主', emoji)
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

  // 开一个主角轮：清空提交、出灵感话题、进 tell
  const startTellRound = async (roundNum: number, seat: number) => {
    if (!code) return
    setBusy(true)
    await clearSubmissions(code)
    const [topic] = pickUnseen('truthLie:topic', shuffle(contentFor<TruthTopic>('truth-lie', [])), (t) => t.text, 1)
    const who = members.find((m) => m.seat === seat)
    await hostSet(code, {
      state: 'tell',
      payload: { tellerSeat: seat, tellerName: who?.name ?? `${seat}号`, round: roundNum, topic: topic?.text ?? '' },
    })
    setBusy(false)
  }

  const start = async () => {
    if (members.length < 3) return
    await startTellRound(1, members[0].seat)
  }

  const toVote = async () => {
    if (!code) return
    setBusy(true)
    const subs = await collectSubmissions(code)
    const teller = subs.find((s) => s.seat === tellerSeat)
    const statements = (teller?.submission as { statements?: string[] } | null)?.statements ?? []
    await hostSet(code, {
      state: 'vote',
      payload: { ...snap?.payload, statements },
    })
    setBusy(false)
  }

  const reveal = async () => {
    if (!code) return
    setBusy(true)
    const subs = await collectSubmissions(code)
    const teller = subs.find((s) => s.seat === tellerSeat)
    const lieIndex = Number((teller?.submission as { lie?: number } | null)?.lie) || 0
    const voters = subs.filter((s) => s.seat !== tellerSeat && (s.submission as { vote?: number } | null)?.vote != null)
    const votes = voters.map((v) => ({
      seat: v.seat,
      name: v.name,
      emoji: v.emoji,
      vote: Number((v.submission as { vote?: number }).vote),
    }))
    // 计分：投中假话 +1；主角每骗过一人 +1
    const next = { ...scores }
    let fooled = 0
    for (const v of votes) {
      if (v.vote === lieIndex) next[v.seat] = (next[v.seat] ?? 0) + 1
      else fooled += 1
    }
    if (fooled > 0) next[tellerSeat] = (next[tellerSeat] ?? 0) + fooled
    setScores(next)
    await hostSet(code, {
      state: 'reveal',
      payload: {
        ...snap?.payload,
        lieIndex,
        votes,
        scores: Object.fromEntries(Object.entries(next)),
      },
    })
    setBusy(false)
  }

  const nextTeller = async () => {
    const round = (snap?.payload.round as number) ?? 1
    const nextIdx = round // 0-based 下一个 = round（当前 round 是 1-based）
    if (nextIdx >= members.length) {
      await finish()
      return
    }
    await startTellRound(round + 1, members[nextIdx].seat)
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
    await hostSet(code, { state: 'lobby', payload: {} })
  }

  const doLeave = async () => {
    if (code) await leaveRoom(code)
    setCode(null)
    setSnap(null)
    setScores({})
    setJoinCode('')
  }

  const submitStatements = async () => {
    if (!code) return
    if (!s1.trim() || !s2.trim() || !s3.trim()) {
      setErr('三句都要写上')
      return
    }
    if (liePick < 1 || liePick > 3) {
      setErr('标一下哪句是假的')
      return
    }
    setErr('')
    setBusy(true)
    await memberSubmit(code, { statements: [s1.trim(), s2.trim(), s3.trim()], lie: liePick })
    setBusy(false)
  }

  const submitVote = async () => {
    if (!code || votePick < 1) {
      setErr('选一句你觉得是假的')
      return
    }
    setErr('')
    setBusy(true)
    await memberSubmit(code, { vote: votePick })
    setBusy(false)
  }

  // ── 入口 ─────────────────────────────────────────────────────────
  if (!code || !snap) {
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Vote className="h-5 w-5 text-melon-600" />
            远程两真一假
          </CardTitle>
          <CardDescription>各自用自己手机，轮流写「2 真 1 假」，大家猜哪句是编的。建个房，把房号告诉大家。</CardDescription>
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
          className={
            'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ' +
            (m.seat === tellerSeat ? 'border-melon-400 bg-melon-50 text-melon-700' : 'border-ink-200 bg-white text-ink-700')
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

  const statementRows = (statements: string[], opts: { pick?: number; onPick?: (i: number) => void; lieIndex?: number }) => (
    <div className="space-y-2">
      {statements.map((text, i) => {
        const idx = i + 1
        const picked = opts.pick === idx
        const isLie = opts.lieIndex === idx
        return (
          <button
            key={idx}
            type="button"
            disabled={!opts.onPick}
            onClick={() => opts.onPick?.(idx)}
            className={
              'flex w-full items-start gap-3 rounded-2xl border p-3 text-left text-sm transition ' +
              (isLie
                ? 'border-rose-300 bg-rose-50 text-rose-700'
                : picked
                  ? 'border-melon-400 bg-melon-50 text-melon-700'
                  : 'border-ink-200 bg-white text-ink-700 ' + (opts.onPick ? 'hover:border-melon-300' : ''))
            }
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
              {idx}
            </span>
            <span className="flex-1">{text}</span>
            {isLie && <span className="text-xs font-semibold">假话 🤥</span>}
          </button>
        )
      })}
    </div>
  )

  // ── 大厅 ─────────────────────────────────────────────────────────
  if (snap.state === 'lobby') {
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Vote className="h-5 w-5 text-melon-600" />
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
              disabled={busy || members.length < 3}
              className="h-12 w-full gap-2 bg-orange-500 text-white hover:bg-orange-600"
            >
              {members.length < 3 ? '至少 3 人才能开始' : '开始（轮流当主角）'}
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

  // ── 主角写 2 真 1 假 ──────────────────────────────────────────────
  if (snap.state === 'tell') {
    const topic = (snap.payload.topic as string) ?? ''
    const submitted = (snap.you?.submission as { statements?: string[] } | null)?.statements != null
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Eye className="h-5 w-5 text-melon-600" />
            {iAmTeller ? '轮到你：写 2 真 1 假' : `${tellerName} 正在出题`}
          </CardTitle>
          <CardDescription>
            {iAmTeller ? '写三句关于你自己的话，两真一假，标出那句假的。' : '等主角写好，马上让你猜哪句是编的。'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {iAmTeller ? (
            <>
              {topic && <div className="rounded-2xl border border-ink-100 bg-white/70 p-3 text-xs text-ink-500">灵感：{topic}</div>}
              {[
                [s1, setS1],
                [s2, setS2],
                [s3, setS3],
              ].map(([val, setVal], i) => {
                const idx = i + 1
                const setter = setVal as (v: string) => void
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      value={val as string}
                      onChange={(e) => setter(e.target.value)}
                      placeholder={`第 ${idx} 句`}
                      maxLength={50}
                      className="h-12 flex-1 rounded-2xl border border-ink-200 px-3 text-sm outline-none focus:border-melon-400"
                    />
                    <button
                      type="button"
                      onClick={() => setLiePick(idx)}
                      className={
                        'min-h-12 shrink-0 rounded-2xl border px-3 text-xs font-semibold ' +
                        (liePick === idx ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-ink-200 text-ink-500')
                      }
                    >
                      {liePick === idx ? '这句假 🤥' : '标为假'}
                    </button>
                  </div>
                )
              })}
              {err && <p className="text-sm text-rose-500">{err}</p>}
              <Button onClick={submitStatements} disabled={busy} className="h-12 w-full">
                {submitted ? '改一下重交' : '提交，给大家猜'}
              </Button>
              {submitted && <p className="text-sm text-emerald-600">已提交，等房主开始投票…</p>}
            </>
          ) : (
            <p className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-4 text-center text-sm text-ink-500">
              ✍️ {tellerName} 正在编三句话…开着微信视频聊着等。
            </p>
          )}
          {memberList}
        </CardContent>
        <CardFooter className="justify-between">
          {leaveBtn}
          {isHost && (
            <Button onClick={toVote} disabled={busy || snap.submittedCount < 1} className="gap-2">
              大家来投票
            </Button>
          )}
        </CardFooter>
      </Card>
    )
  }

  // ── 投票猜假话 ────────────────────────────────────────────────────
  if (snap.state === 'vote') {
    const statements = (snap.payload.statements as string[]) ?? []
    const myVote = (snap.you?.submission as { vote?: number } | null)?.vote
    const votedCount = Math.max(snap.submittedCount - 1, 0) // 减去主角那条提交
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Vote className="h-5 w-5 text-melon-600" />
            猜猜 {tellerName} 哪句是假的
          </CardTitle>
          <CardDescription>{iAmTeller ? '你的题，大家在猜，等揭晓。' : '选出你觉得编的那一句。'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {iAmTeller ? (
            <>
              {statementRows(statements, {})}
              <p className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-3 text-center text-sm text-ink-500">
                你是主角，等大家投完票房主揭晓。
              </p>
            </>
          ) : (
            <>
              {statementRows(statements, { pick: votePick || myVote, onPick: (i) => setVotePick(i) })}
              {err && <p className="text-sm text-rose-500">{err}</p>}
              <Button onClick={submitVote} disabled={busy} className="h-12 w-full">
                {myVote ? '改投' : '就投这句是假的'}
              </Button>
              {myVote && <p className="text-sm text-emerald-600">已投：第 {myVote} 句。等其他人…</p>}
            </>
          )}
          <div className="text-xs font-semibold text-ink-500">已投票 {votedCount} 人</div>
          {scoreboard((snap.payload.scores as Record<string, number>) ?? {})}
        </CardContent>
        <CardFooter className="justify-between">
          {leaveBtn}
          {isHost && (
            <Button onClick={reveal} disabled={busy || votedCount < 1} className="gap-2">
              揭晓答案
            </Button>
          )}
        </CardFooter>
      </Card>
    )
  }

  // ── 揭晓 ─────────────────────────────────────────────────────────
  if (snap.state === 'reveal') {
    const statements = (snap.payload.statements as string[]) ?? []
    const lieIndex = (snap.payload.lieIndex as number) ?? 0
    const votes = (snap.payload.votes as { seat: number; name: string; emoji: string; vote: number }[]) ?? []
    const round = (snap.payload.round as number) ?? 1
    const isLast = round >= members.length
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Eye className="h-5 w-5 text-melon-600" />
            {tellerName} 的假话是第 {lieIndex} 句
          </CardTitle>
          <CardDescription>投中的 +1，主角每骗过一人 +1。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statementRows(statements, { lieIndex })}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-ink-500">大家的投票</div>
            <div className="flex flex-wrap gap-2">
              {votes.map((v) => {
                const right = v.vote === lieIndex
                return (
                  <span
                    key={v.seat}
                    className={
                      'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ' +
                      (right ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-ink-200 bg-white text-ink-500')
                    }
                  >
                    <span>{v.emoji}</span>
                    <span>{v.name}</span>
                    <span className="text-xs">猜第 {v.vote} 句 {right ? '✓' : '✗'}</span>
                  </span>
                )
              })}
              {votes.length === 0 && <span className="text-sm text-ink-400">没人投票</span>}
            </div>
          </div>
          {scoreboard((snap.payload.scores as Record<string, number>) ?? {})}
        </CardContent>
        <CardFooter className="justify-between gap-2">
          {leaveBtn}
          {isHost && (
            <Button onClick={nextTeller} disabled={busy} className="gap-2">
              {isLast ? '看总排名' : '下一位主角'}
            </Button>
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
          <CardDescription>谁最会编、谁最会猜？</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
