import { useState } from 'react'
import { Brush, EyeOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DrawWord } from '../types'

interface PreviewStageProps {
  word: DrawWord
  roundNo: number
  onSwapWord: () => void
  onStartDrawing: () => void
}

/** 交接 + 看词：先提醒其他人移开视线，画手点开才显示词 */
export function PreviewStage({ word, roundNo, onSwapWord, onStartDrawing }: PreviewStageProps) {
  const [revealed, setRevealed] = useState(false)

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Brush className="h-5 w-5 text-melon-600" />
          第 {roundNo} 轮 · 画手看词
        </CardTitle>
        <CardDescription>把手机交给这一轮画画的人，其他人先移开视线！</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {revealed ? (
          <div className="rounded-3xl border border-melon-200 bg-melon-50/70 p-8 text-center">
            <div className="text-xs font-semibold text-melon-700">提示类别：{word.hint}</div>
            <div className="mt-3 font-display text-5xl text-ink-900">{word.text}</div>
            <div className="mt-4 text-xs text-ink-500">记住它，等下画的时候不会一直显示。</div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="flex h-48 w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-ink-300 bg-white/70 text-ink-500 transition hover:border-melon-400 hover:text-melon-600"
          >
            <EyeOff className="h-8 w-8" />
            <span className="text-sm font-semibold">我是画手，点击看词</span>
          </button>
        )}

        {revealed && (
          <Button variant="outline" onClick={onSwapWord} className="h-12 w-full gap-2">
            <RefreshCw className="h-4 w-4" />
            太难了，换一个词
          </Button>
        )}
      </CardContent>
      <div className="px-6 pb-6">
        <Button onClick={onStartDrawing} disabled={!revealed} className="h-14 w-full text-base">
          记住了，开始画！
        </Button>
      </div>
    </Card>
  )
}
