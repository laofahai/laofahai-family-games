// 课间大乱斗 · React 入口（薄壳）。职责仅三件：
//   1) 挂载 / 销毁 Phaser.Game（ArenaScene 拥有整局逻辑、物理、输入、战斗、波次、BOSS）；
//   2) 订阅事件桥把场景推来的状态画成 HUD / 答题弹窗 / 结果闪现 / 胜负页（thin 浮层）；
//   3) 把触屏 / 答题 / 静音意图经 GameControls 喂回场景。
// 这里【没有任何游戏逻辑】：移动/碰撞/伤害/AI/出题全在 Phaser 端。
// 导出名与 props（{ player, onExit }）保持不变，App 的懒加载照旧。

import { useEffect, useRef, useState } from 'react'
import './anim.css'
import { rosterFor } from '@/games/_battle/roster'
import { contentFor } from '@/platform/content'
import { initSfx } from '@/games/shared/sound'
import { loadSavedLevel } from './storage'
import { createGame } from './game/createGame'
import {
  GameBridge,
  type GameControls,
  type HudState,
  type QuizOpenPayload,
  type ResultPayload,
  type SceneConfig,
} from './game/bridge'
import { Hud } from './ui/Hud'
import { QuizModal } from './ui/QuizModal'
import { ResultFlash } from './ui/ResultFlash'
import { StartScreen, WinScreen, LoseScreen } from './ui/Screens'
import { TouchControls } from './ui/TouchControls'

type Phase = 'start' | 'playing' | 'won' | 'lost'

export function BattleSchoolGame({ onExit, player }: { onExit: () => void; player: string }) {
  const roster = rosterFor(player)
  const totalLevels = roster.bosses.length

  const [phase, setPhase] = useState<Phase>('start')
  const [startLevel, setStartLevel] = useState(0)
  const [savedLevel] = useState<number | null>(() => loadSavedLevel(player))
  // 每次开局 +1，强制重挂 Phaser 容器（彻底重置场景）。
  const [runKey, setRunKey] = useState(0)

  // 内容只在 DB：题库没拉到就别进对局（App 已有内容门，这里再兜一层）。
  const hasQuestions = contentFor('battle-questions', []).length > 0

  function begin(level: number) {
    initSfx()
    setStartLevel(level)
    setRunKey((k) => k + 1)
    setPhase('playing')
  }

  if (!hasQuestions) {
    return (
      <div className="rounded-3xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
        题库还没加载好，请回首页用网络重进一次。
      </div>
    )
  }

  return (
    // 全屏舞台容器：Phaser 用 Scale.RESIZE 填满它，浮层绝对定位盖在上面。
    <div className="relative h-[78vh] min-h-[520px] w-full overflow-hidden rounded-3xl bg-ink-900 shadow-xl">
      {phase === 'start' ? (
        <StartScreen
          playerName={roster.player}
          totalLevels={totalLevels}
          savedLevel={savedLevel}
          onStartFresh={() => begin(0)}
          onContinue={() => begin(Math.min(savedLevel ?? 0, totalLevels - 1))}
        />
      ) : (
        <PlayRun
          key={runKey}
          player={player}
          band={roster.band}
          startLevel={startLevel}
          onBack={() => setPhase('start')}
          onWon={() => setPhase('won')}
          onLost={() => setPhase('lost')}
        />
      )}

      {phase === 'won' && <WinScreen onAgain={() => begin(0)} onExit={onExit} />}
      {phase === 'lost' && <LoseScreen onRetry={() => begin(startLevel)} onExit={onExit} />}
    </div>
  )
}

/** 一次对局：挂 Phaser + 桥接事件 + 渲染游戏内浮层。runKey 变化即整体重挂。 */
function PlayRun({
  player,
  band,
  startLevel,
  onBack,
  onWon,
  onLost,
}: {
  player: string
  band: SceneConfig['band']
  startLevel: number
  onBack: () => void
  onWon: () => void
  onLost: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)

  const [controls, setControls] = useState<GameControls | null>(null)
  const [hud, setHud] = useState<HudState | null>(null)
  const [quiz, setQuiz] = useState<QuizOpenPayload | null>(null)
  const [result, setResult] = useState<ResultPayload | null>(null)

  // 用 ref 持有父级回调，避免它们进 effect 依赖导致重挂 Phaser（ref 只在 effect 里写）。
  const cbRef = useRef({ onWon, onLost })
  useEffect(() => {
    cbRef.current = { onWon, onLost }
  })

  // 挂载 / 销毁 Phaser + 桥接事件。只跑一次（开局参数随 runKey 重挂时已是新实例）。
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const bridge = new GameBridge()

    const offs = [
      bridge.on('hud', (s) => setHud(s)),
      bridge.on('quiz:open', (q) => setQuiz(q)),
      bridge.on('quiz:close', () => setQuiz(null)),
      bridge.on('result', (r) => setResult(r)),
      bridge.on('gameover', (g) => (g === 'won' ? cbRef.current.onWon() : cbRef.current.onLost())),
    ]

    const cfg: SceneConfig = {
      player,
      band,
      startLevel,
      bridge,
      onControls: (c) => setControls(c),
    }
    const game = createGame(host, cfg)

    return () => {
      offs.forEach((off) => off())
      bridge.clear()
      game.destroy(true)
    }
  }, [player, band, startLevel])

  const c = controls

  return (
    <>
      <div ref={hostRef} className="absolute inset-0" />

      {hud && c && (
        <Hud hud={hud} onBack={onBack} onToggleMute={() => c.toggleMute()} />
      )}

      {hud && c && (
        <TouchControls
          controls={c}
          skill={hud.skill}
          energyFull={hud.energy >= 1}
          onSwitchSkill={() => c.switchSkill()}
        />
      )}

      {quiz && c && (
        <QuizModal key={quiz.question.id} payload={quiz} onSubmit={(id) => c.submitAnswer(id)} />
      )}

      {result && <ResultFlash result={result} onDone={() => setResult(null)} />}
    </>
  )
}
