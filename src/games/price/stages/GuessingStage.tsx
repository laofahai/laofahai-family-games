import { useState } from 'react'
import { Check, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlayerId, PriceItem } from '../types'
import { CATEGORY_LABEL, PLAYER_MAP } from '../types'
import { cn } from '@/lib/utils'

interface GuessingStageProps {
  item: PriceItem
  roundNo: number
  totalRounds: number
  players: PlayerId[]
  guesses: Partial<Record<PlayerId, number>>
  onSubmit: (player: PlayerId, value: number) => void
}

export function GuessingStage({
  item,
  roundNo,
  totalRounds,
  players,
  guesses,
  onSubmit,
}: GuessingStageProps) {
  const [input, setInput] = useState('')
  const current = players.find((p) => guesses[p] === undefined)
  const value = Number(input)
  const valid = input.trim() !== '' && Number.isFinite(value) && value >= 0

  function submit() {
    if (!current || !valid) return
    onSubmit(current, value)
    setInput('')
  }

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Tag className="h-5 w-5 text-melon-600" />
          第 {roundNo} / {totalRounds} 题
        </CardTitle>
        <CardDescription>这件东西卖多少钱？轮流报价，先别偷看别人的。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-3xl border border-melon-200 bg-melon-50/70 p-6 text-center">
          <div className="text-xs font-semibold text-melon-700">
            {CATEGORY_LABEL[item.category]}
            {item.unit ? ` · ${item.unit}` : ''}
          </div>
          <div className="mt-3 font-display text-3xl leading-snug text-ink-900">{item.name}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {players.map((p) => {
            const info = PLAYER_MAP[p]
            const done = guesses[p] !== undefined
            const isCurrent = p === current
            return (
              <span
                key={p}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold',
                  isCurrent
                    ? 'border-melon-500 bg-melon-500 text-white shadow'
                    : done
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-ink-200 bg-white text-ink-500'
                )}
              >
                {info.emoji} {info.name}
                {done && ' 🤐'}
              </span>
            )
          })}
        </div>

        {current && (
          <div className="space-y-3 rounded-2xl border border-ink-100/70 bg-white/80 p-4">
            <div className="text-sm font-semibold text-ink-900">
              {PLAYER_MAP[current].emoji} 请 {PLAYER_MAP[current].name} 报价（元）
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="输入你猜的价格"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit()
                }}
                className="h-14 flex-1 rounded-2xl text-center font-display text-2xl"
              />
              <Button onClick={submit} disabled={!valid} className="h-14 gap-2 px-6">
                <Check className="h-5 w-5" />
                确定
              </Button>
            </div>
            <div className="text-xs text-ink-500">输完传给下一位，报价会藏起来直到揭晓。</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
