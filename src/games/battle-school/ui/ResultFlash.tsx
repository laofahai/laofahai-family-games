// 答题结果闪现（thin）：场景 emit('result') 时短暂显示，自动消失。不持有逻辑。

import { useEffect } from 'react'
import type { ResultPayload } from '../game/bridge'
import { cn } from '@/lib/utils'

export function ResultFlash({ result, onDone }: { result: ResultPayload; onDone: () => void }) {
  // 1.4s 后自动收起（用 timeout + cleanup）。
  useEffect(() => {
    const id = window.setTimeout(onDone, 1400)
    return () => window.clearTimeout(id)
  }, [result, onDone])

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
