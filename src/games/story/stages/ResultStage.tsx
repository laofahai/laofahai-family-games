import { Settings2, Sparkles, ThumbsUp, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { RoundResult, StoryCard } from '../types'
import { CATEGORY_LABEL } from '../types'
import { cn } from '@/lib/utils'

interface ResultStageProps {
  currentCards: StoryCard[]
  history: RoundResult[]
  onPass: () => void
  onRetry: () => void
  onChangeSetup: () => void
  onExit: () => void
}

const CATEGORY_BADGE: Record<StoryCard['category'], string> = {
  character: 'bg-rose-100 text-rose-700',
  place: 'bg-emerald-100 text-emerald-700',
  item: 'bg-amber-100 text-amber-700',
  twist: 'bg-indigo-100 text-indigo-700',
}

export function ResultStage({
  currentCards,
  history,
  onPass,
  onRetry,
  onChangeSetup,
  onExit,
}: ResultStageProps) {
  const passCount = history.filter((r) => r.verdict === 'pass').length
  const retryCount = history.length - passCount

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Sparkles className="h-5 w-5 text-melon-600" />
          这一轮的关键词
        </CardTitle>
        <CardDescription>
          家人投票决定继续。已过关 <span className="font-semibold text-emerald-700">{passCount}</span>
          {' · '}
          重讲 <span className="font-semibold text-rose-600">{retryCount}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {currentCards.map((card, idx) => (
            <div
              key={`${card.text}-${idx}`}
              className="flex items-center gap-2 rounded-2xl border border-ink-100/70 bg-white/80 px-3 py-2 text-sm shadow-sm"
            >
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', CATEGORY_BADGE[card.category])}>
                {CATEGORY_LABEL[card.category]}
              </span>
              <span className="font-display text-base text-ink-900">{card.text}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={onPass} className="h-14 gap-2 bg-emerald-600 text-base hover:bg-emerald-600/90">
            <ThumbsUp className="h-5 w-5" />
            精彩过关 · 下一轮
          </Button>
          <Button onClick={onRetry} variant="outline" className="h-14 gap-2 text-base">
            <Undo2 className="h-5 w-5" />
            再讲一次（同样的牌）
          </Button>
        </div>

        {history.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-ink-500">本场记录</div>
            <ul className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
              {history.map((round, idx) => (
                <li
                  key={idx}
                  className={cn(
                    'rounded-2xl border px-3 py-2 text-xs',
                    round.verdict === 'pass' ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold">第 {idx + 1} 轮</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        round.verdict === 'pass' ? 'bg-emerald-600 text-white' : 'bg-rose-500 text-white'
                      )}
                    >
                      {round.verdict === 'pass' ? '过关' : '重讲'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 text-ink-700">
                    {round.cards.map((c, i) => (
                      <span key={i} className="rounded-full bg-white px-2 py-0.5">
                        {c.text}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <div className="flex flex-col gap-2 px-6 pb-6 sm:flex-row">
        <Button onClick={onChangeSetup} variant="outline" className="h-12 flex-1 gap-2">
          <Settings2 className="h-4 w-4" />
          换设置
        </Button>
        <Button onClick={onExit} variant="ghost" className="h-12 flex-1">
          返回首页
        </Button>
      </div>
    </Card>
  )
}
