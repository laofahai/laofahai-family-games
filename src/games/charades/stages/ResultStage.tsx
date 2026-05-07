import { Check, RotateCcw, Settings2, Trophy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { RoundResult } from '../types'
import { DIFFICULTY_LABEL } from '../types'

interface ResultStageProps {
  results: RoundResult[]
  onPlayAgain: () => void
  onChangeSetup: () => void
  onExit: () => void
}

export function ResultStage({ results, onPlayAgain, onChangeSetup, onExit }: ResultStageProps) {
  const correctCount = results.filter((r) => r.outcome === 'correct').length
  const passCount = results.length - correctCount

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Trophy className="h-5 w-5 text-melon-600" />
          这局结束
        </CardTitle>
        <CardDescription>
          猜对 <span className="font-semibold text-emerald-700">{correctCount}</span> 个
          {' · '}
          过掉 <span className="font-semibold text-rose-600">{passCount}</span> 个
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-200/70 bg-white/70 p-6 text-center text-sm text-ink-500">
            这局还没来得及翻一题，时间就到了~
          </div>
        ) : (
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {results.map((r, idx) => {
              const isCorrect = r.outcome === 'correct'
              return (
                <li
                  key={`${r.word.text}-${idx}`}
                  className={
                    'flex items-center justify-between rounded-2xl border px-4 py-3 ' +
                    (isCorrect
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-rose-200 bg-rose-50')
                  }
                >
                  <div className="flex items-center gap-3">
                    {isCorrect ? (
                      <Check className="h-5 w-5 text-emerald-700" />
                    ) : (
                      <X className="h-5 w-5 text-rose-600" />
                    )}
                    <span className="font-display text-lg text-ink-900">{r.word.text}</span>
                  </div>
                  <span className="text-xs text-ink-500">
                    {DIFFICULTY_LABEL[r.word.difficulty]}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
      <div className="flex flex-col gap-2 px-6 pb-6 sm:flex-row">
        <Button onClick={onPlayAgain} className="h-12 flex-1 gap-2">
          <RotateCcw className="h-4 w-4" />
          再来一局
        </Button>
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
