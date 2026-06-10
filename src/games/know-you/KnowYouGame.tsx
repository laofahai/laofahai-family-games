import { useReducer, useState } from 'react'
import type { KnowQuestion, QuestionsPerRole, RoleId, RoundRecord, Stage } from './types'
import { knowQuestions } from './data/know-questions'
import { buildDeck } from './utils/buildDeck'
import { IntroStage } from './stages/IntroStage'
import { SetupStage } from './stages/SetupStage'
import { PlayingStage } from './stages/PlayingStage'
import { ResultStage } from './stages/ResultStage'

interface KnowYouGameProps {
  onExit: () => void
}

interface State {
  stage: Stage
  players: Set<RoleId>
  perRole: QuestionsPerRole
  deck: KnowQuestion[]
  index: number
  records: RoundRecord[]
  usedTexts: Set<string>
}

type Action =
  | { type: 'GOTO_SETUP' }
  | { type: 'TOGGLE_PLAYER'; value: RoleId }
  | { type: 'SET_PER_ROLE'; value: QuestionsPerRole }
  | { type: 'START'; deck: KnowQuestion[] }
  | { type: 'SUBMIT_ROUND'; correctGuessers: RoleId[] }
  | { type: 'NEXT_GAME'; deck: KnowQuestion[] }
  | { type: 'CHANGE_SETUP' }

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
    case 'SET_PER_ROLE':
      return { ...state, perRole: action.value }
    case 'START':
      return { ...state, stage: 'playing', deck: action.deck, index: 0, records: [] }
    case 'SUBMIT_ROUND': {
      const question = state.deck[state.index]
      const records = [...state.records, { question, correctGuessers: action.correctGuessers }]
      const usedTexts = new Set(state.usedTexts)
      usedTexts.add(question.text)
      const done = state.index + 1 >= state.deck.length
      return {
        ...state,
        records,
        usedTexts,
        index: done ? state.index : state.index + 1,
        stage: done ? 'result' : 'playing',
      }
    }
    case 'NEXT_GAME':
      return { ...state, stage: 'playing', deck: action.deck, index: 0, records: [] }
    case 'CHANGE_SETUP':
      return { ...state, stage: 'setup', deck: [], index: 0, records: [] }
    default:
      return state
  }
}

function readIntroSeen(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem('knowYou.introSeen') === '1'
}

const ALL_PLAYERS: Set<RoleId> = new Set<RoleId>(['dad', 'mom', 'bigSis', 'lilSis'])

export function KnowYouGame({ onExit }: KnowYouGameProps) {
  const [introSeen] = useState(readIntroSeen)
  const [state, dispatch] = useReducer(reducer, {
    stage: introSeen ? 'setup' : 'intro',
    players: new Set(ALL_PLAYERS),
    perRole: 5,
    deck: [],
    index: 0,
    records: [],
    usedTexts: new Set<string>(),
  })

  function makeDeck(): KnowQuestion[] {
    return buildDeck(knowQuestions, [...state.players], state.perRole, state.usedTexts)
  }

  if (state.stage === 'intro') {
    return <IntroStage onContinue={() => dispatch({ type: 'GOTO_SETUP' })} />
  }

  if (state.stage === 'setup') {
    return (
      <SetupStage
        players={state.players}
        perRole={state.perRole}
        onTogglePlayer={(r) => dispatch({ type: 'TOGGLE_PLAYER', value: r })}
        onChangePerRole={(n) => dispatch({ type: 'SET_PER_ROLE', value: n })}
        onStart={() => dispatch({ type: 'START', deck: makeDeck() })}
      />
    )
  }

  if (state.stage === 'playing') {
    const question = state.deck[state.index]
    return (
      <PlayingStage
        key={state.index}
        question={question}
        players={[...state.players]}
        index={state.index}
        total={state.deck.length}
        onSubmit={(correctGuessers) => dispatch({ type: 'SUBMIT_ROUND', correctGuessers })}
      />
    )
  }

  return (
    <ResultStage
      records={state.records}
      players={[...state.players]}
      onNextGame={() => dispatch({ type: 'NEXT_GAME', deck: makeDeck() })}
      onChangeSetup={() => dispatch({ type: 'CHANGE_SETUP' })}
      onExit={onExit}
    />
  )
}
