import { useReducer, useState } from 'react'
import './anim.css'
import { duelReducer, initDuel } from './engine'
import type { DuelConfig, DuelState } from './types'
import { SetupScreen } from './components/SetupScreen'
import { BattleScreen } from './components/BattleScreen'
import { ResultScreen } from './components/ResultScreen'

// 在线 PvP（stretch / TODO）：
//   复用 @/platform/cloud 现成 RPC（createRoomRpc/joinRoomRpc/hostSetRpc/
//   roomSnapshotRpc/memberSubmitRpc/collectSubmissionsRpc/clearSubmissionsRpc/
//   leaveRoomRpc），参考 src/games/price/PriceRemote.tsx 的房间轮询/提交模式。
//   绝不新增数据库迁移。本次优先做扎实热座 + 人机，在线暂留 TODO。

type Screen = 'setup' | 'battle'

export function KnowledgeDuelGame({ onExit }: { onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>('setup')
  const [config, setConfig] = useState<DuelConfig | null>(null)
  // reducer 用一个占位初始 state；真正开局走 START。
  const [state, dispatch] = useReducer(
    duelReducer,
    null as DuelConfig | null,
    (c): DuelState =>
      c
        ? initDuel(c)
        : initDuel({
            mode: 'hotseat',
            band: 'low',
            topic: 'mix',
            cpuLevel: 'normal',
            left: { name: '玩家一', emoji: '🦊' },
            right: { name: '玩家二', emoji: '🐯' },
            maxHp: 6,
          })
  )

  function handleStart(cfg: DuelConfig) {
    setConfig(cfg)
    dispatch({ type: 'START', config: cfg })
    setScreen('battle')
  }

  if (screen === 'setup' || !config) {
    return (
      <div className="space-y-4">
        <div>
          <button
            type="button"
            onClick={onExit}
            className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
          >
            ← 返回
          </button>
        </div>
        <div>
          <h2 className="font-display text-2xl text-ink-900">⚔️ 我要用知识打败你</h2>
          <p className="text-sm text-ink-600">
            轮流答题对轰：答对一击，连对暴击，答错露破绽自损。谁先血空谁输！
          </p>
        </div>
        <SetupScreen onStart={handleStart} />
      </div>
    )
  }

  if (state.phase === 'over') {
    return (
      <ResultScreen
        state={state}
        onRestart={() => dispatch({ type: 'RESTART' })}
        onNewSetup={() => {
          setScreen('setup')
        }}
        onExit={onExit}
      />
    )
  }

  return (
    <BattleScreen
      state={state}
      config={config}
      dispatch={dispatch}
      onExit={() => setScreen('setup')}
    />
  )
}
