import {
  applyDamage,
  isDown,
  makeFighter,
  resolveAnswer,
  subjectLabel,
} from '@/games/_battle/core'
import type { BattleQuestion } from '@/games/_battle/core'
import { drawQuestions } from '@/games/_battle/questions'
import type { DuelConfig, DuelState, Strike } from './types'
import { topicToDrawArgs, QUESTION_BATCH } from './constants'

export type DuelAction =
  | { type: 'START'; config: DuelConfig }
  | { type: 'BEGIN' } // intro 横幅结束 → 开打
  | { type: 'ANSWER'; choiceId: string | null } // 当前出招者作答（null=超时）
  | { type: 'ADVANCE' } // resolving 动画结束 → 进入回合切换或结算
  | { type: 'NEXT_TURN' } // turnswap 提示结束 → 下一题
  | { type: 'RESTART' } // 用同配置再来一局

const LOG_MAX = 6

function freshQueue(config: DuelConfig): BattleQuestion[] {
  const args = topicToDrawArgs(config.topic)
  return drawQuestions({ band: config.band, count: QUESTION_BATCH, ...args })
}

export function initDuel(config: DuelConfig): DuelState {
  const queue = freshQueue(config)
  return {
    phase: 'intro',
    left: makeFighter('left', config.left.name, config.left.emoji, config.maxHp),
    right: makeFighter('right', config.right.name, config.right.emoji, config.maxHp),
    turn: 'left',
    streak: { left: 0, right: 0 },
    round: 1,
    queue,
    qIndex: 0,
    current: queue[0] ?? null,
    lastStrike: null,
    winner: null,
    log: [],
  }
}

function pushLog(log: string[], line: string): string[] {
  return [line, ...log].slice(0, LOG_MAX)
}

export function duelReducer(state: DuelState, action: DuelAction): DuelState {
  switch (action.type) {
    case 'START':
      return initDuel(action.config)

    case 'RESTART':
      // 复用当前双方设定，重抽题库、回满血。
      return {
        ...state,
        phase: 'intro',
        left: { ...state.left, hp: state.left.maxHp },
        right: { ...state.right, hp: state.right.maxHp },
        turn: 'left',
        streak: { left: 0, right: 0 },
        round: 1,
        queue: shuffleReuse(state.queue),
        qIndex: 0,
        current: state.queue[0] ?? null,
        lastStrike: null,
        winner: null,
        log: [],
      }

    case 'BEGIN':
      if (state.phase !== 'intro') return state
      return { ...state, phase: 'asking' }

    case 'ANSWER': {
      if (state.phase !== 'asking' || !state.current) return state
      const attacker = state.turn
      const defender: 'left' | 'right' = attacker === 'left' ? 'right' : 'left'
      const correct = action.choiceId === state.current.answer
      const streakBefore = state.streak[attacker]
      const res = resolveAnswer(correct, streakBefore)

      // 答对 → 打对方；答错 → 自己受击。
      const victim: 'left' | 'right' = res.target === 'enemy' ? defender : attacker
      const updatedVictim = applyDamage(state[victim], res.damage)

      const next: DuelState = {
        ...state,
        phase: 'resolving',
        [victim]: updatedVictim,
        streak: {
          ...state.streak,
          [attacker]: correct ? streakBefore + 1 : 0,
        },
      } as DuelState

      const strike: Strike = {
        attacker,
        correct,
        crit: res.crit,
        damage: res.damage,
        target: res.target,
        victim,
        chosen: action.choiceId,
      }
      next.lastStrike = strike

      const aName = state[attacker].name
      const dName = state[defender].name
      const subj = subjectLabel(state.current.subject)
      let line: string
      if (correct) {
        line = res.crit
          ? `💥 ${aName} 连对暴击！[${subj}] 对 ${dName} 造成 ${res.damage} 点重创`
          : `✅ ${aName} 答对 [${subj}]，击中 ${dName}（-${res.damage}）`
      } else {
        line = `❌ ${aName} 答错 [${subj}]，露出破绽自损 ${res.damage} 点`
      }
      next.log = pushLog(state.log, line)

      // 是否有人倒下？
      if (isDown(updatedVictim)) {
        next.phase = 'over'
        next.winner = victim === 'left' ? 'right' : 'left'
        next.log = pushLog(next.log, `🏆 ${state[next.winner].name} 获胜！`)
      }
      return next
    }

    case 'ADVANCE': {
      // resolving 结束。若已结算就停在 over。
      if (state.phase === 'over') return state
      if (state.phase !== 'resolving') return state
      return { ...state, phase: 'turnswap' }
    }

    case 'NEXT_TURN': {
      if (state.phase !== 'turnswap') return state
      const nextTurn: 'left' | 'right' = state.turn === 'left' ? 'right' : 'left'
      // 切到下一题。left→right 不算推进回合，right→left 才 +1。
      const nextIndex = state.qIndex + 1
      const wrapped = nextIndex >= state.queue.length
      const idx = wrapped ? 0 : nextIndex
      const round = nextTurn === 'left' ? state.round + 1 : state.round
      return {
        ...state,
        phase: 'asking',
        turn: nextTurn,
        qIndex: idx,
        current: state.queue[idx] ?? state.current,
        round,
        lastStrike: null,
      }
    }

    default:
      return state
  }
}

function shuffleReuse(a: BattleQuestion[]): BattleQuestion[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}
