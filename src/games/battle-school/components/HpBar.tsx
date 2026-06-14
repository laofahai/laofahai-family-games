import { hpPct, type Fighter } from '@/games/_battle/core'
import { cn } from '@/lib/utils'

export function HpBar({
  fighter,
  align = 'left',
  accent = 'emerald',
  boss = false,
}: {
  fighter: Fighter
  align?: 'left' | 'right'
  accent?: 'emerald' | 'rose'
  /** Boss（老师）：粗血条 + 大形象 + 标签；同学小怪=细血条小形象，明显区分。 */
  boss?: boolean
}) {
  const pct = hpPct(fighter)
  const barColor = accent === 'rose' ? 'bg-rose-500' : 'bg-emerald-500'
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', align === 'right' && 'items-end')}>
      <div
        className={cn(
          'flex items-center gap-1.5 font-semibold text-ink-800',
          boss ? 'text-base' : 'text-sm',
          align === 'right' && 'flex-row-reverse'
        )}
      >
        <span className={boss ? 'text-2xl drop-shadow' : 'text-base'}>{fighter.emoji}</span>
        <span className="truncate">{fighter.name}</span>
        {boss && (
          <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
            老师 BOSS
          </span>
        )}
      </div>
      <div
        className={cn(
          'overflow-hidden rounded-full bg-ink-100',
          boss ? 'h-5 w-36 ring-2 ring-rose-300 sm:w-52' : 'h-2 w-20 ring-1 ring-ink-200/70 sm:w-28',
          align === 'right' && 'self-end'
        )}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={cn('text-ink-500', boss ? 'text-xs font-semibold' : 'text-[10px]', align === 'right' && 'text-right')}>
        {fighter.hp}/{fighter.maxHp}
      </div>
    </div>
  )
}
