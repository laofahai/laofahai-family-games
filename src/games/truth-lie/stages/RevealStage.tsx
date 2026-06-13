import { useState } from 'react'
import { Eye, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlayerId, StatementIndex } from '../types'
import { infoOf } from '../types'
import { cn } from '@/lib/utils'

interface RevealStageProps {
  teller: PlayerId
  votes: Partial<Record<PlayerId, StatementIndex>>
  isLastRound: boolean
  onConfirm: (lieIndex: StatementIndex) => void
  onNext: () => void
}

const INDEXES: StatementIndex[] = [1, 2, 3]

export function RevealStage({ teller, votes, isLastRound, onConfirm, onNext }: RevealStageProps) {
  const [lieIndex, setLieIndex] = useState<StatementIndex | null>(null)
  const tellerInfo = infoOf(teller)

  if (lieIndex === null) {
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Eye className="h-5 w-5 text-melon-600" />
            揭晓时刻
          </CardTitle>
          <CardDescription>
            {tellerInfo.emoji} {tellerInfo.name}，公布答案：哪件是你编的？
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {INDEXES.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setLieIndex(i)
                  onConfirm(i)
                }}
                className="h-24 rounded-3xl border border-ink-200 bg-white text-4xl font-bold text-ink-800 shadow-sm transition hover:-translate-y-1 hover:border-melon-400 hover:shadow-md"
              >
                {i}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const voterEntries = Object.entries(votes) as [PlayerId, StatementIndex][]
  const busted = voterEntries.filter(([, v]) => v === lieIndex)
  const fooled = voterEntries.filter(([, v]) => v !== lieIndex)

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <PartyPopper className="h-5 w-5 text-melon-600" />
          第 {lieIndex} 件是编的！
        </CardTitle>
        <CardDescription>
          {fooled.length === 0
            ? `全员火眼金睛，${tellerInfo.name}一个人都没骗到 😂`
            : busted.length === 0
              ? `${tellerInfo.name}骗过了所有人，影帝认证 🎬`
              : '有人拆穿，也有人被骗。'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {busted.length > 0 && (
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4">
            <div className="text-xs font-semibold text-emerald-700">火眼金睛 · 每人 +1 分</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {busted.map(([p]) => (
                <span
                  key={p}
                  className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-800 shadow-sm"
                >
                  {infoOf(p).emoji} {infoOf(p).name}
                </span>
              ))}
            </div>
          </div>
        )}
        {fooled.length > 0 && (
          <div
            className={cn(
              'rounded-2xl border p-4',
              'border-amber-200/70 bg-amber-50/70'
            )}
          >
            <div className="text-xs font-semibold text-amber-700">
              被骗到了 😵 · {tellerInfo.name} +{fooled.length} 分
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {fooled.map(([p]) => (
                <span
                  key={p}
                  className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-amber-800 shadow-sm"
                >
                  {infoOf(p).emoji} {infoOf(p).name}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <div className="px-6 pb-6">
        <Button onClick={onNext} className="h-14 w-full text-base">
          {isLastRound ? '看总分' : '下一位主角'}
        </Button>
      </div>
    </Card>
  )
}
