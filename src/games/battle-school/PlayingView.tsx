// 单局视图：持有 reducer（全部逻辑）与 Phaser 舞台。gameKey 重挂即重置一切。
// fx effect 只命令 Phaser 播动画，绝不 setState。
//
// 多人共斗：传入 coop（room + me）即进入共斗模式——共享 Boss 血量由 host 权威覆盖，
// 每个人答各自年级的题、各自上报伤害、一起推进。编排在 useCoopBattle 里（事件/消息回调，不在 effect 同步 dispatch）。

import { useEffect, useMemo, useReducer, useRef } from 'react'
import type { Game } from 'phaser'
import { PhaserHost } from '@/games/_battle/PhaserHost'
import { isDown, resolveAnswer } from '@/games/_battle/core'
import { rosterFor } from '@/games/_battle/roster'
import { skillCry, battleCry } from '@/games/_battle/cries'
import { BattleScene } from './scene'
import {
  gameReducer,
  initGame,
  currentIsBoss,
  currentBoss,
  DISS_DAMAGE,
  FITNESS_PASS_DAMAGE,
  ENCOUNTER_WIN_DAMAGE,
} from './reducer'
import { saveLevel } from './storage'
import { BackBar } from './components/BackBar'
import { HpBar } from './components/HpBar'
import { QuestionOverlay } from './components/QuestionOverlay'
import { EncounterOverlay } from './components/EncounterOverlay'
import { DissOverlay } from './components/DissOverlay'
import { FitnessOverlay } from './components/FitnessOverlay'
import { ResultFlash } from './components/ResultFlash'
import { LostScreen } from './components/LostScreen'
import { VictoryScreen } from './components/VictoryScreen'
import { PlayerList } from './components/CoopLobby'
import { useCoopBattle } from './useCoopBattle'
import type { CoopMe, UseCoopRoom } from './useCoopRoom'

export interface CoopProp {
  room: UseCoopRoom
  me: CoopMe
}

export function PlayingView({
  player,
  startLevel,
  coop,
  onExit,
  onBackToStart,
}: {
  player: string
  startLevel: number
  coop?: CoopProp
  onExit: () => void
  onBackToStart: () => void
}) {
  const roster = rosterFor(player)
  const totalLevels = roster.bosses.length
  const isCoop = coop != null

  const [state, dispatch] = useReducer(
    gameReducer,
    { player, startLevel, coop: isCoop },
    (args) => initGame(args)
  )

  const sceneRef = useRef<BattleScene | null>(null)
  const lastFxSeqRef = useRef<number>(-1)
  const lastSavedRef = useRef<number>(-1)
  const lastReportedHpRef = useRef<number>(-1)
  // 每个挑战只允许作答一次：防快速双击重复上报伤害（共斗时 host 会重复扣共享血）。
  // 键用 levelIndex:stepIndex（每步只有一个挑战，作答后 ADVANCE 推进步骤 → 键变化 → 自然解锁）。
  const actedKeyRef = useRef<string | null>(null)

  // 共斗编排：上报命中 / host 算账 / 同步推进。非共斗时 coopBattle 不被使用。
  const coopBattle = useCoopBattle({
    state,
    dispatch,
    room: coop?.room ?? FALLBACK_ROOM,
    me: coop?.me ?? FALLBACK_ME,
  })

  // fx → Phaser 动画（命令式，不 setState）
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    if (state.fxSeq === lastFxSeqRef.current) return
    lastFxSeqRef.current = state.fxSeq
    const fx = state.fx
    if (!fx) return
    switch (fx.kind) {
      case 'spawn':
        scene.spawnEnemy(fx.enemyEmoji ?? '🙂', fx.enemyName ?? '', fx.isBoss)
        break
      case 'hero-attack':
        scene.playHit('hero', fx.attack ?? 'slap', { crit: fx.crit, damage: fx.damage })
        // 单人：本地敌人血空就倒地。共斗：敌人血由共享态决定，倒地交给 spawn/advance 时机，这里不强行倒。
        if (!isCoop && isDown(state.enemy)) window.setTimeout(() => sceneRef.current?.playDown('enemy'), 560)
        break
      case 'enemy-attack':
        scene.playHit('enemy', fx.attack ?? 'slap', { damage: fx.damage })
        break
      case 'diss':
        scene.playDiss(fx.text ?? '哼！', fx.damage)
        if (!isCoop && isDown(state.enemy)) window.setTimeout(() => sceneRef.current?.playDown('enemy'), 700)
        break
      case 'peer-hit':
        scene.playPeerHit(fx.byName ?? '队友', fx.damage, fx.crit)
        break
      default:
        break
    }
  }, [state.fxSeq, state.fx, state.enemy, state.hero, isCoop])

  // 共斗：敌人共享血归零时播倒地（与 host 推进解耦，纯视觉）
  useEffect(() => {
    if (!isCoop) return
    if (state.enemy.hp <= 0 && state.phase === 'playing') {
      const id = window.setTimeout(() => sceneRef.current?.playDown('enemy'), 120)
      return () => window.clearTimeout(id)
    }
  }, [isCoop, state.enemy.hp, state.phase])

  // 共斗：自己血量变化时上报给 host（更新名单 + 团灭显示）。在 effect 里仅做网络上报（非 setState），允许。
  useEffect(() => {
    if (!isCoop || !coop) return
    if (state.hero.hp === lastReportedHpRef.current) return
    lastReportedHpRef.current = state.hero.hp
    coop.room.reportHp(state.hero.hp, isDown(state.hero))
  }, [isCoop, coop, state.hero])

  // 持久化「已闯到第几关」（单人才存；共斗共享进度不写本地存档）
  useEffect(() => {
    if (isCoop) return
    const reached = state.phase === 'won' ? totalLevels : state.levelIndex
    if (reached !== lastSavedRef.current) {
      lastSavedRef.current = reached
      saveLevel(player, reached)
    }
  }, [isCoop, state.phase, state.levelIndex, totalLevels, player])

  function handleReady(game: Game) {
    const scene = game.scene.getScene('battle') as BattleScene | null
    sceneRef.current = scene
    if (scene) {
      lastFxSeqRef.current = state.fxSeq // 初始 spawn fx 已在此手动播，避免 effect 重播
      scene.spawnEnemy(state.enemy.emoji, state.enemy.name, currentIsBoss(state))
    }
  }

  const locked = state.lastResult != null
  const onBoss = currentIsBoss(state)

  // 中二招式名：答对出招按当前题目【学科】喊招式名；暴击/损人另有战吼。每次出招(fxSeq 变)才取一次。
  const cryText = useMemo(() => {
    const fx = state.fx
    if (!fx) return null
    if (fx.kind === 'hero-attack') {
      if (fx.crit) return battleCry('crit', state.band)
      return state.challenge.type === 'question' ? skillCry(state.challenge.question.subject, state.band) : null
    }
    if (fx.kind === 'diss') return battleCry('taunt', state.band)
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fxSeq])

  // ── 作答处理：共斗时除了本地结算，还要上报伤害给 host ──────────────────
  // 每个挑战只放行一次作答；已作答（含已出结果）则吞掉重复点击，避免双击重复上报/重复 dispatch。
  function claimChallenge(): boolean {
    if (locked) return false // 已有结算反馈：当前挑战已作答
    const key = `${state.levelIndex}:${state.stepIndex}`
    if (actedKeyRef.current === key) return false
    actedKeyRef.current = key
    return true
  }

  function handleAnswer(choiceId: string) {
    if (!claimChallenge()) return
    if (isCoop && state.challenge.type === 'question') {
      const correct = choiceId === state.challenge.question.answer
      if (correct) {
        const res = resolveAnswer(true, state.streak)
        coopBattle.reportHit(res.damage, res.crit)
      }
    }
    dispatch({ type: 'ANSWER', choiceId })
  }

  function handleEncounter(optionId: string) {
    if (!claimChallenge()) return
    if (isCoop && state.challenge.type === 'encounter') {
      const opt = state.challenge.encounter.options.find((o) => o.id === optionId)
      if (opt && (opt.outcome === 'win' || opt.outcome === 'funny')) {
        coopBattle.reportHit(ENCOUNTER_WIN_DAMAGE, false)
      }
    }
    dispatch({ type: 'PICK_ENCOUNTER', optionId })
  }

  function handleDiss(text: string) {
    if (!claimChallenge()) return
    if (isCoop) coopBattle.reportHit(DISS_DAMAGE, false)
    dispatch({ type: 'DISS', text, band: state.band })
  }

  function handleFitness(passed: boolean, reps: number) {
    if (!claimChallenge()) return
    if (isCoop && passed) coopBattle.reportHit(FITNESS_PASS_DAMAGE, true)
    dispatch({ type: 'FITNESS_DONE', passed, reps })
  }

  if (state.phase === 'won') {
    return (
      <div className="space-y-4">
        <BackBar onExit={onExit} />
        {isCoop ? (
          <CoopVictory players={coop?.room.players ?? []} onRestart={onBackToStart} onExit={onExit} />
        ) : (
          <VictoryScreen roster={roster} playerName={roster.player} onRestart={onBackToStart} onExit={onExit} />
        )}
      </div>
    )
  }
  if (state.phase === 'lost') {
    return (
      <div className="space-y-4">
        <BackBar onExit={onExit} />
        <LostScreen
          levelIndex={state.levelIndex}
          totalLevels={totalLevels}
          onRetry={() => dispatch({ type: 'RESTART' })}
          onExit={onBackToStart}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <BackBar onExit={onExit} />

      {/* 顶部状态：双方血条 + 关卡进度 */}
      <div className="flex items-start justify-between gap-3">
        <HpBar fighter={state.hero} align="left" accent="emerald" />
        <div className="flex flex-col items-center pt-1 text-center">
          <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-bold text-ink-700">
            第 {state.levelIndex + 1} / {totalLevels} 关
          </span>
          {onBoss ? (
            <span className="mt-1 text-xs font-semibold text-rose-600">👑 BOSS {currentBoss(state).name}</span>
          ) : (
            <span className="mt-1 text-xs text-ink-500">同学小怪</span>
          )}
          {isCoop && (
            <span className="mt-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
              共斗 · 房号 {coop?.room.code}
            </span>
          )}
        </div>
        <HpBar fighter={state.enemy} align="right" accent="rose" boss={onBoss} />
      </div>

      {/* 共斗：在线队友名单 */}
      {isCoop && coop && coop.room.players.length > 0 && (
        <PlayerList players={coop.room.players} currentEnemyName={state.enemy.name} />
      )}

      {/* Phaser 舞台 + 浮层 */}
      <div className="relative">
        <PhaserHost
          width={800}
          height={450}
          scene={BattleScene}
          onReady={handleReady}
          className="mx-auto aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-3xl shadow-sm"
        />

        {/* 中二招式名横幅：出招瞬间按学科喊招式名 / 暴击·损人战吼 */}
        {state.lastResult?.ok && cryText && (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-3">
            <div className="rounded-2xl bg-rose-600/95 px-4 py-1.5 text-center font-display text-base font-black text-white shadow-xl sm:text-xl">
              {cryText}
            </div>
          </div>
        )}

        {/* 浮层：结算反馈优先，否则当前挑战 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-2 sm:p-4">
          {state.lastResult ? (
            <ResultFlash result={state.lastResult} onNext={() => dispatch({ type: 'CLEAR_RESULT' })} />
          ) : state.challenge.type === 'question' ? (
            <QuestionOverlay
              question={state.challenge.question}
              streak={state.streak}
              locked={locked}
              onAnswer={handleAnswer}
              onTimeout={() => dispatch({ type: 'TIMEOUT' })}
            />
          ) : state.challenge.type === 'encounter' ? (
            <EncounterOverlay
              encounter={state.challenge.encounter}
              enemyEmoji={state.enemy.emoji}
              enemyName={state.enemy.name}
              locked={locked}
              onPick={handleEncounter}
            />
          ) : state.challenge.type === 'diss' ? (
            <DissOverlay
              presets={state.challenge.presets}
              enemyEmoji={state.enemy.emoji}
              enemyName={state.enemy.name}
              locked={locked}
              onDiss={handleDiss}
            />
          ) : (
            <FitnessOverlay
              key={state.challenge.challenge.id + ':' + state.fxSeq}
              challenge={state.challenge.challenge}
              locked={locked}
              onDone={handleFitness}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// 非共斗时给 useCoopBattle 的安全占位（它内部不会真发消息：channel=null no-op）。
const FALLBACK_ROOM: UseCoopRoom = {
  channel: null,
  code: null,
  isHost: false,
  players: [],
  host: () => {},
  join: () => {},
  leave: () => {},
  setSinks: () => {},
  reportHp: () => {},
  playerCount: () => 1,
}
const FALLBACK_ME: CoopMe = { id: 'solo', name: '我', emoji: '🧒', band: 'high', heroMaxHp: 5 }

// 共斗通关：美好的回忆。
function CoopVictory({
  players,
  onRestart,
  onExit,
}: {
  players: { id: string; name: string; emoji: string }[]
  onRestart: () => void
  onExit: () => void
}) {
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-3xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-6 text-center shadow-sm">
      <div className="text-5xl">🎞️✨</div>
      <h2 className="font-display text-2xl text-ink-900">美好的回忆</h2>
      <p className="text-sm leading-relaxed text-ink-600">
        你们一起把所有老师都答服气啦！这段并肩作战的时光，会成为一段闪闪发光的回忆。
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {players.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-3 py-1 text-sm text-ink-700">
            {p.emoji} {p.name}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <button onClick={onRestart} className="min-h-12 rounded-2xl border border-ink-200 bg-white text-base font-medium text-ink-700 hover:bg-ink-50">
          再来一局
        </button>
        <button onClick={onExit} className="min-h-12 rounded-2xl bg-rose-500 text-base font-medium text-white hover:bg-rose-600">
          返回
        </button>
      </div>
    </div>
  )
}
