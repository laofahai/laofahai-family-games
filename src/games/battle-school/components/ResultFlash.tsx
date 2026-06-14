import type { ResultFeedback } from '../types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ResultFlash({ result, onNext }: { result: ResultFeedback; onNext: () => void }) {
  return (
    <div className="bs-result-in pointer-events-auto w-full max-w-md rounded-3xl border-2 bg-white/95 p-5 text-center shadow-xl backdrop-blur"
      style={{ borderColor: result.ok ? '#34d399' : '#fb7185' }}
    >
      <div className="text-4xl">{result.ok ? (result.crit ? '💥' : '🎯') : '😵'}</div>
      <h3
        className={cn(
          'mt-1 text-2xl font-bold',
          result.ok ? (result.crit ? 'text-amber-600' : 'text-emerald-600') : 'text-rose-600'
        )}
      >
        {result.text}
      </h3>
      {result.detail && <p className="mt-2 text-sm leading-relaxed text-ink-600">{result.detail}</p>}
      <Button onClick={onNext} className="mt-4 min-h-12 w-full">
        继续 →
      </Button>
    </div>
  )
}
