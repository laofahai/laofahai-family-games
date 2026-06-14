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

  // Boss 知识闸：紧凑的顶部飘浮卡片（不全屏压黑、不卡屏），答完/超时即自动收起。
  // 限时条画在卡片顶部，随剩余秒收缩。
  const pct = Math.max(0, Math.round((left / payload.seconds) * 100))

  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-30 flex justify-center px-3 sm:top-16">
      <div className="bs-pop pointer-events-auto w-full max-w-md overflow-hidden rounded-3xl border-2 border-rose-300/70 bg-white/95 shadow-2xl backdrop-blur">
        {/* 顶部限时进度条 */}
        <div className="h-1.5 w-full bg-rose-100">
          <div
            className={cn('h-full transition-[width] duration-1000 ease-linear', danger ? 'bg-rose-500' : 'bg-rose-400')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
              🎓 领主弱点 · {payload.subjectLabel}
            </span>
            <span className={cn('text-base font-bold tabular-nums', danger ? 'bs-timer-danger' : 'text-ink-700')}>
              ⏳ {left}s
            </span>
          </div>

          <h3 className="mb-3 text-base font-bold leading-snug text-ink-900">{payload.question.prompt}</h3>

          <div className="grid gap-2">
            {payload.question.choices.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={picked != null}
                onClick={() => choose(c.id)}
                className={cn(
                  'min-h-11 rounded-2xl border-2 px-4 py-2.5 text-left text-base font-medium transition',
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
    </div>
  )
}
