import { useState } from 'react'
import { Check, Eye, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DrawSettings, DrawWord } from '../types'
import { useCountdown } from '../hooks/useCountdown'
import { DrawCanvas } from '../components/DrawCanvas'
import { cn } from '@/lib/utils'

interface DrawingStageProps {
  word: DrawWord
  durationSec: number
  settings: DrawSettings
  onGuessed: () => void
  onGiveUp: () => void
  onTimeout: () => void
}

export function DrawingStage({ word, durationSec, settings, onGuessed, onGiveUp, onTimeout }: DrawingStageProps) {
  const [peeking, setPeeking] = useState(false)
  const { secondsLeft, progress } = useCountdown({
    durationSec,
    running: true,
    onElapsed: onTimeout,
  })
  const urgent = secondsLeft <= 10

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-ink-100/70 bg-white/80 p-3">
        {settings.showCategory ? (
          <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-700">
            提示：{word.hint}
          </span>
        ) : (
          <span className="rounded-full bg-ink-100/60 px-3 py-1 text-xs font-medium text-ink-400">
            🙈 类别已隐藏
          </span>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onPointerDown={() => setPeeking(true)}
            onPointerUp={() => setPeeking(false)}
            onPointerLeave={() => setPeeking(false)}
            className="flex items-center gap-1 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-600"
          >
            <Eye className="h-3.5 w-3.5" />
            按住看词
          </button>
          <span
            className={cn(
              'font-display text-2xl tabular-nums',
              urgent ? 'text-rose-600' : 'text-ink-900'
            )}
          >
            {secondsLeft}s
          </span>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn('h-full rounded-full transition-[width]', urgent ? 'bg-rose-500' : 'bg-melon-500')}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <DrawCanvas />

      <div className="flex gap-3">
        <Button variant="outline" onClick={onGiveUp} className="h-14 flex-1 gap-2 text-base">
          <Flag className="h-5 w-5" />
          画不出来
        </Button>
        <Button
          onClick={onGuessed}
          className="h-14 flex-[2] gap-2 bg-emerald-600 text-base hover:bg-emerald-700"
        >
          <Check className="h-5 w-5" />
          猜对了！
        </Button>
      </div>

      {peeking && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-2xl bg-ink-900/90 px-6 py-3 text-center shadow-lg">
          <div className="text-xs text-white/70">{word.hint}</div>
          <div className="font-display text-3xl text-white">{word.text}</div>
        </div>
      )}
    </div>
  )
}
