import { useReducer, useState } from 'react'
import type {
  PlayerId,
  RoundRecord,
  RoundsPerPlayer,
  Stage,
  StatementIndex,
  TruthTopic,
} from './types'
import { getRosterIds, setRoster } from '@/platform/session'
import { pickTopic } from './utils/pickTopic'
import { IntroStage } from './stages/IntroStage'
import { SetupStage } from './stages/SetupStage'
import { TellStage } from './stages/TellStage'
import { VoteStage } from './stages/VoteStage'
import { RevealStage } from './stages/RevealStage'
import { ResultStage } from './stages/ResultStage'

interface TruthLieGameProps {
  onExit: () => void
}

interface State {
  stage: Stage
  /** 本局玩家（有序，来自平台名单：家人 + 朋友/其他人） */
  playerIds: string[]
  roundsPerPlayer: RoundsPerPlayer
  /** 主角出场顺序 */
  queue: PlayerId[]
  roundIdx: number
  topic: TruthTopic
  votes: Partial<Record<PlayerId, StatementIndex>>
  history: RoundRecord[]
}

type Action =
  | { type: 'GOTO_SETUP' }
  | { type: 'SET_PLAYERS'; value: string[] }
  | { type: 'SET_ROUNDS'; value: RoundsPerPlayer }
  | { type: 'START'; queue: PlayerId[]; topic: TruthTopic }
  | { type: 'SWAP_TOPIC'; topic: TruthTopic }
  | { type: 'GOTO_VOTE' }
  | { type: 'VOTE'; voter: PlayerId; index: StatementIndex }
  | { type: 'GOTO_REVEAL' }
  | { type: 'CONFIRM_LIE'; lieIndex: StatementIndex }
  | { type: 'NEXT_ROUND'; topic: TruthTopic }
  | { type: 'PLAY_AGAIN' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'GOTO_SETUP':
      return { ...state, stage: 'setup' }
    case 'SET_PLAYERS':
      return { ...state, playerIds: action.value }
    case 'SET_ROUNDS':
      return { ...state, roundsPerPlayer: action.value }
    case 'START':
      return {
        ...state,
        stage: 'tell',
        queue: action.queue,
        roundIdx: 0,
        topic: action.topic,
        votes: {},
        history: [],
      }
    case 'SWAP_TOPIC':
      return { ...state, topic: action.topic }
    case 'GOTO_VOTE':
      return { ...state, stage: 'vote', votes: {} }
    case 'VOTE':
      return { ...state, votes: { ...state.votes, [action.voter]: action.index } }
    case 'GOTO_REVEAL':
      return { ...state, stage: 'reveal' }
    case 'CONFIRM_LIE':
      return {
        ...state,
        history: [
          ...state.history,
          { teller: state.queue[state.roundIdx], lieIndex: action.lieIndex, votes: state.votes },
        ],
      }
    case 'NEXT_ROUND': {
      const isLast = state.roundIdx + 1 >= state.queue.length
      if (isLast) return { ...state, stage: 'result' }
      return {
        ...state,
        stage: 'tell',
        roundIdx: state.roundIdx + 1,
        topic: action.topic,
        votes: {},
      }
    }
    case 'PLAY_AGAIN':
      return { ...state, stage: 'setup' }
    default:
      return state
  }
}

function readIntroSeen(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem('truthLie.introSeen') === '1'
}

export function TruthLieGame({ onExit }: TruthLieGameProps) {
  const [introSeen] = useState(readIntroSeen)
  const [state, dispatch] = useReducer(reducer, {
    stage: introSeen ? 'setup' : 'intro',
    playerIds: getRosterIds(),
    roundsPerPlayer: 1,
    queue: [],
    roundIdx: 0,
    topic: pickTopic(),
    votes: {},
    history: [],
  })

  const teller = state.queue[state.roundIdx]
  const activePlayers = state.playerIds
  const voters = activePlayers.filter((p) => p !== teller)

  if (state.stage === 'intro') {
    return <IntroStage onContinue={() => dispatch({ type: 'GOTO_SETUP' })} />
  }

  if (state.stage === 'setup') {
    return (
      <SetupStage
        selectedIds={state.playerIds}
        roundsPerPlayer={state.roundsPerPlayer}
        onChangePlayers={(ids) => dispatch({ type: 'SET_PLAYERS', value: ids })}
        onChangeRounds={(n) => dispatch({ type: 'SET_ROUNDS', value: n })}
        onStart={() => {
          setRoster(state.playerIds)
          const queue: PlayerId[] = []
          for (let i = 0; i < state.roundsPerPlayer; i += 1) queue.push(...activePlayers)
          dispatch({ type: 'START', queue, topic: pickTopic() })
        }}
      />
    )
  }

  if (state.stage === 'tell') {
    return (
      <TellStage
        teller={teller}
        roundNo={state.roundIdx + 1}
        totalRounds={state.queue.length}
        topic={state.topic}
        onSwapTopic={() => dispatch({ type: 'SWAP_TOPIC', topic: pickTopic(state.topic) })}
        onDone={() => dispatch({ type: 'GOTO_VOTE' })}
      />
    )
  }

  if (state.stage === 'vote') {
    return (
      <VoteStage
        teller={teller}
        voters={voters}
        votes={state.votes}
        onVote={(voter, index) => dispatch({ type: 'VOTE', voter, index })}
        onReveal={() => dispatch({ type: 'GOTO_REVEAL' })}
      />
    )
  }

  if (state.stage === 'reveal') {
    return (
      <RevealStage
        teller={teller}
        votes={state.votes}
        isLastRound={state.roundIdx + 1 >= state.queue.length}
        onConfirm={(lieIndex) => dispatch({ type: 'CONFIRM_LIE', lieIndex })}
        onNext={() => dispatch({ type: 'NEXT_ROUND', topic: pickTopic(state.topic) })}
      />
    )
  }

  return (
    <ResultStage
      players={activePlayers}
      history={state.history}
      onPlayAgain={() => dispatch({ type: 'PLAY_AGAIN' })}
      onExit={onExit}
    />
  )
}
