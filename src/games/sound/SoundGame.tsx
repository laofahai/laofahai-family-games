import { useEffect, useState } from 'react'
import { Mic, Ear, ArrowRight, Users, Home, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { contentFor } from '@/platform/content'
import { pickUnseen } from '@/platform/progress'
import { shuffle } from '@/games/shared/question-utils'
import { soundPrompts, type SoundPrompt } from './data/sound-prompts'

type Stage = 'setup' | 'playing'

const ROUND_SECONDS = 30

export function SoundGame({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>('setup')
  const [timed, setTimed] = useState(false)
  const [prompt, setPrompt] = useState<SoundPrompt | null>(null)
  const [count, setCount] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS)

  // 运行时取云端 / 缓存 / 打包副本，再洗牌、按「已见库」挑没玩过的一张
  function drawNext(): SoundPrompt {
    const pool = contentFor('sound', soundPrompts)
    const [picked] = pickUnseen('sound', shuffle(pool), (p) => p.text, 1)
    return picked ?? soundPrompts[0]
  }

  function startGame() {
    setPrompt(drawNext())
    setCount(1)
    setSecondsLeft(ROUND_SECONDS)
    setStage('playing')
  }

  function nextPrompt() {
    setPrompt(drawNext())
    setCount((c) => c + 1)
    setSecondsLeft(ROUND_SECONDS)
  }

  function backToSetup() {
    setStage('setup')
    setPrompt(null)
    setCount(0)
  }

  // 限时模式：每张卡 30 秒倒计时，归零自动停在 0（不强制跳卡，由人决定下一张）
  useEffect(() => {
    if (stage !== 'playing' || !timed) return
    if (secondsLeft <= 0) return
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [stage, timed, secondsLeft])

  if (stage === 'setup') {
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Mic className="h-6 w-6 text-melon-600" />
            声音模仿
          </CardTitle>
          <CardDescription>抽一张卡，模仿上面的声音或口气，其他人猜或打分。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-ink-700">
          <div className="flex items-start gap-3 rounded-2xl border border-ink-100/70 bg-white/70 p-4">
            <Mic className="mt-0.5 h-5 w-5 text-melon-600" />
            <div>
              <div className="font-semibold text-ink-900">轮到你，照着卡片模仿</div>
              <div className="mt-1 text-xs text-ink-600">
                只能用嘴和声音，不能说出卡片上的字，越像越好。
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4">
            <Ear className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <div className="font-semibold text-emerald-900">其他人猜或打分</div>
              <div className="mt-1 text-xs text-emerald-700">
                猜中了就鼓个掌；觉得像就一起喊好评，然后把手机传给下一位。
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-ink-100/70 bg-white/70 p-4">
            <div className="flex items-center gap-3">
              <Timer className="h-5 w-5 text-melon-600" />
              <div>
                <div className="font-semibold text-ink-900">限时模式（可选）</div>
                <div className="mt-0.5 text-xs text-ink-600">每张卡 {ROUND_SECONDS} 秒倒计时</div>
              </div>
            </div>
            <Switch checked={timed} onCheckedChange={setTimed} aria-label="限时模式" />
          </div>
        </CardContent>
        <div className="flex flex-col gap-3 px-6 pb-6">
          <Button onClick={startGame} className="min-h-14 w-full rounded-2xl text-base">
            开始
          </Button>
          <Button
            variant="ghost"
            onClick={onExit}
            className="min-h-14 w-full rounded-2xl text-base text-ink-600"
          >
            <Home className="h-5 w-5" />
            回首页
          </Button>
        </div>
      </Card>
    )
  }

  // playing
  const timeUp = timed && secondsLeft <= 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1 text-sm text-ink-600">
        <span className="font-semibold">已模仿 {count} 张</span>
        {timed && (
          <span
            className={cn(
              'rounded-full px-3 py-1 text-sm font-semibold',
              timeUp ? 'bg-rose-500 text-white' : 'bg-white/80 text-ink-800'
            )}
          >
            {secondsLeft}s
          </span>
        )}
      </div>

      <Card className="paper-grid">
        <CardContent className="flex min-h-[16rem] flex-col items-center justify-center gap-4 py-10 text-center">
          <span className="rounded-full bg-melon-100 px-4 py-1 text-sm font-semibold text-melon-700">
            {prompt?.tag}
          </span>
          <div className="text-sm font-medium text-ink-500">模仿：</div>
          <div className="px-2 text-3xl font-bold leading-snug text-ink-900">{prompt?.text}</div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <Button onClick={nextPrompt} className="min-h-14 w-full rounded-2xl text-base">
          下一张
          <ArrowRight className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          onClick={backToSetup}
          className="min-h-14 w-full rounded-2xl text-base"
        >
          <Users className="h-5 w-5" />
          重新开始 / 换设置
        </Button>
        <Button
          variant="ghost"
          onClick={onExit}
          className="min-h-14 w-full rounded-2xl text-base text-ink-600"
        >
          <Home className="h-5 w-5" />
          回首页
        </Button>
      </div>
    </div>
  )
}
