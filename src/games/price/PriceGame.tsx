import { useReducer, useState } from 'react'
import type {
  PlayerId,
  PriceCategory,
  PriceItem,
  RoundCount,
  RoundRecord,
  Stage,
} from './types'
import { PLAYERS } from './types'
import { buildRounds } from './utils/buildRounds'
import { IntroStage } from './stages/IntroStage'
import { SetupStage } from './stages/SetupStage'
import { GuessingStage } from './stages/GuessingStage'
import { RevealStage } from './stages/RevealStage'
import { ResultStage } from './stages/ResultStage'

interface PriceGameProps {
  onExit: () => void
}

interface State {
  stage: Stage
  players: Set<PlayerId>
  categories: Set<PriceCategory>
  roundCount: RoundCount
  items: PriceItem[]
  roundIdx: number
  guesses: Partial<Record<PlayerId, number>>
  history: RoundRecord[]
}

type Action =
  | { type: 'GOTO_SETUP' }
  | { type: 'TOGGLE_PLAYER'; value: PlayerId }
  | { type: 'TOGGLE_CATEGORY'; value: PriceCategory }
  | { type: 'SET_ROUNDS'; value: RoundCount }
  | { type: 'START'; items: PriceItem[] }
  | { type: 'SUBMIT_GUESS'; player: PlayerId; value: number }
  | { type: 'NEXT_ROUND' }
  | { type: 'PLAY_AGAIN' }

/** 最接近真实价的赢（可并列）；误差 ≤10% 算「神价」拿双倍分 */
function settleRound(item: PriceItem, guesses: Partial<Record<PlayerId, number>>): RoundRecord {
  const entries = Object.entries(guesses) as [PlayerId, number][]
  const bestDiff = Math.min(...entries.map(([, v]) => Math.abs(v - item.price)))
  const winners = entries.filter(([, v]) => Math.abs(v - item.price) === bestDiff).map(([p]) => p)
  const sharp = bestDiff <= item.price * 0.1
  return { item, guesses, winners, sharp }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'GOTO_SETUP':
      return { ...state, stage: 'setup' }
    case 'TOGGLE_PLAYER': {
      const next = new Set(state.players)
      if (next.has(action.value)) next.delete(action.value)
      else next.add(action.value)
      return { ...state, players: next }
    }
    case 'TOGGLE_CATEGORY': {
      const next = new Set(state.categories)
      if (next.has(action.value)) next.delete(action.value)
      else next.add(action.value)
      return { ...state, categories: next }
    }
    case 'SET_ROUNDS':
      return { ...state, roundCount: action.value }
    case 'START':
      return {
        ...state,
        stage: 'guessing',
        items: action.items,
        roundIdx: 0,
        guesses: {},
        history: [],
      }
    case 'SUBMIT_GUESS': {
      const guesses = { ...state.guesses, [action.player]: action.value }
      const allIn = [...state.players].every((p) => guesses[p] !== undefined)
      if (!allIn) return { ...state, guesses }
      return {
        ...state,
        stage: 'reveal',
        guesses,
        history: [...state.history, settleRound(state.items[state.roundIdx], guesses)],
      }
    }
    case 'NEXT_ROUND': {
      const isLast = state.roundIdx + 1 >= state.items.length
      if (isLast) return { ...state, stage: 'result' }
      return { ...state, stage: 'guessing', roundIdx: state.roundIdx + 1, guesses: {} }
    }
    case 'PLAY_AGAIN':
      return { ...state, stage: 'setup' }
    default:
      return state
  }
}

function readIntroSeen(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem('price.introSeen') === '1'
}

const ALL_PLAYERS: PlayerId[] = PLAYERS.map((p) => p.id)
const ALL_CATEGORIES: PriceCategory[] = [
  'snack',
  'toy',
  'digital',
  'beauty',
  'daily',
  'food',
  'ticket',
  'big',
]

function tallyScores(history: RoundRecord[]): Partial<Record<PlayerId, number>> {
  const scores: Partial<Record<PlayerId, number>> = {}
  for (const round of history) {
    const pts = round.sharp ? 2 : 1
    for (const winner of round.winners) {
      scores[winner] = (scores[winner] ?? 0) + pts
    }
  }
  return scores
}

export function PriceGame({ onExit }: PriceGameProps) {
  const [introSeen] = useState(readIntroSeen)
  const [state, dispatch] = useReducer(reducer, {
    stage: introSeen ? 'setup' : 'intro',
    players: new Set(ALL_PLAYERS),
    categories: new Set(ALL_CATEGORIES),
    roundCount: 8,
    items: [],
    roundIdx: 0,
    guesses: {},
    history: [],
  })

  const activePlayers = ALL_PLAYERS.filter((p) => state.players.has(p))
  const scores = tallyScores(state.history)

  if (state.stage === 'intro') {
    return <IntroStage onContinue={() => dispatch({ type: 'GOTO_SETUP' })} />
  }

  if (state.stage === 'setup') {
    return (
      <SetupStage
        players={state.players}
        categories={state.categories}
        roundCount={state.roundCount}
        onTogglePlayer={(p) => dispatch({ type: 'TOGGLE_PLAYER', value: p })}
        onToggleCategory={(c) => dispatch({ type: 'TOGGLE_CATEGORY', value: c })}
        onChangeRounds={(n) => dispatch({ type: 'SET_ROUNDS', value: n })}
        onStart={() =>
          dispatch({ type: 'START', items: buildRounds(state.categories, state.roundCount) })
        }
      />
    )
  }

  if (state.stage === 'guessing') {
    return (
      <GuessingStage
        item={state.items[state.roundIdx]}
        roundNo={state.roundIdx + 1}
        totalRounds={state.items.length}
        players={activePlayers}
        guesses={state.guesses}
        onSubmit={(player, value) => dispatch({ type: 'SUBMIT_GUESS', player, value })}
      />
    )
  }

  if (state.stage === 'reveal') {
    return (
      <RevealStage
        record={state.history[state.history.length - 1]}
        scores={scores}
        isLastRound={state.roundIdx + 1 >= state.items.length}
        onNext={() => dispatch({ type: 'NEXT_ROUND' })}
      />
    )
  }

  return (
    <ResultStage
      players={activePlayers}
      scores={scores}
      onPlayAgain={() => dispatch({ type: 'PLAY_AGAIN' })}
      onExit={onExit}
    />
  )
}
