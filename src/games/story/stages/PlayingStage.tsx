import { Check, Pause, Play as PlayIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { StoryCard } from '../types'
import { CATEGORY_LABEL } from '../types'
import { useCountdown } from '../hooks/useCountdown'
import { cn } from '@/lib/utils'

interface PlayingStageProps {
  cards: StoryCard[]
  durationSec: number
  onTimeUp: () => void
  onFinishEarly: () => void
}

const CATEGORY_STYLE: Record<StoryCard['category'], string> = {
  character: 'border-rose-200 bg-rose-50 text-rose-900',
  place: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  item: 'border-amber-200 bg-amber-50 text-amber-900',
  twist: 'border-indigo-200 bg-indigo-50 text-indigo-900',
}

const CATEGORY_BADGE: Record<StoryCard['category'], string> = {
  character: 'bg-rose-500 text-white',
  place: 'bg-emerald-500 text-white',
  item: 'bg-amber-500 text-white',
  twist: 'bg-indigo-500 text-white',
}

export function PlayingStage({ cards, durationSec, onTimeUp, onFinishEarly }: PlayingStageProps) {
  const [running, setRunning] = useState(true)
  const { secondsLeft, progress } = useCountdown({
    durationSec,
    running,
    onElapsed: onTimeUp,
  })
  const last10 = secondsLeft <= 10
  const layoutClass = cards.length >= 4 ? 'sm:grid-cols-2' : ''

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部计时条 */}
      <div className="overflow-hidden rounded-full border border-ink-100/70 bg-white/70 shadow-sm">
        <div className="flex items-center justify-between px-4 py-2">
          <div
            className={cn(
              'rounded-full px-3 py-1 text-sm font-semibold',
              last10 ? 'bg-rose-500 text-white' : 'bg-ink-900 text-white'
            )}
          >
            {secondsLeft}s
          </div>
          <div className="text-xs text-ink-500">把卡片里的词都讲进故事</div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRunning((r) => !r)}
            className="h-8 gap-1 px-3 text-xs"
          >
            {running ? <Pause className="h-3.5 w-3.5" /> : <PlayIcon className="h-3.5 w-3.5" />}
            {running ? '暂停' : '继续'}
          </Button>
        </div>
        <div className="h-1 bg-ink-100">
          <div
            className={cn(
              'h-full transition-[width] duration-100 ease-linear',
              last10 ? 'bg-rose-500' : 'bg-melon-500'
            )}
            style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
          />
        </div>
      </div>

      {/* 关键词卡片 */}
      <div className={cn('grid gap-3', layoutClass)}>
        {cards.map((card, idx) => (
          <div
            key={`${card.text}-${idx}`}
            className={cn(
              'flex flex-col gap-2 rounded-3xl border p-5 shadow-sm',
              CATEGORY_STYLE[card.category]
            )}
          >
            <span
              className={cn(
                'self-start rounded-full px-3 py-0.5 text-xs font-semibold',
                CATEGORY_BADGE[card.category]
              )}
            >
              {CATEGORY_LABEL[card.category]}
            </span>
            <div className="font-display text-2xl leading-snug sm:text-3xl">{card.text}</div>
          </div>
        ))}
      </div>

      {/* 底部操作 */}
      <Button onClick={onFinishEarly} className="h-12 w-full gap-2">
        <Check className="h-4 w-4" />
        讲完了
      </Button>
    </div>
  )
}
