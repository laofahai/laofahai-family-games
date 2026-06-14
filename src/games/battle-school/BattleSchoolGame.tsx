// 打老师·主组件。逻辑全在 React(useReducer)，Phaser 只当可视化舞台。
// 产品是「多人原生」：单人 = 一人房。开始页 →（可选）共斗大厅 → 对局。
//
// 关键约束（遵守项目 ESLint）：
//  - 不在 effect 里同步 setState 业务；倒计时在子组件用 interval + cleanup。
//  - fx 驱动 effect 只调 Phaser（命令式），不 setState；推进/继续靠用户点「继续」dispatch。
//  - 不在 render 期间读写 ref.current（ref 仅在事件/effect/回调里用）。
//
// 共斗频道（useCoopRoom）建在父组件，跨「大厅↔对局」存活；PlayingView 用 gameKey 重挂不影响它。

import { useState } from 'react'
import './anim.css'
import { rosterFor } from '@/games/_battle/roster'
import { selfPeerId } from '@/games/_battle/coop'
import { contentFor } from '@/platform/content'
import { loadSavedLevel } from './storage'
import { BackBar } from './components/BackBar'
import { StartScreen } from './components/StartScreen'
import { CoopLobby } from './components/CoopLobby'
import { PlayingView } from './PlayingView'
import { useCoopRoom, type CoopMe } from './useCoopRoom'
import { HERO_HP } from './reducer'

type Mode = 'start' | 'coop-lobby' | 'playing'

export function BattleSchoolGame({ onExit, player }: { onExit: () => void; player: string }) {
  const roster = rosterFor(player)
  const totalLevels = roster.bosses.length

  const [mode, setMode] = useState<Mode>('start')
  const [savedLevel, setSavedLevel] = useState<number | null>(() => loadSavedLevel(player))
  // gameKey 变化即重挂对局（重置 reducer + Phaser）；startLevel 决定从第几关开。
  const [gameKey, setGameKey] = useState(0)
  const [startLevel, setStartLevel] = useState(0)
  const [coopMode, setCoopMode] = useState(false)

  const room = useCoopRoom()

  const me: CoopMe = {
    id: selfPeerId(),
    name: roster.player,
    emoji: '🧒',
    band: roster.band,
    heroMaxHp: HERO_HP,
  }

  function beginSolo(level: number) {
    setCoopMode(false)
    setStartLevel(level)
    setGameKey((k) => k + 1)
    setMode('playing')
  }

  function beginCoop() {
    // 共斗总是从第 1 关开始（共享进度，不读单人存档）。
    setCoopMode(true)
    setStartLevel(0)
    setGameKey((k) => k + 1)
    setMode('playing')
  }

  // 内容只在 DB：题库没拉到就别进对局（避免抽不到题）。App 已有内容启动门，这里再兜一层。
  if (contentFor('battle-questions', []).length === 0) {
    return (
      <div className="space-y-4">
        <BackBar onExit={onExit} />
        <div className="rounded-3xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
          题库还没加载好，请回首页用网络重进一次。
        </div>
      </div>
    )
  }

  // ── 开始页 ───────────────────────────────────────────────────────
  if (mode === 'start') {
    return (
      <div className="space-y-4">
        <BackBar onExit={onExit} />
        <StartScreen
          playerName={roster.player}
          totalLevels={totalLevels}
          savedLevel={savedLevel}
          onStartFresh={() => beginSolo(0)}
          onContinue={() => beginSolo(Math.min(savedLevel ?? 0, totalLevels - 1))}
          onCoop={() => setMode('coop-lobby')}
        />
      </div>
    )
  }

  // ── 共斗大厅 ─────────────────────────────────────────────────────
  if (mode === 'coop-lobby') {
    return (
      <div className="space-y-4">
        <BackBar onExit={onExit} />
        <CoopLobby
          playerName={roster.player}
          code={room.code}
          isHost={room.isHost}
          players={room.players}
          inRoom={room.code != null}
          onHost={() => room.host(me)}
          onJoin={(c) => room.join(c, me)}
          onStart={beginCoop}
          onSolo={() => beginSolo(0)}
          onLeave={() => room.leave()}
          onBack={() => {
            room.leave()
            setMode('start')
          }}
        />
      </div>
    )
  }

  return (
    <PlayingView
      key={gameKey}
      player={player}
      startLevel={startLevel}
      coop={coopMode ? { room, me } : undefined}
      onExit={() => {
        room.leave()
        onExit()
      }}
      onBackToStart={() => {
        setSavedLevel(loadSavedLevel(player))
        room.leave()
        setMode('start')
      }}
    />
  )
}
