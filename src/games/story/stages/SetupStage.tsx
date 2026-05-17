import { Play, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Duration, Theme } from '../types'
import { THEME_LABEL } from '../types'
import { cn } from '@/lib/utils'

interface SetupStageProps {
  themes: Set<Theme>
  cardCount: 3 | 4 | 5
  durationSec: Duration
  onToggleTheme: (t: Theme) => void
  onChangeCardCount: (n: 3 | 4 | 5) => void
  onChangeDuration: (d: Duration) => void
  onStart: () => void
}

const THEME_ORDER: Theme[] = ['fairy', 'adventure', 'school', 'scifi', 'daily', 'funny']
const CARD_COUNTS: (3 | 4 | 5)[] = [3, 4, 5]
const DURATIONS: Duration[] = [60, 90, 120, 180]

export function SetupStage({
  themes,
  cardCount,
  durationSec,
  onToggleTheme,
  onChangeCardCount,
  onChangeDuration,
  onStart,
}: SetupStageProps) {
  const canStart = themes.size > 0

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Settings2 className="h-5 w-5 text-melon-600" />
          开局设置
        </CardTitle>
        <CardDescription>选主题、关键词数量、时长，立刻开始。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink-700">主题（可多选）</div>
          <div className="grid grid-cols-3 gap-2">
            {THEME_ORDER.map((t) => {
              const active = themes.has(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onToggleTheme(t)}
                  className={cn(
                    'h-12 rounded-2xl border text-sm font-medium transition',
                    active
                      ? 'border-melon-500 bg-melon-500 text-white shadow'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-melon-300'
                  )}
                >
                  {THEME_LABEL[t]}
                </button>
              )
            })}
          </div>
          {!canStart && (
            <div className="text-xs text-rose-600">至少选一个主题</div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink-700">关键词数量</div>
          <div className="grid grid-cols-3 gap-2">
            {CARD_COUNTS.map((n) => {
              const active = cardCount === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChangeCardCount(n)}
                  className={cn(
                    'h-12 rounded-2xl border text-sm font-medium transition',
                    active
                      ? 'border-ink-700 bg-ink-700 text-white shadow'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400'
                  )}
                >
                  {n} 张
                </button>
              )
            })}
          </div>
          <div className="text-xs text-ink-500">
            3 张 = 简单 / 4 张 = 适中（含转折）/ 5 张 = 挑战
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink-700">时长</div>
          <div className="grid grid-cols-4 gap-2">
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
                  {d === 60 ? '1 分钟' : d === 90 ? '90 秒' : `${d / 60} 分钟`}
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
      <div className="px-6 pb-6">
        <Button
          onClick={onStart}
          disabled={!canStart}
          className="h-14 w-full gap-2 text-base"
        >
          <Play className="h-5 w-5" />
          抽卡开始
        </Button>
      </div>
    </Card>
  )
}
