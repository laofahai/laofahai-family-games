// 答题结果闪现（thin）：场景 emit('result') 时短暂显示，自动消失。不持有逻辑。
// 自动收起靠本组件自身的计时（参照 QuizModal 用 ref 稳住回调）：父组件每次重渲染都会传入
// 新的 onDone 闭包；若让定时器依赖它，频繁重渲染（如大招期间每帧推 HUD）会不断重置定时器，
// 导致「学霸大招·全屏清场」横幅永不消失（#29）。这里把 onDone 收进 ref，定时器只随每条新
// result 起一次，到点调 onDone → 父级 setResult(null) 卸载本组件（proper unmount）。

import { useEffect, useRef } from 'react'
import type { ResultPayload } from '../game/bridge'
import { cn } from '@/lib/utils'

const SHOW_MS = 1400

export function ResultFlash({ result, onDone }: { result: ResultPayload; onDone: () => void }) {
  // 用 ref 持有最新 onDone，避免它进 effect 依赖导致定时器被父级重渲染反复重置。
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })

  // 每条新 result 起一次定时器（只依赖 result，不依赖 onDone）：到点通知父级收起本组件。
  useEffect(() => {
    const id = window.setTimeout(() => onDoneRef.current(), SHOW_MS)
    return () => window.clearTimeout(id)
  }, [result])

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/3 z-40 flex justify-center px-4">
      <div
        className="bs-result-in rounded-3xl border-2 bg-white/95 px-6 py-4 text-center shadow-2xl"
        style={{ borderColor: result.ok ? (result.crit ? '#fbbf24' : '#34d399') : '#fb7185' }}
      >
        <div className="text-4xl">{result.ok ? (result.crit ? '💥' : '🎯') : '😵'}</div>
        <h3
          className={cn(
            'mt-1 text-xl font-bold',
            result.ok ? (result.crit ? 'text-amber-600' : 'text-emerald-600') : 'text-rose-600',
          )}
        >
          {result.title}
        </h3>
        {result.detail && <p className="mt-1 text-sm text-ink-600">{result.detail}</p>}
      </div>
    </div>
  )
}
