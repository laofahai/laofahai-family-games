import { cn } from '@/lib/utils'

interface WordCardProps {
  text: string
  className?: string
}

export function WordCard({ text, className }: WordCardProps) {
  // 长度自适应：≤3 / ≤5 / ≤7 / 8+
  const len = text.length
  const sizeClass =
    len <= 3
      ? 'text-[42vmin] leading-[1]'
      : len <= 5
        ? 'text-[30vmin] leading-[1.05]'
        : len <= 7
          ? 'text-[22vmin] leading-[1.1]'
          : 'text-[16vmin] leading-[1.15]'

  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center px-3 text-center',
        className,
      )}
    >
      <span className={cn('font-display font-bold tracking-wide text-ink-900', sizeClass)}>
        {text}
      </span>
    </div>
  )
}
