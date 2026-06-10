import { useReducer, useState } from 'react'
import type { DrawDifficulty, DrawWord, Duration, RoundOutcome, RoundRecord, Stage } from './types'
import { pickWord } from './utils/pickWord'
import { IntroStage } from './stages/IntroStage'
import { SetupStage } from './stages/SetupStage'
import { PreviewStage } from './stages/PreviewStage'
import { DrawingStage } from './stages/DrawingStage'
import { RoundEndStage } from './stages/RoundEndStage'
import { ResultStage } from './stages/ResultStage'

interface DrawGameProps {
  onExit: () => void
}

interface State {
  stage: Stage
  difficulties: Set<DrawDifficulty>
  durationSec: Duration
  word: DrawWord | null
  /** 本局出现过的词，避免重复 */
  usedTexts: Set<string>
  lastOutcome: RoundOutcome
  history: RoundRecord[]
}

type Action =
  | { type: 'GOTO_SETUP' }
  | { type: 'TOGGLE_DIFFICULTY'; value: DrawDifficulty }
  | { type: 'SET_DURATION'; value: Duration }
  | { type: 'NEW_ROUND'; word: DrawWord }
  | { type: 'SWAP_WORD'; word: DrawWord }
  | { type: 'START_DRAWING' }
  | { type: 'END_ROUND'; outcome: RoundOutcome }
  | { type: 'GOTO_RESULT' }
  | { type: 'PLAY_AGAIN' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'GOTO_SETUP':
      return { ...state, stage: 'setup' }
    case 'TOGGLE_DIFFICULTY': {
      const next = new Set(state.difficulties)
      if (next.has(action.value)) next.delete(action.value)
      else next.add(action.value)
      return { ...state, difficulties: next }
    }
    case 'SET_DURATION':
      return { ...state, durationSec: action.value }
    case 'NEW_ROUND':
      return {
        ...state,
        stage: 'preview',
        word: action.word,
        usedTexts: new Set(state.usedTexts).add(action.word.text),
      }
    case 'SWAP_WORD':
      return {
        ...state,
        word: action.word,
        usedTexts: new Set(state.usedTexts).add(action.word.text),
      }
    case 'START_DRAWING':
      return { ...state, stage: 'drawing' }
    case 'END_ROUND': {
      if (!state.word) return state
      return {
        ...state,
        stage: 'roundEnd',
        lastOutcome: action.outcome,
        history: [...state.history, { word: state.word, outcome: action.outcome }],
      }
    }
    case 'GOTO_RESULT':
      return { ...state, stage: 'result' }
    case 'PLAY_AGAIN':
      return { ...state, stage: 'setup', history: [], usedTexts: new Set(), word: null }
    default:
      return state
  }
}

function readIntroSeen(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem('draw.introSeen') === '1'
}

export function DrawGame({ onExit }: DrawGameProps) {
  const [introSeen] = useState(readIntroSeen)
  const [state, dispatch] = useReducer(reducer, {
    stage: introSeen ? 'setup' : 'intro',
    difficulties: new Set<DrawDifficulty>(['easy', 'medium']),
    durationSec: 90,
    word: null,
    usedTexts: new Set<string>(),
    lastOutcome: 'guessed',
    history: [],
  })

  function nextWord(): DrawWord {
    return pickWord(state.difficulties, state.usedTexts)
  }

  if (state.stage === 'intro') {
    return <IntroStage onContinue={() => dispatch({ type: 'GOTO_SETUP' })} />
  }

  if (state.stage === 'setup') {
    return (
      <SetupStage
        difficulties={state.difficulties}
        durationSec={state.durationSec}
        onToggleDifficulty={(d) => dispatch({ type: 'TOGGLE_DIFFICULTY', value: d })}
        onChangeDuration={(d) => dispatch({ type: 'SET_DURATION', value: d })}
        onStart={() => dispatch({ type: 'NEW_ROUND', word: nextWord() })}
      />
    )
  }

  if (state.stage === 'preview' && state.word) {
    return (
      <PreviewStage
        word={state.word}
        roundNo={state.history.length + 1}
        onSwapWord={() => dispatch({ type: 'SWAP_WORD', word: nextWord() })}
        onStartDrawing={() => dispatch({ type: 'START_DRAWING' })}
      />
    )
  }

  if (state.stage === 'drawing' && state.word) {
    return (
      <DrawingStage
        word={state.word}
        durationSec={state.durationSec}
        onGuessed={() => dispatch({ type: 'END_ROUND', outcome: 'guessed' })}
        onGiveUp={() => dispatch({ type: 'END_ROUND', outcome: 'giveup' })}
        onTimeout={() => dispatch({ type: 'END_ROUND', outcome: 'timeout' })}
      />
    )
  }

  if (state.stage === 'roundEnd' && state.word) {
    return (
      <RoundEndStage
        word={state.word}
        outcome={state.lastOutcome}
        onNextRound={() => dispatch({ type: 'NEW_ROUND', word: nextWord() })}
        onFinish={() => dispatch({ type: 'GOTO_RESULT' })}
      />
    )
  }

  return (
    <ResultStage
      history={state.history}
      onPlayAgain={() => dispatch({ type: 'PLAY_AGAIN' })}
      onExit={onExit}
    />
  )
}
