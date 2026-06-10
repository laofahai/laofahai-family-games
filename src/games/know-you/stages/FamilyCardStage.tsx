import { ArrowRight, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FamilyCard } from '../types'

interface FamilyCardStageProps {
  card: FamilyCard
  index: number
  total: number
  onNext: () => void
}

export function FamilyCardStage({ card, index, total, onNext }: FamilyCardStageProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* 进度 + 全家横幅 */}
      <div className="flex items-center justify-between rounded-full border border-ink-100/70 bg-white/70 px-4 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">👨‍👩‍👧‍👧</span>
          <span className="text-sm font-semibold text-ink-900">全家彩蛋时间!</span>
        </div>
        <span className="rounded-full bg-ink-900 px-3 py-1 text-xs font-semibold text-white">
          {index + 1} / {total}
        </span>
      </div>

      {/* 彩蛋卡 */}
      <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-violet-300 bg-violet-50 p-6 text-center shadow-sm sm:p-8">
        <span className="flex items-center gap-1 rounded-full bg-violet-500 px-3 py-0.5 text-xs font-semibold text-white">
          <PartyPopper className="h-3.5 w-3.5" />
          全家卡 · {card.tag}
        </span>
        <div className="text-6xl">{card.emoji}</div>
        <div className="font-display text-2xl leading-snug text-ink-900 sm:text-3xl">
          {card.text}
        </div>
        <div className="rounded-2xl bg-white/80 px-4 py-2 text-xs text-violet-700">{card.hint}</div>
      </div>

      <Button onClick={onNext} className="h-14 w-full gap-2 text-base">
        <ArrowRight className="h-5 w-5" />
        玩好了,下一题
      </Button>
    </div>
  )
}
