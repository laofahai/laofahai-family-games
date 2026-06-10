import { ArrowRight, Eye } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { KnowQuestion, RoleId } from '../types'
import { KIND_LABEL, ROLE_MAP } from '../types'
import { cn } from '@/lib/utils'

interface PlayingStageProps {
  question: KnowQuestion
  players: RoleId[]
  index: number
  total: number
  onSubmit: (correctGuessers: RoleId[]) => void
}

export function PlayingStage({ question, players, index, total, onSubmit }: PlayingStageProps) {
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState<Set<RoleId>>(new Set())

  const hero = ROLE_MAP[question.role]
  const guessers = players.filter((p) => p !== question.role)
  const isTrivia = question.kind === 'trivia'
  const nobodyKnew = correct.size === 0

  function toggleCorrect(role: RoleId) {
    setCorrect((prev) => {
      const next = new Set(prev)
      if (next.has(role)) next.delete(role)
      else next.add(role)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 进度 + 主角横幅 */}
      <div className="flex items-center justify-between rounded-full border border-ink-100/70 bg-white/70 px-4 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{hero.emoji}</span>
          <span className="text-sm font-semibold text-ink-900">本轮主角：{hero.name}</span>
        </div>
        <span className="rounded-full bg-ink-900 px-3 py-1 text-xs font-semibold text-white">
          {index + 1} / {total}
        </span>
      </div>

      {/* 题卡 */}
      <div
        className={cn(
          'flex flex-col items-center gap-4 rounded-3xl border p-6 text-center shadow-sm sm:p-8',
          isTrivia
            ? 'border-sky-200 bg-sky-50'
            : 'border-rose-200 bg-rose-50'
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-3 py-0.5 text-xs font-semibold text-white',
              isTrivia ? 'bg-sky-500' : 'bg-rose-500'
            )}
          >
            {KIND_LABEL[question.kind]}
          </span>
          {question.tag !== '走心' && (
            <span className="rounded-full border border-ink-200 bg-white/80 px-3 py-0.5 text-xs font-semibold text-ink-600">
              {question.tag}
            </span>
          )}
        </div>
        <div className="text-6xl">{question.emoji}</div>
        <div className="font-display text-2xl leading-snug text-ink-900 sm:text-3xl">
          {question.text}
        </div>

        {!revealed ? (
          <div className="text-xs text-ink-500">
            {isTrivia
              ? '其他人先抢答（建议最小的先说），再翻参考答案'
              : `其他人先猜，然后听${hero.name}亲口公布`}
          </div>
        ) : (
          <div
            className={cn(
              'w-full rounded-2xl border-2 border-dashed p-4',
              isTrivia ? 'border-sky-300 bg-white' : 'border-rose-300 bg-white'
            )}
          >
            {isTrivia ? (
              <>
                <div className="text-xs font-semibold text-ink-500">参考答案（{hero.name}有最终裁定权）</div>
                <div className="mt-1 font-display text-xl text-ink-900">{question.answer}</div>
              </>
            ) : (
              <>
                <div className="text-xs font-semibold text-ink-500">没有标准答案</div>
                <div className="mt-1 font-display text-xl text-ink-900">
                  请{hero.name}亲口公布，并裁定谁猜对了
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {!revealed ? (
        <Button onClick={() => setRevealed(true)} className="h-14 w-full gap-2 text-base">
          <Eye className="h-5 w-5" />
          {isTrivia ? '翻开参考答案' : '大家猜完了，公布答案'}
        </Button>
      ) : (
        <>
          {/* 谁答对了 */}
          <div className="rounded-3xl border border-ink-100/70 bg-white/80 p-4 shadow-sm">
            <div className="text-sm font-semibold text-ink-700">谁答对了？（点头像勾选）</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {guessers.map((id) => {
                const role = ROLE_MAP[id]
                const active = correct.has(id)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCorrect(id)}
                    className={cn(
                      'flex items-center gap-2 rounded-2xl border px-4 py-2 transition',
                      active
                        ? 'border-emerald-500 bg-emerald-50 shadow'
                        : 'border-ink-200 bg-white hover:border-emerald-300'
                    )}
                  >
                    <span className="text-2xl">{role.emoji}</span>
                    <span className="text-sm font-semibold text-ink-900">{role.name}</span>
                    {active && <span className="text-emerald-600">❤️</span>}
                  </button>
                )
              })}
            </div>
            <div className={cn('mt-3 text-xs', nobodyKnew ? 'font-semibold text-amber-700' : 'text-ink-500')}>
              {nobodyKnew
                ? `🤫 没人答对的话，${hero.name}大声喊出"我知道你不知道！"拿 1 个独家分`
                : `答对的人每人 +1 ❤️ 了解分`}
            </div>
          </div>

          <Button onClick={() => onSubmit([...correct])} className="h-14 w-full gap-2 text-base">
            <ArrowRight className="h-5 w-5" />
            下一题
          </Button>
        </>
      )}
    </div>
  )
}
