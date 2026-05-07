import { cn } from '@/lib/utils'

interface WordCardProps {
  text: string
  className?: string
}

export function WordCard({ text, className }: WordCardProps) {
  // 长度自适应：≤4 → 大；5-7 → 中；8+ → 小
  const len = text.length
  const sizeClass =
    len <= 4
      ? 'text-[18vmin] leading-[1.05]'
      : len <= 7
        ? 'text-[14vmin] leading-[1.1]'
        : 'text-[10vmin] leading-[1.15]'

  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center px-6 text-center',
        className,
      )}
    >
      <span className={cn('font-display font-bold tracking-wide text-ink-900', sizeClass)}>
        {text}
      </span>
    </div>
  )
}
