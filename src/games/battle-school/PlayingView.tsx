// 单局视图（全屏横版）：持有 reducer（全部逻辑）与 Phaser 舞台。gameKey 重挂即重置一切。
// fx effect 只命令 Phaser 播动画，绝不 setState。
//
// 全屏：对局期间用 fixed inset-0 铺满视口（App 的页面 chrome 被这层不透明覆盖盖住）。
// 移动：主角可前后左右走 + 跳，相机跟随，世界比屏宽。桌面=键盘(方向/WASD/空格)，移动端=屏上 D-pad。
//   移动意图通过 scene.setMove 喂给 Phaser，逐帧在 update() 消费；绝不 per-frame setState。
// 走到敌人面前才弹挑战面板（reach gating）：scene 走近敌人 → onReach(true) 回调 → 弹紧凑底部面板。
//   onReach 由 Phaser update 循环触发（事件，非 effect 体内 setState），ESLint 合规。
// 挑战面板=紧凑底部 sheet（半透明 + 高度 ≤45vh），不盖住舞台；中二招式横幅浮在上方。
//
// 多人共斗：传入 coop（room + me）即进入共斗模式——共享 Boss 血量由 host 权威覆盖，
// 每个人答各自年级的题、各自上报伤害、一起推进。编排在 useCoopBattle 里。
// 共斗里移动是本地/装饰性的：reach gating 只控本地面板显隐，不影响 host 推进（无 desync 风险）。

import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { Game } from 'phaser'
import { isDown, resolveAnswer } from '@/games/_battle/core'
import { rosterFor } from '@/games/_battle/roster'
import { skillCry, battleCry } from '@/games/_battle/cries'
import { playSfx, unlockAudio, isMuted, toggleMuted } from '@/games/shared/sound'
import { BattleScene } from './scene'
import { PhaserStage } from './PhaserStage'
import { TouchControls } from './components/TouchControls'
import {
  gameReducer,
  initGame,
  currentIsBoss,
  currentBoss,
  DISS_DAMAGE,
  FITNESS_PASS_DAMAGE,
  ENCOUNTER_WIN_DAMAGE,
  MELEE_DAMAGE,
} from './reducer'

// 共斗里大招对共享 Boss 的伤害：明显比普攻强，但不秒杀，保留多人协作节奏（单人则本地直接放倒）。
const COOP_NOVA_DAMAGE = 4
import { saveLevel } from './storage'
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
  const actedKeyRef = useRef<string | null>(null)
  // 学科大招题只允许结算一次：防双击重复放招/重复上报。每次起手(ARM_NOVA)前置回 false。
  const novaActedRef = useRef<boolean>(false)
  // 键盘 / scene 回调用的「最新处理函数」ref：只在 commit effect 里写，键盘/scene 回调里读（合规）。
  const keyHandlersRef = useRef<{ onMelee: () => void; onSkill: () => void; onCycleSkill: () => void }>({
    onMelee: () => {},
    onSkill: () => {},
    onCycleSkill: () => {},
  })
  const skipHandlersRef = useRef<{ onSkip: () => void }>({ onSkip: () => {} })

  // 走到敌人面前才弹面板。reached 只由 scene 的 update 循环回调驱动（事件，非 render/effect 体内）。
  const [reached, setReached] = useState(false)
  // 全屏 API 状态（仅装饰；iOS Safari 无 element fullscreen，fixed inset-0 即跨端「全屏」）
  const [isFs, setIsFs] = useState(false)
  // 静音开关（音效引擎自带 localStorage 持久化，这里只镜像一份用于按钮显隐）
  const [muted, setMutedState] = useState(isMuted)
  const rootRef = useRef<HTMLDivElement>(null)

  // ── 技能能量（UI 资源，逻辑归 React）：打中/答对攒能量，满了可放技能（⚡大招 / 🍬回血 二选一切换）──
  const ENERGY_MAX = 100
  const [energy, setEnergy] = useState(0)
  const [skill, setSkill] = useState<'nova' | 'heal'>('nova')
  const energyPct = Math.round((energy / ENERGY_MAX) * 100)
  const skillReady = energy >= ENERGY_MAX
  // 攒能量的小工具（在事件回调里调，非 render/effect 体内）：melee 命中 +18，答对 +28。
  const gainEnergy = (n: number) => setEnergy((e) => Math.min(ENERGY_MAX, e + n))

  // 共斗编排
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
        if (fx.waveNext) {
          // 近战群补位：前排倒、下一个滑入（不重 spawn 整列）。
          playSfx('down')
          scene.killFront()
          break
        }
        // 新敌人：先标好「是否可跳过」（普通近战小怪可跳；Boss/题目/特殊不可），再登场。
        scene.setSkippable(!fx.isBoss && state.challenge.type === 'melee')
        if (!fx.isBoss && state.challenge.type === 'melee' && state.waveQueue.length > 0) {
          // 多人近战群：front + waveQueue 一起排成横队登场。
          const members = [
            { emoji: state.enemy.emoji, name: state.enemy.name },
            ...state.waveQueue.map((w) => ({ emoji: w.emoji, name: w.name })),
          ]
          scene.spawnWave(members, true)
        } else {
          scene.spawnEnemy(fx.enemyEmoji ?? '🙂', fx.enemyName ?? '', fx.isBoss)
        }
        break
      case 'hero-attack':
        playSfx(fx.crit ? 'crit' : 'punch')
        scene.playHit('hero', fx.attack ?? 'slap', { crit: fx.crit, damage: fx.damage })
        // 单人前排被打空血：等命中后播倒地（仅当本波只剩这一个时——若还有 waveQueue，
        // 倒地由 WAVE_NEXT→killFront 处理，这里不重复播）。
        if (!isCoop && isDown(state.enemy) && state.waveQueue.length === 0)
          window.setTimeout(() => {
            sceneRef.current?.playDown('enemy')
            playSfx('down')
          }, 560)
        break
      case 'enemy-attack':
        playSfx('hit')
        scene.playHit('enemy', fx.attack ?? 'slap', { damage: fx.damage })
        break
      case 'diss':
        playSfx('combo')
        scene.playDiss(fx.text ?? '哼！', fx.damage)
        if (!isCoop && isDown(state.enemy)) window.setTimeout(() => sceneRef.current?.playDown('enemy'), 700)
        break
      case 'peer-hit':
        playSfx('hit')
        scene.playPeerHit(fx.byName ?? '队友', fx.damage, fx.crit)
        break
      default:
        break
    }
  }, [state.fxSeq, state.fx, state.enemy, state.hero, state.challenge.type, state.waveQueue, isCoop])

  // 共斗：敌人共享血归零时播倒地（纯视觉，与 host 推进解耦）
  useEffect(() => {
    if (!isCoop) return
    if (state.enemy.hp <= 0 && state.phase === 'playing') {
      const id = window.setTimeout(() => sceneRef.current?.playDown('enemy'), 120)
      return () => window.clearTimeout(id)
    }
  }, [isCoop, state.enemy.hp, state.phase])

  // 单人·近战击杀推进：纯动作小怪被普攻/大招打空血后，reducer 不自动推进——
  // 等约 720ms（看完最后一拳 + 倒地）再处理。仅单人；题目/社交击杀走 lastResult→CLEAR_RESULT 推进。
  // 近战群：若前排倒下但本波没清完（waveQueue 非空）→ WAVE_NEXT 顶下一个上来（不推进步骤）；
  // 否则（单怪 / 本波最后一个 / 大招 AoE 已清空）→ ADVANCE 推进整步。
  useEffect(() => {
    if (isCoop) return
    if (state.phase !== 'playing' || state.enemy.hp > 0 || state.lastResult != null) return
    const hasMore = state.waveQueue.length > 0
    const id = window.setTimeout(
      () => dispatch({ type: hasMore ? 'WAVE_NEXT' : 'ADVANCE' }),
      720
    )
    return () => window.clearTimeout(id)
  }, [isCoop, state.phase, state.enemy.hp, state.lastResult, state.waveQueue])

  // 单次作答锁复位：展示完结算、出现新挑战（lastResult 清空）时解除 actedKeyRef，
  // 允许对「同一步的下一题」（Boss 多血 / 2 血小怪）继续作答——否则第二题起会卡成「点不了答案」。
  // 同一题内的防双击仍在：锁在作答瞬间同步置上，重置只发生在 lastResult 归零之后。
  useEffect(() => {
    if (state.lastResult == null) actedKeyRef.current = null
  }, [state.lastResult, state.levelIndex, state.stepIndex])

  // 结算卡自动隐藏：答对/达标约 1.3s、答错/超时约 2.6s 后自动收起继续，不用每次手点「继续」。
  // （「继续」按钮仍在，想快可手点。）
  useEffect(() => {
    if (state.lastResult == null || state.phase !== 'playing') return
    const ms = state.lastResult.ok ? 1300 : 2600
    const id = window.setTimeout(() => dispatch({ type: 'CLEAR_RESULT' }), ms)
    return () => window.clearTimeout(id)
  }, [state.lastResult, state.phase])

  // 怪物主动进攻：只要走到敌人面前（近战小怪 / 出题的小怪 / 老师，reached 对 Boss 也成立）、
  // 且没在结算/没在放大招时，前排怪就每隔几秒朝你扑一下（lunge=既会动又造成普攻小伤害），让它「活」起来。
  // 近战波节奏快、间隔短一点；答题时间隔长一点。答题超时另算它的「大招」。仅单人。
  useEffect(() => {
    if (isCoop || state.phase !== 'playing') return
    if (state.lastResult != null || state.skillQuiz != null || !reached) return
    const t = state.challenge.type
    if (t !== 'melee' && t !== 'question') return
    const interval = t === 'melee' ? 3200 : 6000
    const id = window.setInterval(() => dispatch({ type: 'ENEMY_PECK' }), interval)
    return () => window.clearInterval(id)
  }, [isCoop, state.phase, state.lastResult, state.skillQuiz, state.challenge.type, reached])

  // 共斗：自己血量变化时上报给 host（仅网络上报，非 setState，允许）
  useEffect(() => {
    if (!isCoop || !coop) return
    if (state.hero.hp === lastReportedHpRef.current) return
    lastReportedHpRef.current = state.hero.hp
    coop.room.reportHp(state.hero.hp, isDown(state.hero))
  }, [isCoop, coop, state.hero])

  // 持久化进度（单人才存）
  useEffect(() => {
    if (isCoop) return
    const reached2 = state.phase === 'won' ? totalLevels : state.levelIndex
    if (reached2 !== lastSavedRef.current) {
      lastSavedRef.current = reached2
      saveLevel(player, reached2)
    }
  }, [isCoop, state.phase, state.levelIndex, totalLevels, player])

  // 全屏 API 监听（fullscreenchange）。仅同步状态，不强制。
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // 胜负音效：phase 进入 won/lost 时各放一次号角/沮丧音（副作用，非 setState）。
  useEffect(() => {
    if (state.phase === 'won') playSfx('win')
    else if (state.phase === 'lost') playSfx('lose')
  }, [state.phase])

  // ── 键盘移动（桌面）：window 监听，把意图喂进 scene。用 ref 记按下集合，不 per-frame setState ──
  const pressedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const applyDir = () => {
      const p = pressedRef.current
      const left = p.has('ArrowLeft') || p.has('a') || p.has('A')
      const right = p.has('ArrowRight') || p.has('d') || p.has('D')
      const dir: -1 | 0 | 1 = left && !right ? -1 : right && !left ? 1 : 0
      sceneRef.current?.setMove({ dir })
    }
    const isJump = (k: string) =>
      k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ' || k === 'Spacebar'
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key
      if (isJump(k)) {
        e.preventDefault()
        if (!e.repeat) playSfx('jump') // 长按不连放
        sceneRef.current?.setMove({ jump: true })
        return
      }
      if (k === 'j' || k === 'J') {
        e.preventDefault()
        keyHandlersRef.current.onMelee() // 👊 普攻
        return
      }
      if (k === 'k' || k === 'K') {
        e.preventDefault()
        keyHandlersRef.current.onSkill() // ⚡ 技能（放当前选中的大招/回血）
        return
      }
      if (k === 'l' || k === 'L') {
        e.preventDefault()
        keyHandlersRef.current.onCycleSkill() // 切换大招 / 回血
        return
      }
      if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(k)) {
        e.preventDefault()
        pressedRef.current.add(k)
        applyDir()
      }
      if (k === 's' || k === 'S') e.preventDefault() // 下：横版无蹲，吞掉避免页面滚动
    }
    const onKeyUp = (e: KeyboardEvent) => {
      pressedRef.current.delete(e.key)
      applyDir()
    }
    const onBlur = () => {
      pressedRef.current.clear()
      sceneRef.current?.setMove({ dir: 0 })
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  function handleReady(game: Game) {
    const scene = game.scene.getScene('battle') as BattleScene | null
    sceneRef.current = scene
    if (scene) {
      lastFxSeqRef.current = state.fxSeq // 初始 spawn fx 已手动播，避免 effect 重播
      // reach 回调：由 scene 的 update 循环触发（事件），双边都从这里来，避免 effect 体内 setState
      scene.setReachCallback(() => setReached(true))
      scene.setUnreachCallback(() => setReached(false))
      // 跳过回调：成功跳过普通近战小怪 → 推进（事件式，非 effect 体内）
      scene.setSkipCallback(() => skipHandlersRef.current.onSkip())
      scene.setHeroName(state.hero.name)
      const boss = currentIsBoss(state)
      scene.setSkippable(!boss && state.challenge.type === 'melee')
      if (!boss && state.challenge.type === 'melee' && state.waveQueue.length > 0) {
        // 起手即是多人近战群：整队登场。
        const members = [
          { emoji: state.enemy.emoji, name: state.enemy.name },
          ...state.waveQueue.map((w) => ({ emoji: w.emoji, name: w.name })),
        ]
        scene.spawnWave(members, true)
      } else {
        scene.spawnEnemy(state.enemy.emoji, state.enemy.name, boss)
      }
    }
  }

  const locked = state.lastResult != null
  const onBoss = currentIsBoss(state)
  // 面板可见：走到了「非纯动作」敌人面前（题目/社交/损人/体测/Boss），或正在展示结算反馈。
  // 纯动作小怪（melee）不弹面板——直接 👊 揍它（或 ⤴ 跳过）。
  const panelVisible = (reached && state.challenge.type !== 'melee') || state.lastResult != null
  // 近战群：右上角单个敌人血条对一波爆米花没意义——改显「本波 ×N」小徽章（剩余=1+waveQueue）。
  const isMeleeWave = !onBoss && state.challenge.type === 'melee'
  const waveRemaining = 1 + state.waveQueue.length

  // 中二招式名
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

  // ── 作答处理 ─────────────────────────────────────────────────────
  function claimChallenge(): boolean {
    if (locked) return false
    const key = `${state.levelIndex}:${state.stepIndex}`
    if (actedKeyRef.current === key) return false
    actedKeyRef.current = key
    return true
  }

  // ── 动作：普攻 / 技能 / 跳过推进 ───────────────────────────────────────
  // 👊 普攻：到达敌人 & (纯动作小怪 或 Boss) → 真打（MELEE）；否则原地挥空（air swing）。
  function handleMelee() {
    unlockAudio() // 首个手势里解锁音频上下文（iOS/Safari 必需）
    if (locked) return
    const canHit = reached && (state.challenge.type === 'melee' || onBoss)
    if (canHit) {
      if (!onBoss) gainEnergy(18) // 揍小怪攒能量（Boss 免疫普攻，不给能量）
      if (isCoop && state.challenge.type === 'melee' && !onBoss) coopBattle.reportHit(MELEE_DAMAGE, false)
      dispatch({ type: 'MELEE' }) // 命中音由 hero-attack fx 播
    } else {
      playSfx('tap') // 没敌人在身边：挥个空气，轻响一下
      sceneRef.current?.attack()
    }
  }

  // ⚡ 技能：能量满才放。
  // nova=学科大招：是「学习类技能」——按下不直接放，而是弹一道学科题（模态），答对才放得出（见 handleSkillQuiz）。
  // heal=回血：非学习类技能，即时生效，不弹题。放完都清空能量。
  function handleSkill() {
    unlockAudio()
    if (!skillReady || locked) return
    if (skill === 'nova') {
      if (state.skillQuiz) return // 已经在答大招题了
      novaActedRef.current = false
      playSfx('skill') // 起手蓄力音；放招/哑火音在 handleSkillQuiz 里
      setEnergy(0) // 起手即消耗能量：答错也不退（哑火的代价就是这一管能量）
      dispatch({ type: 'ARM_NOVA' })
    } else {
      playSfx('heal')
      sceneRef.current?.playSkillFx('heal', '回血！🍬')
      dispatch({ type: 'SKILL_HEAL', amount: 2 })
      setEnergy(0)
    }
  }

  // 学科大招·答题结算：答对才放招（喊对应学科的中二招式 + 特效），答错哑火。choiceId='' 视为超时(算错)。
  function handleSkillQuiz(choiceId: string) {
    if (!state.skillQuiz || novaActedRef.current) return
    novaActedRef.current = true
    const correct = choiceId === state.skillQuiz.question.answer
    playSfx(correct ? 'nova' : 'wrong')
    if (correct) {
      const cry = skillCry(state.skillQuiz.question.subject, state.band) ?? battleCry('finish', state.band)
      // 单人·非 Boss 近战群：大招 = AoE 清场（全体一起倒地）；其余（Boss / 共斗）仍是定向大招。
      if (!isCoop && !onBoss && state.challenge.type === 'melee') {
        sceneRef.current?.clearWaveAoe(cry)
      } else {
        sceneRef.current?.playSkillFx('nova', cry)
      }
      // 共斗：共享血由 host 权威结算，大招报一笔有限伤害（不秒杀共享血，保留多人节奏）。
      if (isCoop) coopBattle.reportHit(COOP_NOVA_DAMAGE, true)
    }
    dispatch({ type: 'RESOLVE_NOVA', choiceId })
  }

  // 切换大招 / 回血
  function cycleSkill() {
    playSfx('tap')
    setSkill((s) => (s === 'nova' ? 'heal' : 'nova'))
  }

  // 成功跳过普通近战小怪：推进到下一个（单人本地推进；共斗里跳过仅本地、不动 host 进度）。
  function handleSkip() {
    if (state.phase !== 'playing') return
    if (isCoop) {
      setReached(false) // 共斗：跳过只是本地越过，host 仍权威推进；这里仅收掉本地提示
      return
    }
    dispatch({ type: 'ADVANCE' })
  }

  // 把「最新」处理函数写进 ref（只在 commit effect 里写，never during render）：
  // 给 mount-once 的键盘监听 / scene 跳过回调读，避免闭包读到旧 state。
  useEffect(() => {
    keyHandlersRef.current = { onMelee: handleMelee, onSkill: handleSkill, onCycleSkill: cycleSkill }
    skipHandlersRef.current = { onSkip: handleSkip }
  })

  function handleAnswer(choiceId: string) {
    if (!claimChallenge()) return
    if (state.challenge.type === 'question') {
      const correct = choiceId === state.challenge.question.answer
      playSfx(correct ? 'correct' : 'wrong')
      if (correct) {
        gainEnergy(28) // 答对攒能量（知识=强攻，回报更高）
        if (isCoop) {
          const res = resolveAnswer(true, state.streak)
          coopBattle.reportHit(res.damage, res.crit)
        }
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

  // 全屏切换：用 Fullscreen API（支持则真全屏）；不支持（iOS Safari）静默 no-op，靠 fixed inset-0 兜底。
  function toggleFullscreen() {
    const el = rootRef.current
    if (!el) return
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {})
    } else if (el.requestFullscreen) {
      void el.requestFullscreen().catch(() => {})
    }
  }

  // ── 通关 / 失败：常规居中页（非全屏覆盖，回到正常文档流）──────────────────
  if (state.phase === 'won') {
    return (
      <div className="space-y-4">
        {isCoop ? (
          <CoopVictory players={coop?.room.players ?? []} onRestart={onBackToStart} onExit={onExit} />
        ) : (
          <VictoryScreen roster={roster} playerName={roster.player} band={state.band} onRestart={onBackToStart} onExit={onExit} />
        )}
      </div>
    )
  }
  if (state.phase === 'lost') {
    return (
      <div className="space-y-4">
        <LostScreen
          levelIndex={state.levelIndex}
          totalLevels={totalLevels}
          onRetry={() => dispatch({ type: 'RESTART' })}
          onExit={onBackToStart}
        />
      </div>
    )
  }

  // ── 对局中：全屏横版舞台 ─────────────────────────────────────────────
  return (
    <div ref={rootRef} className="fixed inset-0 z-50 select-none overflow-hidden bg-[#1b1726]">
      {/* Phaser 画布铺满全屏 */}
      <PhaserStage onReady={handleReady} className="absolute inset-0 h-full w-full" />

      {/* 顶栏：返回 + 双方血条 + 关卡进度（浮在画布上） */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2 sm:p-3">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onExit}
            className="rounded-full bg-black/40 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition hover:bg-black/55"
          >
            ← 返回
          </button>
          <div className="rounded-2xl bg-black/35 px-2 py-1 backdrop-blur">
            <HpBar fighter={state.hero} align="left" accent="emerald" />
          </div>
        </div>

        <div className="pointer-events-none flex flex-col items-center pt-1 text-center">
          <span className="rounded-full bg-black/45 px-3 py-1 text-xs font-bold text-white backdrop-blur">
            第 {state.levelIndex + 1} / {totalLevels} 关
          </span>
          {onBoss ? (
            <span className="mt-1 rounded-full bg-rose-600/90 px-2 py-0.5 text-[11px] font-bold text-white shadow backdrop-blur">
              👑 BOSS·{currentBoss(state).name}
            </span>
          ) : (
            <span className="mt-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-white/90 backdrop-blur">
              ⚔️ 拦路对手
            </span>
          )}
          {isCoop && (
            <span className="mt-1 rounded-full bg-rose-50/90 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
              共斗 · 房号 {coop?.room.code}
            </span>
          )}
        </div>

        <div className="pointer-events-auto flex items-start gap-2">
          {isMeleeWave ? (
            // 近战群：显示「本波 ×N」徽章（剩余敌人数 = 前排 + waveQueue），而非单个血条。
            <div className="flex flex-col items-end gap-1 rounded-2xl bg-black/35 px-3 py-1.5 backdrop-blur">
              <span className="rounded-full bg-rose-600/90 px-2.5 py-0.5 text-xs font-black text-white shadow">
                👊 本波 ×{waveRemaining}
              </span>
              <span className="text-[10px] font-semibold text-white/80">{state.enemy.emoji} 一拳一个</span>
            </div>
          ) : (
            <div className="rounded-2xl bg-black/35 px-2 py-1 backdrop-blur">
              <HpBar fighter={state.enemy} align="right" accent="rose" boss={onBoss} />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              const m = toggleMuted()
              setMutedState(m)
              if (!m) playSfx('tap') // 刚开声：响一下确认
            }}
            aria-label={muted ? '取消静音' : '静音'}
            className="rounded-full bg-black/40 p-2 text-base text-white backdrop-blur transition hover:bg-black/55"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="全屏"
            className="rounded-full bg-black/40 p-2 text-base text-white backdrop-blur transition hover:bg-black/55"
          >
            {isFs ? '🗗' : '⛶'}
          </button>
        </div>
      </div>

      {/* 共斗：在线队友名单（顶栏下方一行） */}
      {isCoop && coop && coop.room.players.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center px-3 sm:top-20">
          <div className="pointer-events-auto rounded-2xl bg-black/35 px-3 py-1 backdrop-blur">
            <PlayerList players={coop.room.players} currentEnemyName={state.enemy.name} />
          </div>
        </div>
      )}

      {/* 中二招式名横幅：出招瞬间按学科喊招式名 / 暴击·损人战吼 */}
      {state.lastResult?.ok && cryText && (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-30 flex justify-center px-3 sm:top-28">
          <div className="rounded-2xl bg-rose-600/95 px-4 py-1.5 text-center font-display text-base font-black text-white shadow-xl sm:text-xl">
            {cryText}
          </div>
        </div>
      )}

      {/* 动作控制：左=虚拟摇杆走动，右=👊普攻 / ⚡技能 / ⤴跳。回调直接喂给 scene / 处理函数。 */}
      <TouchControls
        onMove={(d) => sceneRef.current?.setMove({ dir: d })}
        onJump={() => {
          unlockAudio()
          playSfx('jump')
          sceneRef.current?.setMove({ jump: true })
        }}
        onAttack={handleMelee}
        onSkill={handleSkill}
        skillReady={skillReady}
        energyPct={energyPct}
      />

      {/* 技能切换 + 能量条（技能键上方一点）：点一下切「⚡大招 / 🍬回血」 */}
      <div className="pointer-events-none absolute bottom-40 right-4 z-[45] flex flex-col items-end gap-1 sm:bottom-44 sm:right-6">
        <button
          type="button"
          onClick={cycleSkill}
          className="pointer-events-auto rounded-full bg-black/45 px-3 py-1 text-xs font-bold text-white backdrop-blur transition active:scale-95"
        >
          {skill === 'nova' ? '⚡ 学霸大招' : '🍬 回血'} · 切换
        </button>
        <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-semibold text-amber-200 backdrop-blur">
          能量 {energyPct}%{skillReady ? ' · 可放！' : ''}
        </span>
      </div>

      {/* 学科大招·答题模态：按下⚡后弹一道学科题，答对才放得出招（学习类技能专属）。盖在最上层。 */}
      {state.skillQuiz && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 p-2 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="pointer-events-auto w-full max-w-2xl space-y-2">
            <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 px-4 py-2 text-center font-display text-base font-black text-white shadow-xl sm:text-lg">
              ⚡ 学霸大招 · 答对才放得出来！
            </div>
            <QuestionOverlay
              question={state.skillQuiz.question}
              streak={state.streak}
              locked={false}
              onAnswer={handleSkillQuiz}
              onTimeout={() => handleSkillQuiz('')}
            />
          </div>
        </div>
      )}

      {/* 挑战面板：紧凑底部 sheet，走到敌人面前（或结算中）才出现，不盖住舞台 */}
      {!state.skillQuiz && panelVisible && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex max-h-[42vh] justify-center p-2 sm:p-3">
          <div className="pointer-events-auto w-full max-w-2xl overflow-y-auto rounded-t-3xl">
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
            ) : state.challenge.type === 'fitness' ? (
              <FitnessOverlay
                key={state.challenge.challenge.id + ':' + state.fxSeq}
                challenge={state.challenge.challenge}
                locked={locked}
                onDone={handleFitness}
              />
            ) : null}
          </div>
        </div>
      )}

    </div>
  )
}

// 非共斗时给 useCoopBattle 的安全占位（channel=null no-op）。
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
