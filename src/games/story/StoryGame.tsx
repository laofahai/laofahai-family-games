import { useReducer, useState } from 'react'
import type { Duration, RoundResult, Stage, StoryCard, Theme } from './types'
import { drawCards } from './utils/shuffle'
import { contentFor } from '@/platform/content'
import { roomsAvailable } from '@/platform/rooms'
import { StoryRemote } from './StoryRemote'
import { IntroStage } from './stages/IntroStage'
import { SetupStage } from './stages/SetupStage'
import { CountdownStage } from './stages/CountdownStage'
import { PlayingStage } from './stages/PlayingStage'
import { ResultStage } from './stages/ResultStage'

interface StoryGameProps {
  onExit: () => void
}

interface State {
  stage: Stage
  themes: Set<Theme>
  cardCount: 3 | 4 | 5
  durationSec: Duration
  currentCards: StoryCard[]
  history: RoundResult[]
}

type Action =
  | { type: 'GOTO_SETUP' }
  | { type: 'TOGGLE_THEME'; value: Theme }
  | { type: 'SET_CARD_COUNT'; value: 3 | 4 | 5 }
  | { type: 'SET_DURATION'; value: Duration }
  | { type: 'START_COUNTDOWN'; cards: StoryCard[] }
  | { type: 'START_PLAYING' }
  | { type: 'GOTO_RESULT' }
  | { type: 'PASS_AND_NEXT'; cards: StoryCard[] }
  | { type: 'RETRY' }
  | { type: 'RESET_HISTORY' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'GOTO_SETUP':
      return { ...state, stage: 'setup' }
    case 'TOGGLE_THEME': {
      const next = new Set(state.themes)
      if (next.has(action.value)) next.delete(action.value)
      else next.add(action.value)
      return { ...state, themes: next }
    }
    case 'SET_CARD_COUNT':
      return { ...state, cardCount: action.value }
    case 'SET_DURATION':
      return { ...state, durationSec: action.value }
    case 'START_COUNTDOWN':
      return { ...state, stage: 'countdown', currentCards: action.cards }
    case 'START_PLAYING':
      return { ...state, stage: 'playing' }
    case 'GOTO_RESULT':
      return { ...state, stage: 'result' }
    case 'PASS_AND_NEXT':
      return {
        ...state,
        stage: 'countdown',
        history: [...state.history, { cards: state.currentCards, verdict: 'pass' }],
        currentCards: action.cards,
      }
    case 'RETRY':
      return {
        ...state,
        stage: 'countdown',
        history: [...state.history, { cards: state.currentCards, verdict: 'retry' }],
      }
    case 'RESET_HISTORY':
      return { ...state, history: [], currentCards: [], stage: 'setup' }
    default:
      return state
  }
}

function readIntroSeen(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem('story.introSeen') === '1'
}

const INITIAL_THEMES: Set<Theme> = new Set<Theme>(['fairy', 'adventure', 'daily'])

export function StoryGame({ onExit }: StoryGameProps) {
  const [introSeen] = useState(readIntroSeen)
  const [remote, setRemote] = useState(false)
  const [state, dispatch] = useReducer(reducer, {
    stage: introSeen ? 'setup' : 'intro',
    themes: INITIAL_THEMES,
    cardCount: 3,
    durationSec: 90,
    currentCards: [],
    history: [],
  })

  function makeCards(): StoryCard[] {
    return drawCards(contentFor<StoryCard>('story', []), state.themes, state.cardCount)
  }

  if (remote) {
    return <StoryRemote onBack={() => setRemote(false)} />
  }

  if (state.stage === 'intro') {
    return <IntroStage onContinue={() => dispatch({ type: 'GOTO_SETUP' })} />
  }

  if (state.stage === 'setup') {
    return (
      <div className="space-y-4">
        {roomsAvailable() && (
          <button
            type="button"
            onClick={() => setRemote(true)}
            className="rounded-full border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600 transition hover:bg-orange-100"
          >
            📱 各自用自己手机玩（远程）
          </button>
        )}
        <SetupStage
          themes={state.themes}
          cardCount={state.cardCount}
          durationSec={state.durationSec}
          onToggleTheme={(t) => dispatch({ type: 'TOGGLE_THEME', value: t })}
          onChangeCardCount={(n) => dispatch({ type: 'SET_CARD_COUNT', value: n })}
          onChangeDuration={(d) => dispatch({ type: 'SET_DURATION', value: d })}
          onStart={() => {
            const cards = makeCards()
            dispatch({ type: 'START_COUNTDOWN', cards })
          }}
        />
      </div>
    )
  }

  if (state.stage === 'countdown') {
    return <CountdownStage onComplete={() => dispatch({ type: 'START_PLAYING' })} />
  }

  if (state.stage === 'playing') {
    return (
      <PlayingStage
        cards={state.currentCards}
        durationSec={state.durationSec}
        onTimeUp={() => dispatch({ type: 'GOTO_RESULT' })}
        onFinishEarly={() => dispatch({ type: 'GOTO_RESULT' })}
      />
    )
  }

  return (
    <ResultStage
      currentCards={state.currentCards}
      history={state.history}
      onPass={() => dispatch({ type: 'PASS_AND_NEXT', cards: makeCards() })}
      onRetry={() => dispatch({ type: 'RETRY' })}
      onChangeSetup={() => dispatch({ type: 'RESET_HISTORY' })}
      onExit={onExit}
    />
  )
}
