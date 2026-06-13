import { Play, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RosterPicker } from '@/platform/RosterPicker'
import type { RoundsPerPlayer } from '../types'
import { cn } from '@/lib/utils'

interface SetupStageProps {
  selectedIds: string[]
  roundsPerPlayer: RoundsPerPlayer
  onChangePlayers: (ids: string[]) => void
  onChangeRounds: (n: RoundsPerPlayer) => void
  onStart: () => void
}

const ROUND_OPTIONS: RoundsPerPlayer[] = [1, 2]

export function SetupStage({
  selectedIds,
  roundsPerPlayer,
  onChangePlayers,
  onChangeRounds,
  onStart,
}: SetupStageProps) {
  const canStart = selectedIds.length >= 2

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Settings2 className="h-5 w-5 text-melon-600" />
          开局设置
        </CardTitle>
        <CardDescription>选今天在场的人（家人、朋友都行），每人轮流当主角。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink-700">今天谁在场？（已选 {selectedIds.length} 人，至少 2 人）</div>
          <RosterPicker selectedIds={selectedIds} onChange={onChangePlayers} min={2} />
          {!canStart && <div className="text-xs text-rose-600">至少要有 2 个人才能玩</div>}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink-700">每人当几次主角</div>
          <div className="grid grid-cols-2 gap-2">
            {ROUND_OPTIONS.map((n) => {
              const active = roundsPerPlayer === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChangeRounds(n)}
                  className={cn(
                    'h-12 rounded-2xl border text-sm font-medium transition',
                    active
                      ? 'border-ink-700 bg-ink-700 text-white shadow'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400'
                  )}
                >
                  {n} 次（共 {selectedIds.length * n} 轮）
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
