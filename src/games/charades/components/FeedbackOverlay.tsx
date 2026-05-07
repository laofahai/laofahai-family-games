import type { Outcome } from '../types'

interface FeedbackOverlayProps {
  outcome: Outcome | null
  trigger: number
}

export function FeedbackOverlay({ outcome, trigger }: FeedbackOverlayProps) {
  if (!outcome) return null

  const isCorrect = outcome === 'correct'
  return (
    <div
      key={trigger}
      className={
        'pointer-events-none absolute inset-0 z-30 flex items-center justify-center motion-safe:animate-[flash_380ms_ease-out_forwards] ' +
        (isCorrect ? 'bg-emerald-500/85' : 'bg-rose-500/85')
      }
    >
      <div className="font-display text-[28vmin] leading-none text-white drop-shadow-lg">
        {isCorrect ? '✓ 对！' : '✗ 过~'}
      </div>
    </div>
  )
}
