import { useEffect, useReducer, useState } from 'react'
import type { Difficulty, Duration, RoundResult, Stage, WordEntry } from './types'
import { charadesWords } from './data/charades-words'
import { shuffledPool } from './utils/shuffle'
import { useStoredFlag } from './hooks/useStoredFlag'
import { useMotionPermission } from './hooks/useMotionPermission'
import { IntroStage } from './stages/IntroStage'
import { SetupStage } from './stages/SetupStage'
import { CountdownStage } from './stages/CountdownStage'
import { PlayingStage } from './stages/PlayingStage'
import { ResultStage } from './stages/ResultStage'

interface CharadesGameProps {
  onExit: () => void
}

interface State {
  stage: Stage
  difficulties: Set<Difficulty>
  durationSec: Duration
  pool: WordEntry[]
  cursor: number
  results: RoundResult[]
}

type Action =
  | { type: 'GOTO_SETUP' }
  | { type: 'TOGGLE_DIFFICULTY'; value: Difficulty }
  | { type: 'SET_DURATION'; value: Duration }
  | { type: 'START_COUNTDOWN' }
  | { type: 'START_PLAYING'; pool: WordEntry[] }
  | { type: 'MARK'; outcome: 'correct' | 'pass' }
  | { type: 'TIME_UP' }
  | { type: 'PLAY_AGAIN'; pool: WordEntry[] }

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
    case 'START_COUNTDOWN':
      return { ...state, stage: 'countdown' }
    case 'START_PLAYING':
      return {
        ...state,
        stage: 'playing',
        pool: action.pool,
        cursor: 0,
        results: [],
      }
    case 'MARK': {
      const word = state.pool[state.cursor]
      if (!word) return state
      return {
        ...state,
        cursor: state.cursor + 1,
        results: [...state.results, { word, outcome: action.outcome }],
      }
    }
    case 'TIME_UP':
      return { ...state, stage: 'result' }
    case 'PLAY_AGAIN':
      return {
        ...state,
        stage: 'countdown',
        pool: action.pool,
        cursor: 0,
        results: [],
      }
    default:
      return state
  }
}

function readIntroSeen(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem('charades.introSeen') === '1'
}

const INITIAL_DIFFICULTIES: Set<Difficulty> = new Set<Difficulty>(['easy', 'medium'])

export function CharadesGame({ onExit }: CharadesGameProps) {
  const [introSeen] = useState(readIntroSeen)
  const [state, dispatch] = useReducer(reducer, {
    stage: introSeen ? 'setup' : 'intro',
    difficulties: INITIAL_DIFFICULTIES,
    durationSec: 90,
    pool: [],
    cursor: 0,
    results: [],
  })
  const [sound, setSound] = useStoredFlag('charades.sound', true)
  const [haptic, setHaptic] = useStoredFlag('charades.haptic', true)
  const { status: motionStatus } = useMotionPermission()

  // 当当前题被翻到底部（cursor 越过 pool 长度），强制结束
  useEffect(() => {
    if (state.stage !== 'playing') return
    if (state.cursor >= state.pool.length) {
      dispatch({ type: 'TIME_UP' })
    }
  }, [state.stage, state.cursor, state.pool.length])

  function makePool() {
    return shuffledPool(charadesWords, state.difficulties)
  }

  const currentWord = state.pool[state.cursor]

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
        onStart={() => dispatch({ type: 'START_COUNTDOWN' })}
      />
    )
  }

  if (state.stage === 'countdown') {
    return (
      <CountdownStage
        onComplete={() => {
          const pool = makePool()
          if (pool.length === 0) {
            // 不该发生（UI 已限制），保护性回到设置
            dispatch({ type: 'GOTO_SETUP' })
            return
          }
          dispatch({ type: 'START_PLAYING', pool })
        }}
      />
    )
  }

  if (state.stage === 'playing') {
    if (!currentWord) return null
    return (
      <PlayingStage
        word={currentWord}
        durationSec={state.durationSec}
        motionStatus={motionStatus}
        sound={sound}
        haptic={haptic}
        onToggleSound={() => setSound((v) => !v)}
        onToggleHaptic={() => setHaptic((v) => !v)}
        onCorrect={() => dispatch({ type: 'MARK', outcome: 'correct' })}
        onPass={() => dispatch({ type: 'MARK', outcome: 'pass' })}
        onTimeUp={() => dispatch({ type: 'TIME_UP' })}
      />
    )
  }

  return (
    <ResultStage
      results={state.results}
      onPlayAgain={() => dispatch({ type: 'PLAY_AGAIN', pool: makePool() })}
      onChangeSetup={() => dispatch({ type: 'GOTO_SETUP' })}
      onExit={onExit}
    />
  )
}
