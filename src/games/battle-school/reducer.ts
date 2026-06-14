// 全部战斗逻辑：useReducer 纯函数。不碰 Phaser、不读 DOM。
// 结算用 _battle/core 的 resolveAnswer/applyDamage/isDown；抽题/遭遇用 _battle/questions、encounters。
// 每次状态变化若需要播动画，就写一条 fx 指令并 fxSeq+1，组件用 effect 监听去调 scene。

import { makeFighter, applyDamage, isDown, resolveAnswer } from '@/games/_battle/core'
import { drawBySubject, drawQuestions, FUN_KINDS } from '@/games/_battle/questions'
import { drawEncounters } from '@/games/_battle/encounters'
import { rosterFor } from '@/games/_battle/roster'
import { contentFor } from '@/platform/content'
import type { RosterDef, BossDef } from '@/games/_battle/roster'
import type { BattleQuestion } from '@/games/_battle/core'
import { buildLevels } from './plan'
import {
  randomAttackKind,
  type Action,
  type Challenge,
  type DissLine,
  type FitnessChallenge,
  type GameState,
  type LevelPlan,
  type MobStep,
} from './types'

export const HERO_HP = 5
/** 损人嘴炮的固定伤害：低，但「侮辱性极强」的演出补偿。自定义打字也是这个值。 */
export const DISS_DAMAGE = 8
/** 社交遭遇「搞定他」对共享 Boss 的固定伤害（多人共斗用；单人沿用「直接放倒小怪」）。 */
export const ENCOUNTER_WIN_DAMAGE = 3
/** 体测达标的大伤害（足够直接放倒小怪）；失败自己掉的血。 */
export const FITNESS_PASS_DAMAGE = 999
export const FITNESS_FAIL_SELF_DAMAGE = 1

/** 抽一道题：先按指定学科/类别，空了退到本年龄段任意题（都来自 DB，不在代码里塞假题）。
 *  进场前 App「内容启动门」已确保题库就绪、且 DB 必有该年龄段题，这里不会真为空。 */
function pickQuestion(band: 'low' | 'high', opts: { subject?: string; kinds?: readonly string[] }): BattleQuestion {
  const primary = opts.subject
    ? drawBySubject(opts.subject, band, 1)
    : drawQuestions({ band, count: 1, kinds: opts.kinds })
  return (primary[0] ?? drawQuestions({ band, count: 1 })[0])!
}

/** 给当前步骤抽一个挑战（社交遭遇 or 题目）。 */
function challengeForStep(level: LevelPlan, stepIndex: number, band: 'low' | 'high'): {
  challenge: Challenge
  enemyEmoji: string
  enemyName: string
  enemyHp: number
} {
  if (stepIndex < level.mobs.length) {
    const mob: MobStep = level.mobs[stepIndex]
    if (mob.mode === 'encounter') {
      const enc = drawEncounters(band, 1)[0]
      if (enc) {
        return {
          challenge: { type: 'encounter', encounter: enc },
          enemyEmoji: mob.emoji,
          enemyName: mob.name,
          enemyHp: mob.hp,
        }
      }
      // DB 没遭遇内容 → 退化成好玩题（不在代码里塞假遭遇）
    }
    if (mob.mode === 'diss') {
      // 损人嘴炮：拉本年龄段的预设台词（可空，玩家也能自己打字）
      const presets = contentFor<DissLine>('battle-disses', []).filter((d) => d.band === band)
      return {
        challenge: { type: 'diss', presets },
        enemyEmoji: mob.emoji,
        enemyName: mob.name,
        enemyHp: mob.hp,
      }
    }
    if (mob.mode === 'fitness') {
      const all = contentFor<FitnessChallenge>('battle-fitness', []).filter((f) => f.band === band)
      const fit = all[Math.floor(Math.random() * all.length)]
      if (fit) {
        return {
          challenge: { type: 'fitness', challenge: fit },
          enemyEmoji: mob.emoji,
          enemyName: mob.name,
          enemyHp: mob.hp,
        }
      }
      // DB 没体测内容 → 退化成好玩题
    }
    // 好玩题小怪（也是 encounter/fitness 无内容时的退化）
    const q = pickQuestion(band, { kinds: FUN_KINDS })
    return {
      challenge: { type: 'question', question: q },
      enemyEmoji: mob.emoji,
      enemyName: mob.name,
      enemyHp: mob.hp,
    }
  }
  // Boss 步骤
  const boss: BossDef = level.boss.boss
  const q = pickQuestion(band, { subject: boss.subject })
  return {
    challenge: { type: 'question', question: q },
    enemyEmoji: boss.emoji,
    enemyName: boss.name,
    enemyHp: boss.hp,
  }
}

// 已移除硬编码兜底：内容只从 DB 来；抽空时 challengeForStep 退化成 DB 题。

/**
 * 给「当前步骤、当前敌人」抽一个新挑战（不换敌人，只换挑战）。
 * 多人共斗里反复打同一个共享敌人时用：每答完一题/一招就抽下一个挑战继续。
 * Boss 步骤 → Boss 学科题；小怪步骤 → 按小怪 mode（社交/好玩题/损人/体测）。
 */
function nextChallengeForCurrentStep(state: GameState): GameState {
  const level = state.levels[state.levelIndex]
  if (isBossStep(level, state.stepIndex)) {
    const boss = level.boss.boss
    const q = pickQuestion(state.band, { subject: boss.subject })
    return { ...state, challenge: { type: 'question', question: q }, lastResult: null }
  }
  const c = challengeForStep(level, state.stepIndex, state.band)
  return { ...state, challenge: c.challenge, lastResult: null }
}

/** 当前步骤的敌人是不是 Boss。 */
function isBossStep(level: LevelPlan, stepIndex: number): boolean {
  return stepIndex >= level.mobs.length
}

export interface InitArgs {
  player: string
  startLevel: number // 从第几关开始（0-based）
  coop?: boolean // 多人共斗：共享 Boss 血量由 host 权威覆盖（默认 false=单人）
}

export function initGame(args: InitArgs): GameState {
  const roster: RosterDef = rosterFor(args.player)
  const band = roster.band
  const levels = buildLevels(roster)
  const levelIndex = Math.min(Math.max(0, args.startLevel), levels.length - 1)
  const heroName = displayName(args.player, roster)
  const hero = makeFighter('hero', heroName, '🧒', HERO_HP)

  const { challenge, enemyEmoji, enemyName, enemyHp } = challengeForStep(levels[levelIndex], 0, band)
  const enemy = makeFighter('enemy', enemyName, enemyEmoji, enemyHp)

  return {
    roster,
    band,
    player: args.player,
    hero,
    enemy,
    levels,
    levelIndex,
    stepIndex: 0,
    challenge,
    streak: 0,
    phase: 'playing',
    lastResult: null,
    fxSeq: 0,
    fx: { kind: 'spawn', enemyEmoji, enemyName, isBoss: false },
    coop: args.coop ?? false,
  }
}

function displayName(player: string, roster: RosterDef): string {
  // roster.player 是中文名（闫顺儿 / 闫一依）；player 可能是 id 或名字。
  if (player && /[一-龥]/.test(player)) return player
  return roster.player || '我'
}

/**
 * 处理一次「成功打敌人」：播攻击动画。
 * 单人：本地直接扣敌人血（倒下与否由 enemy.hp 决定，CLEAR_RESULT 时判 isDown）。
 * 多人共斗：敌人是「共享 Boss」，血量由 host 权威覆盖（COOP_SYNC）——本地**不**扣血，
 * 只播动画 + 把伤害写进 fx.damage，PlayingView 据此上报给 host 结算。
 */
function hitEnemy(state: GameState, damage: number, crit: boolean): GameState {
  const enemy = state.coop ? state.enemy : applyDamage(state.enemy, damage)
  return {
    ...state,
    enemy,
    fxSeq: state.fxSeq + 1,
    fx: { kind: 'hero-attack', attack: randomAttackKind(), crit, damage },
  }
}

/** 处理一次「敌人打主角」：主角掉血、可能失败。 */
function hitHero(state: GameState, damage: number): GameState {
  const hero = applyDamage(state.hero, damage)
  const lost = isDown(hero)
  return {
    ...state,
    hero,
    streak: 0,
    fxSeq: state.fxSeq + 1,
    fx: { kind: 'enemy-attack', attack: randomAttackKind(), damage },
    phase: lost ? 'lost' : state.phase,
  }
}

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'ANSWER':
    case 'TIMEOUT': {
      if (state.phase !== 'playing' || state.challenge.type !== 'question') return state
      const q = state.challenge.question
      const correct = action.type === 'ANSWER' && action.choiceId === q.answer
      if (correct) {
        const res = resolveAnswer(true, state.streak)
        const next = hitEnemy(state, res.damage, res.crit)
        const down = isDown(next.enemy)
        return {
          ...next,
          streak: state.streak + 1,
          lastResult: {
            ok: true,
            text: res.crit ? '暴击命中！' : '答对啦！',
            detail: down ? undefined : q.explanation,
            crit: res.crit,
          },
        }
      }
      // 答错 / 超时：主角受击、连对清零
      const next = hitHero(state, 1)
      return {
        ...next,
        lastResult: {
          ok: false,
          text: action.type === 'TIMEOUT' ? '超时啦！' : '答错了',
          detail: q.explanation ?? `正确答案：${q.choices.find((c) => c.id === q.answer)?.text ?? ''}`,
        },
      }
    }

    case 'PICK_ENCOUNTER': {
      if (state.phase !== 'playing' || state.challenge.type !== 'encounter') return state
      const enc = state.challenge.encounter
      const opt = enc.options.find((o) => o.id === action.optionId)
      if (!opt) return state
      // 搞定他造成的伤害：单人=直接放倒小怪；共斗=固定伤害（PlayingView 据此上报给 host）。
      const winDmg = state.coop ? ENCOUNTER_WIN_DAMAGE : Math.max(1, state.enemy.hp)
      if (opt.outcome === 'win') {
        const next = hitEnemy(state, winDmg, false) // 共斗 hitEnemy 不本地扣血
        return {
          ...next,
          lastResult: { ok: true, text: '搞定他！', detail: opt.reply },
        }
      }
      if (opt.outcome === 'fail') {
        // 没搞定：被同学揍一下
        const next = hitHero(state, 1)
        return {
          ...next,
          lastResult: { ok: false, text: '没搞定…', detail: opt.reply },
        }
      }
      // funny：搞笑过场，轻松过。单人直接放倒；共斗造成固定伤害（同 win）。
      if (state.coop) {
        return {
          ...state,
          fxSeq: state.fxSeq + 1,
          fx: { kind: 'hero-attack', attack: randomAttackKind(), damage: winDmg },
          lastResult: { ok: true, text: '哈哈过场～', detail: opt.reply },
        }
      }
      const enemy = applyDamage(state.enemy, Math.max(1, state.enemy.hp))
      return {
        ...state,
        enemy,
        fxSeq: state.fxSeq + 1,
        fx: { kind: 'hero-attack', attack: randomAttackKind(), damage: 0 },
        lastResult: { ok: true, text: '哈哈过场～', detail: opt.reply },
      }
    }

    case 'DISS': {
      // 损人嘴炮：低伤害但「侮辱性极强」。预设或自定义打字都走这条；走 hitEnemy（多人不本地扣血）。
      if (state.phase !== 'playing' || state.challenge.type !== 'diss') return state
      const next = hitEnemy(state, DISS_DAMAGE, false)
      return {
        ...next,
        // 覆盖 fx 成 diss 演出（大字 + 抖屏 + emoji 爆发）
        fx: { kind: 'diss', text: action.text, damage: DISS_DAMAGE },
        lastResult: { ok: true, text: '侮辱性极强！', detail: `「${action.text}」 -${DISS_DAMAGE}` },
      }
    }

    case 'FITNESS_DONE': {
      // 体测：达标=大伤害放倒小怪；失败=自己掉血。
      if (state.phase !== 'playing' || state.challenge.type !== 'fitness') return state
      const fit = state.challenge.challenge
      if (action.passed) {
        const next = hitEnemy(state, FITNESS_PASS_DAMAGE, true)
        return {
          ...next,
          lastResult: { ok: true, text: `${fit.name}达标！`, detail: `完成 ${action.reps}${fit.unit}，体育生附体！`, crit: true },
        }
      }
      const next = hitHero(state, FITNESS_FAIL_SELF_DAMAGE)
      return {
        ...next,
        lastResult: { ok: false, text: `${fit.name}没达标…`, detail: `只做了 ${action.reps}/${fit.target}${fit.unit}，被同学嘲笑了一下。` },
      }
    }

    case 'CLEAR_RESULT': {
      // 收起反馈。
      if (state.phase !== 'playing') return { ...state, lastResult: null }
      // 多人共斗：本地不自行推进（推进听 host 的 COOP_ADVANCE）。共享敌人还在 → 抽下一个挑战继续打。
      if (state.coop) {
        return { ...nextChallengeForCurrentStep({ ...state, lastResult: null }) }
      }
      // 单人：若敌人已倒下，自动推进；否则给同一敌人抽下一题（Boss 多血）。
      if (isDown(state.enemy)) {
        return advance({ ...state, lastResult: null })
      }
      // 敌人没死（小怪有 2 血 / Boss 多血）：同一敌人继续，按【当前步骤类型】重抽挑战——
      // Boss=学科题；小怪=按它的 mode（社交/好玩题/损人/体测）。别再一律当 Boss 出学科题。
      return nextChallengeForCurrentStep({ ...state, lastResult: null })
    }

    case 'ADVANCE':
      return advance(state)

    // ── 多人共斗：host 权威覆盖 ──────────────────────────────────────────
    case 'COOP_SYNC': {
      // host 广播来的共享 Boss 血量 / 进度，覆盖本地敌人血量与共享进度（不动本地 hero / challenge）。
      const enemy = { ...state.enemy, hp: Math.max(0, action.bossHp), maxHp: action.bossMaxHp }
      return { ...state, enemy, levelIndex: action.levelIndex, stepIndex: action.stepIndex }
    }

    case 'COOP_PEER_HIT': {
      // 队友打出一记命中：播一个「天降」特效（不影响本地 hero），共享血量随后由 COOP_SYNC 覆盖。
      return {
        ...state,
        fxSeq: state.fxSeq + 1,
        fx: { kind: 'peer-hit', byName: action.byName, damage: action.damage, crit: action.crit },
      }
    }

    case 'COOP_ADVANCE': {
      // host 指挥：共享敌人换了（小怪过 / 进 Boss / 下一关）。全员同步到新进度 + 换敌人 + 抽各自的新挑战。
      const enemy = makeFighter('enemy', action.enemyName, action.enemyEmoji, action.enemyHp)
      const withEnemy: GameState = {
        ...state,
        levelIndex: action.levelIndex,
        stepIndex: action.stepIndex,
        enemy,
        lastResult: null,
        fxSeq: state.fxSeq + 1,
        fx: { kind: 'spawn', enemyEmoji: action.enemyEmoji, enemyName: action.enemyName, isBoss: action.isBoss },
      }
      // 用更新后的 levelIndex/stepIndex 抽挑战（各端按自己年级抽各自的题）
      return nextChallengeForCurrentStep(withEnemy)
    }

    case 'COOP_WON': {
      // host 指挥：全部共享 Boss 打完 = 通关。
      return { ...state, phase: 'won', lastResult: null, fxSeq: state.fxSeq + 1, fx: { kind: 'none' } }
    }

    case 'RESTART': {
      // 从本关重来：重建血量与该关步骤。fxSeq 要继续递增，spawn 动画才会重新触发。
      const fresh = initGame({ player: state.player, startLevel: state.levelIndex, coop: state.coop })
      return { ...fresh, fxSeq: state.fxSeq + 1 }
    }

    default:
      return state
  }
}

/** 敌人倒下后：推进到下一个步骤 / 下一关 / 通关。 */
function advance(state: GameState): GameState {
  const level = state.levels[state.levelIndex]
  const wasBoss = isBossStep(level, state.stepIndex)

  if (wasBoss) {
    // 过关：下一关
    const nextLevelIndex = state.levelIndex + 1
    if (nextLevelIndex >= state.levels.length) {
      // 通关
      return { ...state, phase: 'won', lastResult: null, fxSeq: state.fxSeq + 1, fx: { kind: 'none' } }
    }
    const nextLevel = state.levels[nextLevelIndex]
    const c = challengeForStep(nextLevel, 0, state.band)
    const enemy = makeFighter('enemy', c.enemyName, c.enemyEmoji, c.enemyHp)
    return {
      ...state,
      levelIndex: nextLevelIndex,
      stepIndex: 0,
      enemy,
      challenge: c.challenge,
      lastResult: null,
      fxSeq: state.fxSeq + 1,
      fx: { kind: 'spawn', enemyEmoji: c.enemyEmoji, enemyName: c.enemyName, isBoss: false },
    }
  }

  // 还在小怪阶段：下一个步骤
  const nextStep = state.stepIndex + 1
  const c = challengeForStep(level, nextStep, state.band)
  const enemy = makeFighter('enemy', c.enemyName, c.enemyEmoji, c.enemyHp)
  return {
    ...state,
    stepIndex: nextStep,
    enemy,
    challenge: c.challenge,
    lastResult: null,
    fxSeq: state.fxSeq + 1,
    fx: { kind: 'spawn', enemyEmoji: c.enemyEmoji, enemyName: c.enemyName, isBoss: isBossStep(level, nextStep) },
  }
}

/** 给 UI 用的小工具：当前敌人是不是 Boss、当前是第几关/共几关。 */
export function currentIsBoss(state: GameState): boolean {
  return isBossStep(state.levels[state.levelIndex], state.stepIndex)
}
export function currentBoss(state: GameState): BossDef {
  return state.levels[state.levelIndex].boss.boss
}

// ── 多人共斗：host 编排共享敌人队列 ──────────────────────────────────────
/** 共享敌人的描述（host 算好后广播给全员）。 */
export interface SharedEnemy {
  levelIndex: number
  stepIndex: number
  enemyEmoji: string
  enemyName: string
  enemyHp: number
  isBoss: boolean
}

/**
 * host 用：算出「当前步骤的共享敌人」。enemyHp 按人数放大（共享血量，人多血厚才不秒）。
 * @param levels 关卡计划（host 的，全员同一份不要紧——只用其结构）
 * @param playerCount 在线人数（含 host），最少 1
 */
export function sharedEnemyAt(
  levels: LevelPlan[],
  levelIndex: number,
  stepIndex: number,
  playerCount: number
): SharedEnemy | null {
  if (levelIndex < 0 || levelIndex >= levels.length) return null
  const level = levels[levelIndex]
  const scale = Math.max(1, playerCount)
  if (isBossStep(level, stepIndex)) {
    const boss = level.boss.boss
    return {
      levelIndex,
      stepIndex,
      enemyEmoji: boss.emoji,
      enemyName: boss.name,
      enemyHp: boss.hp * scale,
      isBoss: true,
    }
  }
  const mob = level.mobs[stepIndex]
  return {
    levelIndex,
    stepIndex,
    enemyEmoji: mob.emoji,
    enemyName: mob.name,
    enemyHp: Math.max(1, mob.hp) * scale,
    isBoss: false,
  }
}

/**
 * host 用：共享敌人倒下后，推进到下一个步骤 / 下一关 / 通关。
 * 返回下一个共享敌人；返回 null 表示全部通关（host 应广播 won）。
 */
export function advanceSharedEnemy(
  levels: LevelPlan[],
  levelIndex: number,
  stepIndex: number,
  playerCount: number
): SharedEnemy | null {
  const level = levels[levelIndex]
  const wasBoss = isBossStep(level, stepIndex)
  if (wasBoss) {
    const nextLevelIndex = levelIndex + 1
    if (nextLevelIndex >= levels.length) return null // 通关
    return sharedEnemyAt(levels, nextLevelIndex, 0, playerCount)
  }
  return sharedEnemyAt(levels, levelIndex, stepIndex + 1, playerCount)
}
