// 答题弹窗（thin）：渲染场景推来的 BattleQuestion + 选项，倒计时；点选项调 submitAnswer。
// 倒计时用 interval + cleanup（不在 effect 里同步 setState 业务，只更新本地剩余秒）。
// 不持有任何游戏逻辑：对错判定、扣血、放招全在场景 resolveQuiz 里。

import { useEffect, useRef, useState } from 'react'
import type { QuizOpenPayload } from '../game/bridge'
import { cn } from '@/lib/utils'
import { playSfx } from '@/games/shared/sound'

// 注意：父组件用 question.id 当 key 重挂本组件，所以每道新题都是全新实例，
// 无需「换题重置」effect（避免 set-state-in-effect）。本地状态从 props 初始化即可。
export function QuizModal({
  payload,
  onSubmit,
}: {
  payload: QuizOpenPayload
  onSubmit: (choiceId: string | null) => void
}) {
  const [left, setLeft] = useState(payload.seconds)
  const [picked, setPicked] = useState<string | null>(null)
  // submitted 用 ref 防止超时与点击重复提交（场景端也有 resolved 兜底）。
  const submitted = useRef(false)
  // 用 ref 持有最新 onSubmit，避免它进 effect 依赖导致倒计时重启（ref 只在 effect 里写）。
  const submitRef = useRef(onSubmit)
  useEffect(() => {
    submitRef.current = onSubmit
  })

  // 倒计时：interval 自减，到 0 自动按超时（null）提交。只在挂载时起一次。
  useEffect(() => {
    const id = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id)
          if (!submitted.current) {
            submitted.current = true
            submitRef.current(null)
          }
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  function choose(id: string) {
    if (submitted.current) return
    submitted.current = true
    setPicked(id)
    playSfx('tap')
    submitRef.current(id)
  }

  const danger = left <= 5
  const isBoss = payload.source === 'boss'

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm sm:items-center">
      <div className="bs-pop w-full max-w-lg rounded-3xl border-2 border-white/30 bg-white/95 p-5 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold',
              isBoss ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700',
            )}
          >
            {isBoss ? `🎓 知识破防 · ${payload.subjectLabel}` : `⚡ 学霸大招 · ${payload.subjectLabel}`}
          </span>
          <span className={cn('text-lg font-bold tabular-nums', danger ? 'bs-timer-danger' : 'text-ink-700')}>
            ⏳ {left}s
          </span>
        </div>

        <h3 className="mb-4 text-lg font-bold leading-snug text-ink-900">{payload.question.prompt}</h3>

        <div className="grid gap-2.5">
          {payload.question.choices.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={picked != null}
              onClick={() => choose(c.id)}
              className={cn(
                'min-h-12 rounded-2xl border-2 px-4 py-3 text-left text-base font-medium transition',
                picked === c.id
                  ? 'border-melon-500 bg-melon-50 text-melon-700'
                  : 'border-ink-200 bg-white text-ink-800 hover:border-melon-400 hover:bg-melon-50/50 active:scale-[0.99]',
              )}
            >
              {c.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
