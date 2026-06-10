import { ArrowRight, Flag, PartyPopper, Timer, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DrawWord, RoundOutcome } from '../types'

interface RoundEndStageProps {
  word: DrawWord
  outcome: RoundOutcome
  onNextRound: () => void
  onFinish: () => void
}

const OUTCOME_META: Record<RoundOutcome, { title: string; desc: string }> = {
  guessed: { title: '猜对了！', desc: '画手和猜中的人击个掌 🙌' },
  giveup: { title: '画手投降了 🏳️', desc: '没关系，看看答案笑一笑。' },
  timeout: { title: '时间到！', desc: '差一点点，答案揭晓——' },
}

export function RoundEndStage({ word, outcome, onNextRound, onFinish }: RoundEndStageProps) {
  const meta = OUTCOME_META[outcome]

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          {outcome === 'guessed' ? (
            <PartyPopper className="h-5 w-5 text-emerald-600" />
          ) : outcome === 'timeout' ? (
            <Timer className="h-5 w-5 text-rose-500" />
          ) : (
            <Flag className="h-5 w-5 text-amber-500" />
          )}
          {meta.title}
        </CardTitle>
        <CardDescription>{meta.desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-3xl border border-ink-100/70 bg-white/80 p-8 text-center">
          <div className="text-xs font-semibold text-ink-500">答案 · {word.hint}</div>
          <div className="mt-3 font-display text-5xl text-ink-900">{word.text}</div>
        </div>
      </CardContent>
      <div className="flex gap-3 px-6 pb-6">
        <Button variant="outline" onClick={onFinish} className="h-12 flex-1 gap-2">
          <Trophy className="h-4 w-4" />
          看战绩
        </Button>
        <Button onClick={onNextRound} className="h-12 flex-[2] gap-2">
          换人画，下一轮
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}
