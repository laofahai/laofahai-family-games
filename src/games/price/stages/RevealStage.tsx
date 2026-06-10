import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlayerId, RoundRecord } from '../types'
import { PLAYER_MAP } from '../types'
import { cn } from '@/lib/utils'

interface RevealStageProps {
  record: RoundRecord
  scores: Partial<Record<PlayerId, number>>
  isLastRound: boolean
  onNext: () => void
}

function formatPrice(value: number): string {
  return value >= 10000
    ? `¥${(value / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 万`
    : `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
}

export function RevealStage({ record, scores, isLastRound, onNext }: RevealStageProps) {
  const { item, guesses, winners, sharp } = record
  const entries = (Object.entries(guesses) as [PlayerId, number][]).sort(
    (a, b) => Math.abs(a[1] - item.price) - Math.abs(b[1] - item.price)
  )

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Sparkles className="h-5 w-5 text-amber-500" />
          揭晓真实价格
        </CardTitle>
        <CardDescription>{item.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6 text-center">
          <div className="font-display text-5xl text-ink-900">{formatPrice(item.price)}</div>
          {item.note && <div className="mt-3 text-xs leading-relaxed text-amber-800">{item.note}</div>}
        </div>

        <div className="space-y-2">
          {entries.map(([p, guess]) => {
            const info = PLAYER_MAP[p]
            const isWinner = winners.includes(p)
            return (
              <div
                key={p}
                className={cn(
                  'flex items-center justify-between rounded-2xl border px-4 py-3',
                  isWinner ? 'border-emerald-300 bg-emerald-50/80 shadow' : 'border-ink-100/70 bg-white/80'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{info.emoji}</span>
                  <span className="text-sm font-semibold text-ink-900">{info.name}</span>
                  {isWinner && (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                      {sharp ? '神价 +2' : '最接近 +1'}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-display text-xl text-ink-900">{formatPrice(guess)}</div>
                  <div className="text-xs text-ink-400">
                    差 {formatPrice(Math.abs(guess - item.price))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-ink-200/70 bg-white/70 p-3 text-xs text-ink-600">
          <span className="font-semibold">当前总分：</span>
          {(Object.entries(scores) as [PlayerId, number][]).map(([p, s]) => (
            <span key={p}>
              {PLAYER_MAP[p].emoji} {s}
            </span>
          ))}
        </div>
      </CardContent>
      <div className="px-6 pb-6">
        <Button onClick={onNext} className="h-14 w-full gap-2 text-base">
          {isLastRound ? '看总分' : '下一题'}
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </Card>
  )
}
