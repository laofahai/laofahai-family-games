// 开始 / 胜利 / 失败 三块全屏浮层（thin）：纯展示 + 按钮回调，不持有游戏逻辑。

import { Button } from '@/components/ui/button'

/** 开始页：显示主角名、关数、是否有存档，给「从头打 / 继续」。 */
export function StartScreen({
  playerName,
  totalLevels,
  savedLevel,
  onStartFresh,
  onContinue,
}: {
  playerName: string
  totalLevels: number
  savedLevel: number | null
  onStartFresh: () => void
  onContinue: () => void
}) {
  const canContinue = savedLevel != null && savedLevel > 0 && savedLevel < totalLevels
  return (
    <Center>
      <div className="text-6xl">🥊</div>
      <h2 className="font-display text-3xl text-white">课间大乱斗</h2>
      <p className="max-w-sm text-sm text-white/80">
        揍翻拦路同学，闯过 {totalLevels} 关。关底老师有「学霸护盾」，得靠 <b>答题</b> 才能打破！
        能量满了按技能放 <b>学霸大招</b>。
      </p>
      <p className="text-sm text-white/70">主角：{playerName}</p>
      <div className="mt-2 flex flex-col items-stretch gap-2">
        {canContinue && (
          <Button onClick={onContinue} size="lg" className="min-w-56">
            继续（第 {savedLevel + 1} 关）
          </Button>
        )}
        <Button onClick={onStartFresh} size="lg" variant={canContinue ? 'outline' : 'default'} className="min-w-56">
          从头开打
        </Button>
      </div>
      <p className="mt-2 text-xs text-white/60">
        键盘：A/D 或 ←/→ 移动，W/↑/空格 跳，J 攻击，K 大招，L 切换技能。手机用屏幕按钮。
      </p>
    </Center>
  )
}

/** 胜利页：通关庆祝。 */
export function WinScreen({ onAgain, onExit }: { onAgain: () => void; onExit: () => void }) {
  return (
    <Center>
      <div className="bs-cap-toss text-7xl">🎓</div>
      <h2 className="font-display text-4xl text-white">通关啦！</h2>
      <p className="max-w-sm text-sm text-white/80">所有老师都被你用知识打败了，太学霸了！</p>
      <div className="mt-2 flex gap-2">
        <Button onClick={onAgain} size="lg">
          再来一遍
        </Button>
        <Button onClick={onExit} size="lg" variant="outline">
          返回首页
        </Button>
      </div>
    </Center>
  )
}

/** 失败页：可重试本关。 */
export function LoseScreen({ onRetry, onExit }: { onRetry: () => void; onExit: () => void }) {
  return (
    <Center>
      <div className="text-7xl">😵</div>
      <h2 className="font-display text-4xl text-white">被打趴了…</h2>
      <p className="max-w-sm text-sm text-white/80">别灰心，多答对几道题就能反败为胜！</p>
      <div className="mt-2 flex gap-2">
        <Button onClick={onRetry} size="lg">
          重试本关
        </Button>
        <Button onClick={onExit} size="lg" variant="outline">
          返回首页
        </Button>
      </div>
    </Center>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-ink-900/85 to-ink-900/95 p-6 text-center backdrop-blur">
      {children}
    </div>
  )
}
