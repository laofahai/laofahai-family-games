import { Lightbulb, Play, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DrawDifficulty, DrawSettings, Duration } from '../types'
import { DIFFICULTY_LABEL } from '../types'
import { cn } from '@/lib/utils'

interface SetupStageProps {
  difficulties: Set<DrawDifficulty>
  durationSec: Duration
  settings: DrawSettings
  onToggleDifficulty: (d: DrawDifficulty) => void
  onChangeDuration: (d: Duration) => void
  onChangeSetting: (key: keyof DrawSettings, value: boolean) => void
  onStart: () => void
}

const DIFFICULTY_ORDER: DrawDifficulty[] = ['easy', 'medium', 'hard']
const DURATIONS: Duration[] = [60, 90, 120]

function ToggleRow({
  title,
  desc,
  active,
  onClick,
}: {
  title: string
  desc: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition',
        active ? 'border-amber-400 bg-amber-50' : 'border-ink-200 bg-white hover:border-ink-300'
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-800">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-500">{desc}</span>
      </span>
      <span
        className={cn(
          'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
          active ? 'bg-amber-400 text-white' : 'bg-ink-100 text-ink-500'
        )}
      >
        {active ? '开' : '关'}
      </span>
    </button>
  )
}

export function SetupStage({
  difficulties,
  durationSec,
  settings,
  onToggleDifficulty,
  onChangeDuration,
  onChangeSetting,
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

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-700">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            提示帮助
          </div>
          <ToggleRow
            title="常显类别提示"
            desc="画图时一直显示「动物」等类别给猜的人。关掉更有挑战。"
            active={settings.showCategory}
            onClick={() => onChangeSetting('showCategory', !settings.showCategory)}
          />
          <div className="text-xs text-ink-400">默认关闭 = 纯靠画来猜，最有挑战。</div>
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
