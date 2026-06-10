import { Play, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlayerId, PriceCategory, RoundCount } from '../types'
import { CATEGORY_LABEL, PLAYERS } from '../types'
import { cn } from '@/lib/utils'

interface SetupStageProps {
  players: Set<PlayerId>
  categories: Set<PriceCategory>
  roundCount: RoundCount
  onTogglePlayer: (p: PlayerId) => void
  onToggleCategory: (c: PriceCategory) => void
  onChangeRounds: (n: RoundCount) => void
  onStart: () => void
}

const CATEGORY_ORDER: PriceCategory[] = [
  'snack',
  'toy',
  'digital',
  'beauty',
  'daily',
  'food',
  'ticket',
  'big',
]
const ROUND_OPTIONS: RoundCount[] = [5, 8, 12]

export function SetupStage({
  players,
  categories,
  roundCount,
  onTogglePlayer,
  onToggleCategory,
  onChangeRounds,
  onStart,
}: SetupStageProps) {
  const canStart = players.size >= 2 && categories.size > 0

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Settings2 className="h-5 w-5 text-melon-600" />
          开局设置
        </CardTitle>
        <CardDescription>勾选在场家人和想猜的商品类型。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink-700">今天谁在场？（至少 2 人）</div>
          <div className="grid grid-cols-2 gap-2">
            {PLAYERS.map((player) => {
              const active = players.has(player.id)
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onTogglePlayer(player.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border p-3 text-left transition',
                    active
                      ? 'border-melon-500 bg-melon-50 shadow'
                      : 'border-ink-200 bg-white opacity-60 hover:border-melon-300 hover:opacity-100'
                  )}
                >
                  <span className="text-3xl">{player.emoji}</span>
                  <span className="text-sm font-semibold text-ink-900">{player.name}</span>
                </button>
              )
            })}
          </div>
          {players.size < 2 && <div className="text-xs text-rose-600">至少要有 2 位家人才能玩</div>}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink-700">商品类型（可多选）</div>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_ORDER.map((c) => {
              const active = categories.has(c)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onToggleCategory(c)}
                  className={cn(
                    'h-12 rounded-2xl border text-sm font-medium transition',
                    active
                      ? 'border-melon-500 bg-melon-500 text-white shadow'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-melon-300'
                  )}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              )
            })}
          </div>
          {categories.size === 0 && <div className="text-xs text-rose-600">至少选一个类型</div>}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink-700">题目数量</div>
          <div className="grid grid-cols-3 gap-2">
            {ROUND_OPTIONS.map((n) => {
              const active = roundCount === n
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
                  {n} 题
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
      <div className="px-6 pb-6">
        <Button onClick={onStart} disabled={!canStart} className="h-14 w-full gap-2 text-base">
          <Play className="h-5 w-5" />
          开始猜价
        </Button>
      </div>
    </Card>
  )
}
