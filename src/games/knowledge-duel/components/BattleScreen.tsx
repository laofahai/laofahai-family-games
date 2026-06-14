import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { subjectEmoji, subjectLabel } from '@/games/_battle/core'
import { battleCry, skillCry } from '@/games/_battle/cries'
import type { DuelAction } from '../engine'
import { CPU_ACCURACY } from '../constants'
import type { DuelConfig, DuelState } from '../types'
import { strikeToFx } from '../stageFx'
import { FighterCard } from './FighterCard'
import { DuelStage, type StageFx } from './DuelStage'

interface BattleScreenProps {
  state: DuelState
  config: DuelConfig
  dispatch: (a: DuelAction) => void
  onExit: () => void
}

// 各阶段动画/提示停留时长（毫秒）。
const RESOLVE_MS = 950
const TURNSWAP_MS = 850
const INTRO_MS = 1100
const CPU_THINK_MS = 1000
const REVEAL_MS = 480 // 选完到结算之间的「看对错」停留

/** 电脑「作答」：按命中率决定答对还是答错（答错时随机挑个错误选项）。 */
function cpuPick(state: DuelState, accuracy: number): string {
  const q = state.current
  if (!q) return ''
  if (Math.random() < accuracy) return q.answer
  const wrong = q.choices.filter((c) => c.id !== q.answer)
  if (wrong.length === 0) return q.answer
  return wrong[Math.floor(Math.random() * wrong.length)].id
}

/** 当前「这一题这一回合」的唯一键，用来把选择/锁定绑定到本次出招。 */
function turnKey(state: DuelState): string {
  return `${state.round}-${state.turn}-${state.qIndex}`
}

export function BattleScreen({ state, config, dispatch, onExit }: BattleScreenProps) {
  // picked 绑定到 turnKey：当 key 变了（新一轮出招）视为「未选」，无需在 effect 里 setState 清空。
  const [pick, setPick] = useState<{ key: string; choice: string } | null>(null)
  const key = turnKey(state)
  const picked = pick && pick.key === key ? pick.choice : null

  const lockedKeyRef = useRef<string | null>(null) // 已结算过的 key，防重复 dispatch

  const rightIsCpu = config.mode === 'cpu'
  const cpuTurn = rightIsCpu && state.turn === 'right'

  // —— 阶段定时推进（dispatch 都在 setTimeout 回调里，不在 effect 体同步 setState）——
  useEffect(() => {
    if (state.phase === 'intro') {
      const t = setTimeout(() => dispatch({ type: 'BEGIN' }), INTRO_MS)
      return () => clearTimeout(t)
    }
    if (state.phase === 'resolving') {
      const t = setTimeout(() => dispatch({ type: 'ADVANCE' }), RESOLVE_MS)
      return () => clearTimeout(t)
    }
    if (state.phase === 'turnswap') {
      const t = setTimeout(() => dispatch({ type: 'NEXT_TURN' }), TURNSWAP_MS)
      return () => clearTimeout(t)
    }
    return undefined
  }, [state.phase, state.round, state.turn, state.qIndex, dispatch])

  // —— 电脑回合：asking 阶段自动作答（先延时思考，再亮选项，再结算）——
  useEffect(() => {
    if (state.phase !== 'asking' || !cpuTurn || !state.current) return undefined
    if (lockedKeyRef.current === key) return undefined
    const choice = cpuPick(state, CPU_ACCURACY[config.cpuLevel])
    const tShow = setTimeout(() => setPick({ key, choice }), CPU_THINK_MS)
    const tAnswer = setTimeout(() => {
      if (lockedKeyRef.current === key) return
      lockedKeyRef.current = key
      dispatch({ type: 'ANSWER', choiceId: choice })
    }, CPU_THINK_MS + REVEAL_MS)
    return () => {
      clearTimeout(tShow)
      clearTimeout(tAnswer)
    }
    // state 完整对象会变，但只需在「该不该让电脑出手」相关字段变化时重跑。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, key, cpuTurn, config.cpuLevel])

  function handlePick(choiceId: string) {
    if (state.phase !== 'asking' || cpuTurn) return
    if (picked !== null || lockedKeyRef.current === key) return
    setPick({ key, choice: choiceId })
    setTimeout(() => {
      if (lockedKeyRef.current === key) return
      lockedKeyRef.current = key
      dispatch({ type: 'ANSWER', choiceId })
    }, REVEAL_MS)
  }

  const q = state.current
  const strike = state.lastStrike

  // 中二台词：每次出招（fxSeq 变）才重取一次，避免 resolving 期间重渲染抖动。
  const cryText = useMemo(() => {
    if (!strike) return null
    if (strike.crit) return battleCry('crit', config.band) ?? skillCry(strike.subject, config.band)
    if (strike.correct) return skillCry(strike.subject, config.band)
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fxSeq])

  // 每方动画状态。
  function animFor(side: 'left' | 'right'): 'idle' | 'attack' | 'hit' | 'crit' | 'down' {
    if (state.phase === 'resolving' && strike) {
      if (strike.attacker === side && strike.target === 'enemy') return 'attack'
      if (strike.victim === side) return strike.crit ? 'crit' : 'hit'
    }
    return 'idle'
  }

  const floatLeft =
    state.phase === 'resolving' && strike && strike.victim === 'left'
      ? { value: strike.damage, crit: strike.crit }
      : null
  const floatRight =
    state.phase === 'resolving' && strike && strike.victim === 'right'
      ? { value: strike.damage, crit: strike.crit }
      : null

  const turnName = state[state.turn].name
  // turnswap 时 state.turn 已指向「即将出招的下一方」。
  const nextName = state[state.turn].name
  const showQuestion = state.phase === 'asking' || state.phase === 'resolving'

  // Phaser 舞台：spawnKey 随 battleId（开局/再来一局）变化触发复位；fx 由 lastStrike 派生。
  const stageFx: StageFx | null = strike ? strikeToFx(strike, state.winner) : null
  const spawnKey = String(state.battleId)

  // 题库该年龄段/题型为空时，别卡在空棋盘（答题机器会空转）；给个友好提示。
  if (!state.current && state.phase !== 'over') {
    return (
      <div className="space-y-4">
        <div>
          <Button variant="outline" size="sm" onClick={onExit} className="gap-1">
            ← 返回
          </Button>
        </div>
        <div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
          这个年龄段 / 题型暂时没有题目，换个设置再来。
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onExit} className="gap-1">
          ← 返回
        </Button>
        <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-600">
          第 {state.round} 回合
        </span>
      </div>

      {/* Phaser 可视化舞台：两名角色面对面对轰 */}
      <div className="relative">
        <DuelStage
          spawnKey={spawnKey}
          left={{
            emoji: state.left.emoji,
            name: state.left.name,
            maxHp: state.left.maxHp,
            hp: state.left.hp,
          }}
          right={{
            emoji: state.right.emoji,
            name: state.right.name,
            maxHp: state.right.maxHp,
            hp: state.right.hp,
          }}
          fxSeq={state.fxSeq}
          fx={stageFx}
        />
        {/* 中二招式横幅：出招瞬间按学科喊招式名 / 暴击战吼 */}
        {state.phase === 'resolving' && cryText && (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-2">
            <div
              className={[
                'kd-banner rounded-2xl px-4 py-1.5 text-center font-display font-black shadow-xl',
                strike?.crit
                  ? 'bg-amber-400 text-ink-900 text-lg sm:text-2xl'
                  : 'bg-melon-600 text-white text-base sm:text-xl',
              ].join(' ')}
            >
              {cryText}
            </div>
          </div>
        )}
      </div>

      {/* 竞技场信息条（回合/连击/血量数字） */}
      <div className="relative rounded-3xl bg-gradient-to-b from-melon-50 to-sky-50 p-3 ring-1 ring-ink-100 sm:p-5">
        <div className="flex items-stretch gap-2 sm:gap-4">
          <FighterCard
            fighter={state.left}
            side="left"
            isTurn={state.turn === 'left' && state.phase !== 'over'}
            streak={state.streak.left}
            anim={animFor('left')}
            floatDmg={floatLeft}
          />
          <div className="flex flex-col items-center justify-center px-1">
            <span className="font-display text-2xl font-black text-ink-300 sm:text-3xl">VS</span>
          </div>
          <FighterCard
            fighter={state.right}
            side="right"
            isTurn={state.turn === 'right' && state.phase !== 'over'}
            streak={state.streak.right}
            anim={animFor('right')}
            floatDmg={floatRight}
          />
        </div>

        {/* 开场横幅 */}
        {state.phase === 'intro' && (
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-ink-900/30 backdrop-blur-[1px]">
            <div className="kd-banner rounded-2xl bg-white px-6 py-3 text-center shadow-xl">
              <div className="font-display text-2xl font-black text-melon-600">准备战斗！</div>
              <div className="mt-0.5 text-sm text-ink-600">
                {state.left.name} ⚔️ {state.right.name}
              </div>
            </div>
          </div>
        )}

        {/* 回合切换提示 */}
        {state.phase === 'turnswap' && (
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-ink-900/25">
            <div className="kd-banner rounded-2xl bg-white px-5 py-2.5 text-center shadow-xl">
              <div className="text-sm text-ink-500">轮到</div>
              <div className="font-display text-xl font-black text-ink-800">{nextName}</div>
            </div>
          </div>
        )}
      </div>

      {/* 题目区 */}
      {showQuestion && q && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-full bg-melon-100 px-3 py-1 text-xs font-bold text-melon-700">
              {subjectEmoji(q.subject)} {subjectLabel(q.subject)}
            </span>
            <span className="text-xs font-semibold text-ink-500">
              {cpuTurn ? '🤖 电脑思考中…' : `轮到 ${turnName} 出招`}
            </span>
          </div>

          <div className="rounded-3xl border border-ink-100 bg-white/90 p-4">
            <p className="text-center text-lg font-semibold leading-snug text-ink-900">
              {q.prompt}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {q.choices.map((c) => {
              const isPicked = picked === c.id
              const reveal = picked !== null
              const isAnswer = c.id === q.answer
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
                  disabled={picked !== null || cpuTurn}
                  onClick={() => handlePick(c.id)}
                  className={[
                    'min-h-12 rounded-2xl border px-4 text-left text-base font-medium transition',
                    cls,
                  ].join(' ')}
                >
                  {c.text}
                  {reveal && isAnswer && <span className="float-right">✅</span>}
                  {reveal && isPicked && !isAnswer && <span className="float-right">❌</span>}
                </button>
              )
            })}
          </div>

          {picked !== null && q.explanation && (
            <p className="rounded-2xl bg-ink-50 px-3 py-2 text-xs text-ink-600">💡 {q.explanation}</p>
          )}
        </div>
      )}

      {/* 战报 */}
      {state.log.length > 0 && (
        <div className="rounded-2xl border border-ink-100 bg-white/60 p-3">
          <div className="mb-1 text-xs font-bold text-ink-400">战报</div>
          <ul className="space-y-0.5">
            {state.log.map((line, i) => (
              <li
                key={`${key}-${i}`}
                className={i === 0 ? 'text-sm text-ink-700' : 'text-xs text-ink-400'}
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
