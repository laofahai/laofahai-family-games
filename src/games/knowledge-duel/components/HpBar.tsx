import { hpPct } from '@/games/_battle/core'
import type { Fighter } from '@/games/_battle/core'

export function HpBar({ fighter, flip = false }: { fighter: Fighter; flip?: boolean }) {
  const pct = hpPct(fighter)
  const color =
    pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-ink-600">
        {flip ? (
          <>
            <span>{fighter.hp}/{fighter.maxHp}</span>
            <span>HP</span>
          </>
        ) : (
          <>
            <span>HP</span>
            <span>{fighter.hp}/{fighter.maxHp}</span>
          </>
        )}
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-ink-100 ring-1 ring-inset ring-ink-200/70">
        <div
          className={`h-full rounded-full ${color} transition-[width] duration-500 ease-out`}
          style={{
            width: `${pct}%`,
            marginLeft: flip ? 'auto' : undefined,
          }}
        />
      </div>
    </div>
  )
}
