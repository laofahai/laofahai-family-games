import { Home, RotateCcw, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlayerId, RoundRecord } from '../types'
import { PLAYER_MAP, totalScores } from '../types'
import { cn } from '@/lib/utils'

interface ResultStageProps {
  players: PlayerId[]
  history: RoundRecord[]
  onPlayAgain: () => void
  onExit: () => void
}

export function ResultStage({ players, history, onPlayAgain, onExit }: ResultStageProps) {
  const scores = totalScores(history)
  const ranked = [...players].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
  const topScore = scores[ranked[0]] ?? 0

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Trophy className="h-5 w-5 text-amber-500" />
          全场总分
        </CardTitle>
        <CardDescription>拆穿别人 +1，骗过别人也 +1——分高的才是全家影帝。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ranked.map((p, idx) => {
          const info = PLAYER_MAP[p]
          const score = scores[p] ?? 0
          const isTop = score === topScore && topScore > 0
          return (
            <div
              key={p}
              className={cn(
                'flex items-center justify-between rounded-2xl border p-4',
                isTop ? 'border-amber-300 bg-amber-50/80 shadow' : 'border-ink-100/70 bg-white/80'
              )}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-sm font-bold text-ink-400">{idx + 1}</span>
                <span className="text-3xl">{info.emoji}</span>
                <span className="text-sm font-semibold text-ink-900">
                  {info.name}
                  {isTop && ' 🏆'}
                </span>
              </div>
              <div className="font-display text-2xl text-ink-900">{score} 分</div>
            </div>
          )
        })}
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
