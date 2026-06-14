import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { battleCry } from '@/games/_battle/cries'
import type { Band } from '@/games/_battle/core'
import type { DuelState } from '../types'

interface ResultScreenProps {
  state: DuelState
  band: Band
  onRestart: () => void
  onNewSetup: () => void
  onExit: () => void
}

export function ResultScreen({ state, band, onRestart, onNewSetup, onExit }: ResultScreenProps) {
  const winner = state.winner ? state[state.winner] : null
  const loser = state.winner ? state[state.winner === 'left' ? 'right' : 'left'] : null
  const finishCry = useMemo(() => battleCry('finish', band), [band])

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-b from-amber-100 to-melon-50 p-6 text-center">
          <div className="kd-trophy mx-auto mb-2 text-6xl">🏆</div>
          <div className="text-sm font-semibold text-amber-700">恭喜获胜</div>
          <div className="mt-1 font-display text-3xl font-black text-ink-900">
            <span className="mr-1.5">{winner?.emoji}</span>
            {winner?.name}
          </div>
          {finishCry && (
            <div className="kd-banner mt-3 inline-block rounded-2xl bg-ink-900 px-4 py-1.5 font-display text-base font-black text-amber-300 shadow-lg">
              {finishCry}
            </div>
          )}
          {loser && (
            <div className="mt-2 text-sm text-ink-500">
              {loser.emoji} {loser.name} 也很棒，下次再来！
            </div>
          )}
        </div>
        <CardContent className="pt-4">
          <div className="rounded-2xl bg-ink-50 p-3">
            <div className="mb-1 text-xs font-bold text-ink-400">最终战报</div>
            <ul className="space-y-0.5">
              {state.log.slice(0, 4).map((line, i) => (
                <li key={i} className="text-xs text-ink-500">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-2">
        <Button size="lg" className="min-h-12 w-full text-base" onClick={onRestart}>
          🔁 再来一局（同样的人）
        </Button>
        <Button
          variant="outline"
          className="min-h-12 w-full text-base"
          onClick={onNewSetup}
        >
          ⚙️ 换人/换设置
        </Button>
        <Button variant="ghost" className="min-h-12 w-full" onClick={onExit}>
          返回首页
        </Button>
      </div>
    </div>
  )
}
