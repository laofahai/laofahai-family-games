import { useEffect, useRef, useState } from 'react'
import type { BattleQuestion } from '@/games/_battle/core'
import { subjectEmoji, subjectLabel } from '@/games/_battle/core'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TIME_LIMIT = 15 // 秒

/**
 * 倒计时小药丸。用 key={question.id} 由父组件重挂来「每题重置」，
 * 从而 useState(TIME_LIMIT) 自然归位，无需在 effect 里同步 setState。
 */
function Countdown({ onTimeout }: { onTimeout: () => void }) {
  const [left, setLeft] = useState(TIME_LIMIT)
  const onTimeoutRef = useRef(onTimeout)
  useEffect(() => {
    onTimeoutRef.current = onTimeout
  })

  useEffect(() => {
    let remaining = TIME_LIMIT
    const id = setInterval(() => {
      remaining -= 1
      setLeft(remaining)
      if (remaining <= 0) {
        clearInterval(id)
        onTimeoutRef.current()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const danger = left <= 5
  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-sm font-bold tabular-nums text-ink-700',
        danger && 'bs-timer-danger bg-rose-100'
      )}
    >
      {Math.max(0, left)}
    </span>
  )
}

export function QuestionOverlay({
  question,
  streak,
  locked,
  onAnswer,
  onTimeout,
}: {
  question: BattleQuestion
  streak: number
  locked: boolean // 结算反馈展示中，禁用按钮
  onAnswer: (choiceId: string) => void
  onTimeout: () => void
}) {
  return (
    <div className="bs-pop pointer-events-auto w-full max-w-xl rounded-3xl border border-ink-100 bg-white/95 p-4 shadow-lg backdrop-blur sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
          {subjectEmoji(question.subject)} {subjectLabel(question.subject)}
        </span>
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
              🔥 连对 {streak}
            </span>
          )}
          {/* locked（结算中）时不计时；key 让每题重置 */}
          {!locked && <Countdown key={question.id} onTimeout={onTimeout} />}
        </div>
      </div>

      <p className="mb-3 text-lg font-semibold leading-snug text-ink-900">{question.prompt}</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {question.choices.map((c) => (
          <Button
            key={c.id}
            variant="outline"
            disabled={locked}
            onClick={() => onAnswer(c.id)}
            className="min-h-12 justify-start whitespace-normal py-2 text-left text-base"
          >
            {c.text}
          </Button>
        ))}
      </div>
    </div>
  )
}
