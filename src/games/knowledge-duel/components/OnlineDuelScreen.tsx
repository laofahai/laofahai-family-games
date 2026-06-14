// 知识对战 · 在线 PvP：各自用自己的手机，连到同一个 duel:<code> Realtime 频道。
// 房主建房得房号，对方输房号加入；presence 显示对手在场/掉线。各答各的题，每次作答
// 把结果广播给对手（见 online/protocol.ts 的权威规则），双屏血量保持同步。
//
// 状态管理：用 useState；所有 setState 都发生在「事件回调 / 定时器回调 / 收到消息回调」里，
// 不在 effect 体里同步 setState（遵守仓库 ESLint 约束）。Phaser 舞台经 DuelStage 用
// fxSeq 计数 + fx 描述命令式驱动，绝不从 effect 里 setState。

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { subjectEmoji, subjectLabel } from '@/games/_battle/core'
import type { Band, BattleQuestion } from '@/games/_battle/core'
import { drawQuestions } from '@/games/_battle/questions'
import { getPlayers } from '@/platform/players'
import { getCurrentPlayer } from '@/platform/progress'
import { RemoteVoiceHint } from '@/platform/RemoteVoiceHint'
import { DuelStage, type StageFx } from './DuelStage'
import { AVATARS, DEFAULT_HP, topicToDrawArgs, QUESTION_BATCH, BAND_LABEL, TOPIC_LABEL } from '../constants'
import type { TopicMode } from '../types'
import { joinDuelChannel, type DuelChannel, type DuelPresenceMeta } from '../online/channel'
import type { DuelMsg, HelloMsg } from '../online/protocol'
import {
  applyMyAnswer,
  applyPeerStrike,
  makeOnlineFighters,
  type OnlineFighters,
  type OnlineWinner,
} from '../online/engine'

type Stage = 'lobby' | 'waiting' | 'playing' | 'over'
type ConnStatus = 'idle' | 'connecting' | 'connected' | 'opponent-left'

const REVEAL_MS = 480 // 选完到结算之间「看对错」停留

function genCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000)) // 4 位房号
}
function genUid(): string {
  return Math.random().toString(36).slice(2, 10)
}

interface OnlineDuelScreenProps {
  onExit: () => void
}

export function OnlineDuelScreen({ onExit }: OnlineDuelScreenProps) {
  const me = useMemo(() => getPlayers().find((p) => p.id === getCurrentPlayer()), [])
  const uid = useMemo(genUid, [])

  const [name, setName] = useState(me?.name ?? '玩家')
  const [emoji, setEmoji] = useState(me?.emoji ?? '🦊')

  // 房间规则（host 选；guest 从 hello 采纳）
  const [band, setBand] = useState<Band>('low')
  const [topic, setTopic] = useState<TopicMode>('mix')

  const [stage, setStage] = useState<Stage>('lobby')
  const [conn, setConn] = useState<ConnStatus>('idle')
  const [code, setCode] = useState<string | null>(null)
  const [joinInput, setJoinInput] = useState('')
  const [role, setRole] = useState<'host' | 'guest'>('host')
  const [err, setErr] = useState('')

  const [opp, setOpp] = useState<DuelPresenceMeta | null>(null)
  const [fighters, setFighters] = useState<OnlineFighters | null>(null)
  const [winner, setWinner] = useState<OnlineWinner>(null)

  // 出招动画驱动
  const [fxSeq, setFxSeq] = useState(0)
  const [fx, setFx] = useState<StageFx | null>(null)
  const [battleId, setBattleId] = useState(1)

  // 我的题集 / 当前题 / 连对
  const [queue, setQueue] = useState<BattleQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const [oppStreak, setOppStreak] = useState(0)
  const [log, setLog] = useState<string[]>([])

  const chanRef = useRef<DuelChannel | null>(null)
  // 用 ref 镜像最新值，供 onMessage/onPresence 回调读（这些回调闭包在 code 建立时定格，不随渲染更新）
  const fightersRef = useRef<OnlineFighters | null>(null)
  fightersRef.current = fighters
  const stageRef = useRef<Stage>(stage)
  stageRef.current = stage
  const oppRef = useRef<DuelPresenceMeta | null>(null)
  oppRef.current = opp
  const startedRef = useRef(false) // 防重复开打
  const ruleRef = useRef({ band, topic })
  ruleRef.current = { band, topic }

  const current = queue[qIndex] ?? null
  const oppPresent = conn === 'connected'

  // ── 频道生命周期：进入 waiting/playing（有 code）就连，卸载/离开断开 ──
  useEffect(() => {
    if (!code) return
    setConn('connecting')
    const ch = joinDuelChannel({
      code,
      me: { uid, name: name.trim() || '玩家', emoji, role },
      onMessage: (msg) => handleMessage(msg),
      onPresence: (peers) => handlePresence(peers),
    })
    chanRef.current = ch
    if (!ch.enabled) {
      setConn('idle')
      setErr('没连上后端：在线对战需要配置 Supabase。可改用同屏热座。')
    }
    return () => {
      ch.send({ t: 'bye', uid })
      ch.leave()
      chanRef.current = null
    }
    // 只在 code 建立时连一次；name/emoji 在连接前已定。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  // ── presence：对手进/退场 → 连接状态；host 见对手到齐就开打 ──
  function handlePresence(peers: DuelPresenceMeta[]) {
    const other = peers.find((p) => p.uid !== uid)
    if (other) {
      setOpp(other)
      setConn('connected')
      // host 一旦看到 guest 在场，就握手开打（hello 带规则）
      if (role === 'host' && !startedRef.current) {
        startedRef.current = true
        const hello: HelloMsg = {
          t: 'hello',
          uid,
          name: name.trim() || '玩家',
          emoji,
          band: ruleRef.current.band,
          topic: ruleRef.current.topic,
          maxHp: DEFAULT_HP,
        }
        chanRef.current?.send(hello)
        beginBattle({ name: other.name, emoji: other.emoji }, ruleRef.current.band, ruleRef.current.topic, DEFAULT_HP)
        chanRef.current?.send({ t: 'start' })
      }
    } else {
      setOpp(null)
      // 对手退场：对局中提示掉线
      if (stageRef.current === 'playing' || stageRef.current === 'waiting') {
        setConn('opponent-left')
      }
    }
  }

  // ── 收到对手消息 ──
  function handleMessage(msg: DuelMsg) {
    switch (msg.t) {
      case 'hello': {
        // guest 采纳 host 的规则并开打
        if (startedRef.current) return
        startedRef.current = true
        setBand(msg.band)
        setTopic(msg.topic)
        // 回握，让 host 知道我的名字/头像（host 已从 presence 拿到，这里冗余兜底）
        chanRef.current?.send({ t: 'hi', uid, name: name.trim() || '玩家', emoji })
        beginBattle({ name: msg.name, emoji: msg.emoji }, msg.band, msg.topic, msg.maxHp)
        break
      }
      case 'hi': {
        setOpp((prev) => prev ?? { uid: msg.uid, name: msg.name, emoji: msg.emoji, role: 'guest' })
        break
      }
      case 'start':
        // host 已在 beginBattle 里进 playing；guest 在 hello 里也进了。这里冗余。
        break
      case 'strike': {
        const f = fightersRef.current
        if (!f) return
        const r = applyPeerStrike(f, msg)
        setFighters(r.fighters)
        setOppStreak(msg.streak)
        playFx(r.fx)
        pushLog(strikeLine(oppRef.current?.name ?? '对手', msg))
        if (r.winner) finish(r.winner)
        break
      }
      case 'down': {
        // 兜底：对手宣告自己倒下 → 我赢
        finish('me')
        break
      }
      case 'rematch': {
        // host 发起再来一局：guest 重置
        startedRef.current = true
        const o = oppRef.current
        if (o) beginBattle({ name: o.name, emoji: o.emoji }, ruleRef.current.band, ruleRef.current.topic, DEFAULT_HP)
        break
      }
      case 'bye': {
        if (stageRef.current === 'playing') setConn('opponent-left')
        setOpp(null)
        break
      }
    }
  }

  // ── 开打：抽我的题、建双方、进 playing ──
  function beginBattle(
    oppSpec: { name: string; emoji: string },
    b: Band,
    t: TopicMode,
    maxHp: number
  ) {
    const args = topicToDrawArgs(t)
    const q = drawQuestions({ band: b, count: QUESTION_BATCH, ...args })
    setQueue(q)
    setQIndex(0)
    setPicked(null)
    setStreak(0)
    setOppStreak(0)
    setLog([])
    setWinner(null)
    setFighters(makeOnlineFighters({ name: name.trim() || '玩家', emoji }, oppSpec, maxHp))
    setBattleId((n) => n + 1)
    setStage('playing')
    setConn('connected')
  }

  function playFx(next: StageFx) {
    setFx(next)
    setFxSeq((n) => n + 1)
  }

  function pushLog(line: string) {
    setLog((prev) => [line, ...prev].slice(0, 6))
  }

  function finish(w: OnlineWinner) {
    setWinner(w)
    setStage('over')
  }

  // ── 我作答：先亮对错，再结算+广播 ──
  function handlePick(choiceId: string) {
    if (stage !== 'playing' || picked !== null || !current || !fighters) return
    if (winner) return
    setPicked(choiceId)
    const correct = choiceId === current.answer
    setTimeout(() => {
      const f = fightersRef.current
      if (!f) return
      const r = applyMyAnswer(f, correct, streak, uid)
      setFighters(r.fighters)
      setStreak(r.correct ? streak + 1 : 0)
      playFx(r.fx)
      chanRef.current?.send(r.msg)
      pushLog(myLine(current, r.correct, r.crit, r.damage))
      if (r.winner) {
        if (r.winner === 'opp') chanRef.current?.send({ t: 'down', uid })
        finish(r.winner)
      } else {
        // 进入下一题
        setTimeout(() => {
          setPicked(null)
          setQIndex((i) => (i + 1 < queue.length ? i + 1 : 0))
        }, 650)
      }
    }, REVEAL_MS)
  }

  // ── 建房 / 加入 ──
  function host() {
    setRole('host')
    startedRef.current = false
    const c = genCode()
    setCode(c)
    setStage('waiting')
    setErr('')
  }
  function join() {
    const c = joinInput.replace(/\D/g, '')
    if (c.length < 3) {
      setErr('房号至少 3 位')
      return
    }
    setRole('guest')
    startedRef.current = false
    setCode(c)
    setStage('waiting')
    setErr('')
  }
  function leave() {
    chanRef.current?.send({ t: 'bye', uid })
    chanRef.current?.leave()
    chanRef.current = null
    setCode(null)
    setStage('lobby')
    setConn('idle')
    setOpp(null)
    setFighters(null)
    setWinner(null)
    setJoinInput('')
    startedRef.current = false
  }
  function rematch() {
    if (role !== 'host' || !opp) return
    startedRef.current = true
    chanRef.current?.send({ t: 'rematch' })
    beginBattle({ name: opp.name, emoji: opp.emoji }, ruleRef.current.band, ruleRef.current.topic, DEFAULT_HP)
  }

  // —————————————————————————————————————————————————————————————
  // 渲染
  // —————————————————————————————————————————————————————————————

  if (stage === 'lobby') {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={onExit}>
          ← 返回
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>🌐 在线对战</CardTitle>
            <CardDescription>各用各的手机，连同一个房号对轰。建房或输房号加入。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RemoteVoiceHint />
            <div className="space-y-2">
              <div className="text-xs font-semibold text-ink-500">你的名字</div>
              <input
                value={name}
                maxLength={8}
                onChange={(e) => setName(e.target.value)}
                placeholder="起个名字"
                className="min-h-12 w-full rounded-2xl border border-ink-200 bg-white px-3 text-base outline-none focus:border-melon-400"
              />
              <div className="grid grid-cols-8 gap-1.5">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setEmoji(a)}
                    className={[
                      'flex aspect-square items-center justify-center rounded-xl text-2xl transition',
                      a === emoji ? 'bg-melon-500 ring-2 ring-melon-600' : 'bg-ink-50 hover:bg-ink-100',
                    ].join(' ')}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1.5 text-xs font-semibold text-ink-500">年龄段（房主定）</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {(['low', 'high'] as Band[]).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBand(b)}
                      className={[
                        'min-h-10 rounded-xl border px-2 text-xs font-semibold transition',
                        band === b ? 'border-melon-500 bg-melon-500 text-white' : 'border-ink-200 bg-white text-ink-700',
                      ].join(' ')}
                    >
                      {BAND_LABEL[b]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-semibold text-ink-500">题型（房主定）</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {(['learn', 'fun', 'mix'] as TopicMode[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTopic(t)}
                      className={[
                        'min-h-10 rounded-xl border px-2 text-xs font-semibold transition',
                        topic === t ? 'border-melon-500 bg-melon-500 text-white' : 'border-ink-200 bg-white text-ink-700',
                      ].join(' ')}
                    >
                      {TOPIC_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button size="lg" className="min-h-12 w-full" onClick={host}>
              👑 我来建房
            </Button>
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <div className="h-px flex-1 bg-ink-100" />
              或加入别人的房
              <div className="h-px flex-1 bg-ink-100" />
            </div>
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') join()
                }}
                placeholder="输房号"
                maxLength={6}
                className="min-h-12 flex-1 rounded-2xl border border-ink-200 px-3 text-center text-lg tracking-widest outline-none focus:border-melon-400"
              />
              <Button variant="outline" className="min-h-12" onClick={join}>
                加入
              </Button>
            </div>
            {err && <p className="text-sm text-rose-500">{err}</p>}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (stage === 'waiting') {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>
              房号 <span className="font-mono tracking-[0.3em] text-melon-600">{code}</span>
            </CardTitle>
            <CardDescription>
              {role === 'host' ? '把房号告诉对手，TA 加入后自动开打。' : '已加入，等房主开始…'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ConnBadge conn={conn} opp={opp} />
            {err && <p className="text-sm text-rose-500">{err}</p>}
            <Button variant="ghost" className="w-full" onClick={leave}>
              退出房间
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // playing / over
  const meFighter = fighters?.me
  const oppFighter = fighters?.opp
  const showQuestion = stage === 'playing' && !winner && current

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={leave}>
          ← 退出
        </Button>
        <ConnBadge conn={conn} opp={opp} compact />
      </div>

      {fighters && (
        <DuelStage
          spawnKey={String(battleId)}
          left={{
            emoji: meFighter!.emoji,
            name: `${meFighter!.name}（你）`,
            maxHp: meFighter!.maxHp,
            hp: meFighter!.hp,
          }}
          right={{
            emoji: oppFighter!.emoji,
            name: oppFighter!.name,
            maxHp: oppFighter!.maxHp,
            hp: oppFighter!.hp,
          }}
          fxSeq={fxSeq}
          fx={fx}
        />
      )}

      {/* 血量/连击信息条 */}
      {fighters && (
        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-sky-50 to-melon-50 p-3 ring-1 ring-ink-100">
          <SidePill f={meFighter!} streak={streak} you accent="text-sky-600" />
          <span className="font-display text-xl font-black text-ink-300">VS</span>
          <SidePill f={oppFighter!} streak={oppStreak} accent="text-rose-600" />
        </div>
      )}

      {conn === 'opponent-left' && stage === 'playing' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-700">
          ⚠️ 对手掉线了，等 TA 回来，或退出房间。
        </div>
      )}

      {/* 题目区（只答我自己的题） */}
      {showQuestion && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-full bg-melon-100 px-3 py-1 text-xs font-bold text-melon-700">
              {subjectEmoji(current.subject)} {subjectLabel(current.subject)}
            </span>
            <span className="text-xs font-semibold text-ink-500">轮到你答题 · 越快越多击</span>
          </div>
          <div className="rounded-3xl border border-ink-100 bg-white/90 p-4">
            <p className="text-center text-lg font-semibold leading-snug text-ink-900">{current.prompt}</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {current.choices.map((c) => {
              const isPicked = picked === c.id
              const reveal = picked !== null
              const isAnswer = c.id === current.answer
              let cls = 'border-ink-200 bg-white text-ink-800 hover:bg-ink-50 active:scale-[0.99]'
              if (reveal) {
                if (isAnswer) cls = 'border-emerald-500 bg-emerald-50 text-emerald-700 kd-pulse-good'
                else if (isPicked) cls = 'border-rose-500 bg-rose-50 text-rose-700'
                else cls = 'border-ink-100 bg-white/60 text-ink-400'
              }
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={picked !== null}
                  onClick={() => handlePick(c.id)}
                  className={['min-h-12 rounded-2xl border px-4 text-left text-base font-medium transition', cls].join(' ')}
                >
                  {c.text}
                  {reveal && isAnswer && <span className="float-right">✅</span>}
                  {reveal && isPicked && !isAnswer && <span className="float-right">❌</span>}
                </button>
              )
            })}
          </div>
          {picked !== null && current.explanation && (
            <p className="rounded-2xl bg-ink-50 px-3 py-2 text-xs text-ink-600">💡 {current.explanation}</p>
          )}
        </div>
      )}

      {/* 结果 */}
      {stage === 'over' && winner && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-b from-amber-100 to-melon-50 p-6 text-center">
            <div className="kd-trophy mx-auto mb-2 text-6xl">
              {winner === 'me' ? '🏆' : winner === 'draw' ? '🤝' : '😤'}
            </div>
            <div className="font-display text-2xl font-black text-ink-900">
              {winner === 'me' ? '你赢了！' : winner === 'draw' ? '同归于尽，平局！' : `${opp?.name ?? '对手'} 赢了`}
            </div>
          </div>
          <CardContent className="space-y-2 pt-4">
            {role === 'host' && oppPresent && (
              <Button className="min-h-12 w-full" onClick={rematch}>
                🔁 再来一局
              </Button>
            )}
            {role === 'guest' && (
              <p className="text-center text-sm text-ink-500">等房主再开一局…</p>
            )}
            <Button variant="outline" className="min-h-12 w-full" onClick={leave}>
              退出房间
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 战报 */}
      {log.length > 0 && stage === 'playing' && (
        <div className="rounded-2xl border border-ink-100 bg-white/60 p-3">
          <div className="mb-1 text-xs font-bold text-ink-400">战报</div>
          <ul className="space-y-0.5">
            {log.map((line, i) => (
              <li key={i} className={i === 0 ? 'text-sm text-ink-700' : 'text-xs text-ink-400'}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── 小组件 ──────────────────────────────────────────────────────────
function ConnBadge({
  conn,
  opp,
  compact,
}: {
  conn: ConnStatus
  opp: DuelPresenceMeta | null
  compact?: boolean
}) {
  const map: Record<ConnStatus, { text: string; cls: string }> = {
    idle: { text: '未连接', cls: 'bg-ink-100 text-ink-500' },
    connecting: { text: '连接中…', cls: 'bg-amber-100 text-amber-700' },
    connected: { text: opp ? `已连上 ${opp.emoji}${opp.name}` : '等待对手', cls: 'bg-emerald-100 text-emerald-700' },
    'opponent-left': { text: '对手掉线', cls: 'bg-rose-100 text-rose-700' },
  }
  const s = map[conn]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${compact ? 'text-[11px]' : 'text-xs'} font-semibold ${s.cls}`}>
      <span className="inline-block h-2 w-2 rounded-full bg-current opacity-70" />
      {s.text}
    </span>
  )
}

function SidePill({
  f,
  streak,
  you,
  accent,
}: {
  f: OnlineFighters['me']
  streak: number
  you?: boolean
  accent: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl">{f.emoji}</span>
      <div>
        <div className={`text-xs font-bold ${accent}`}>
          {f.name}
          {you ? '（你）' : ''}
          {streak >= 2 && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">🔥{streak}</span>}
        </div>
        <div className="text-[11px] font-semibold text-ink-500">
          HP {f.hp}/{f.maxHp}
        </div>
      </div>
    </div>
  )
}

// ── 战报文案 ────────────────────────────────────────────────────────
function myLine(q: BattleQuestion, correct: boolean, crit: boolean, dmg: number): string {
  const subj = subjectLabel(q.subject)
  if (correct) {
    return crit
      ? `💥 你连对暴击！[${subj}] 重创对手 ${dmg} 点`
      : `✅ 你答对 [${subj}]，击中对手（-${dmg}）`
  }
  return `❌ 你答错 [${subj}]，露破绽自损 ${dmg} 点`
}

function strikeLine(
  oppName: string,
  msg: { correct: boolean; crit: boolean; damage: number; target: 'enemy' | 'self' }
): string {
  if (msg.correct) {
    return msg.crit
      ? `💥 ${oppName} 连对暴击！重创你 ${msg.damage} 点`
      : `⚔️ ${oppName} 答对，击中你（-${msg.damage}）`
  }
  return `😌 ${oppName} 答错自损 ${msg.damage} 点`
}
