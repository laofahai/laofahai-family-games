import { Home, RotateCcw, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { RoundOutcome, RoundRecord } from '../types'

interface ResultStageProps {
  history: RoundRecord[]
  onPlayAgain: () => void
  onExit: () => void
}

const OUTCOME_EMOJI: Record<RoundOutcome, string> = {
  guessed: '✅',
  giveup: '🏳️',
  timeout: '⌛',
}

export function ResultStage({ history, onPlayAgain, onExit }: ResultStageProps) {
  const guessed = history.filter((r) => r.outcome === 'guessed').length

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Trophy className="h-5 w-5 text-amber-500" />
          本局战绩
        </CardTitle>
        <CardDescription>
          一共画了 {history.length} 轮，猜中 {guessed} 个
          {history.length > 0 && guessed === history.length && '，全队默契满分 💯'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {history.map((r, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between rounded-2xl border border-ink-100/70 bg-white/80 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="w-6 text-center text-sm font-bold text-ink-400">{idx + 1}</span>
              <span className="text-sm font-semibold text-ink-900">{r.word.text}</span>
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">
                {r.word.hint}
              </span>
            </div>
            <span className="text-xl">{OUTCOME_EMOJI[r.outcome]}</span>
          </div>
        ))}
        {history.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-200/70 bg-white/70 p-6 text-center text-sm text-ink-500">
            一轮都还没画呢
          </div>
        )}
      </CardContent>
      <div className="flex gap-3 px-6 pb-6">
        <Button variant="outline" onClick={onExit} className="h-12 flex-1 gap-2">
          <Home className="h-4 w-4" />
          返回首页
        </Button>
        <Button onClick={onPlayAgain} className="h-12 flex-1 gap-2">
          <RotateCcw className="h-4 w-4" />
          再来一局
        </Button>
      </div>
    </Card>
  )
}
