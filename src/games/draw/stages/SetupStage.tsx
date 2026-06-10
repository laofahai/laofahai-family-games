import { Play, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DrawDifficulty, Duration } from '../types'
import { DIFFICULTY_LABEL } from '../types'
import { cn } from '@/lib/utils'

interface SetupStageProps {
  difficulties: Set<DrawDifficulty>
  durationSec: Duration
  onToggleDifficulty: (d: DrawDifficulty) => void
  onChangeDuration: (d: Duration) => void
  onStart: () => void
}

const DIFFICULTY_ORDER: DrawDifficulty[] = ['easy', 'medium', 'hard']
const DURATIONS: Duration[] = [60, 90, 120]

export function SetupStage({
  difficulties,
  durationSec,
  onToggleDifficulty,
  onChangeDuration,
  onStart,
}: SetupStageProps) {
  const canStart = difficulties.size > 0

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Settings2 className="h-5 w-5 text-melon-600" />
          开局设置
        </CardTitle>
        <CardDescription>选词的难度和每轮时长，画手轮流换人。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink-700">词的难度（可多选）</div>
          <div className="grid grid-cols-1 gap-2">
            {DIFFICULTY_ORDER.map((d) => {
              const active = difficulties.has(d)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onToggleDifficulty(d)}
                  className={cn(
                    'h-12 rounded-2xl border text-sm font-medium transition',
                    active
                      ? 'border-melon-500 bg-melon-500 text-white shadow'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-melon-300'
                  )}
                >
                  {DIFFICULTY_LABEL[d]}
                </button>
              )
            })}
          </div>
          {!canStart && <div className="text-xs text-rose-600">至少选一个难度</div>}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink-700">每轮时长</div>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map((d) => {
              const active = durationSec === d
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onChangeDuration(d)}
                  className={cn(
                    'h-12 rounded-2xl border text-sm font-medium transition',
                    active
                      ? 'border-ink-700 bg-ink-700 text-white shadow'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400'
                  )}
                >
                  {d === 60 ? '1 分钟' : d === 90 ? '90 秒' : '2 分钟'}
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
      <div className="px-6 pb-6">
        <Button onClick={onStart} disabled={!canStart} className="h-14 w-full gap-2 text-base">
          <Play className="h-5 w-5" />
          开始第一轮
        </Button>
      </div>
    </Card>
  )
}
