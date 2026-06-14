import { hpPct } from '@/games/_battle/core'
import type { Fighter } from '@/games/_battle/core'
import { HpBar } from './HpBar'

interface FighterCardProps {
  fighter: Fighter
  side: 'left' | 'right'
  isTurn: boolean
  streak: number
  /** 这一刻的动画状态。 */
  anim: 'idle' | 'attack' | 'hit' | 'crit' | 'down'
  /** 飘出的伤害数字（null=不显示）。 */
  floatDmg: { value: number; crit: boolean } | null
}

export function FighterCard({
  fighter,
  side,
  isTurn,
  streak,
  anim,
  floatDmg,
}: FighterCardProps) {
  const flip = side === 'right'
  const down = hpPct(fighter) <= 0

  // 出招：朝对方方向冲一下；受击：左右抖动。
  const attackShift =
    anim === 'attack' ? (side === 'left' ? 'kd-attack-right' : 'kd-attack-left') : ''
  const hitShake = anim === 'hit' || anim === 'crit' ? 'kd-shake' : ''
  const critRing = anim === 'crit' ? 'kd-crit-flash' : ''

  return (
    <div
      className={[
        'relative flex flex-1 flex-col items-center gap-2 rounded-3xl border p-3 transition-all duration-300 sm:p-4',
        isTurn && !down
          ? 'border-melon-400 bg-melon-50/70 shadow-[0_12px_36px_-22px_rgba(217,119,6,0.7)]'
          : 'border-ink-100 bg-white/70',
        down ? 'opacity-60 grayscale' : '',
      ].join(' ')}
    >
      {/* 当前回合标记 */}
      {isTurn && !down && (
        <span className="absolute -top-2 rounded-full bg-melon-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
          出招中
        </span>
      )}

      {/* 头像 + 动画层 */}
      <div className="relative">
        {/* 飘伤害字 */}
        {floatDmg && (
          <span
            className={[
              'kd-float absolute left-1/2 top-0 z-10 -translate-x-1/2 select-none font-display font-black drop-shadow',
              floatDmg.crit ? 'text-3xl text-rose-500' : 'text-2xl text-rose-400',
            ].join(' ')}
          >
            -{floatDmg.value}
            {floatDmg.crit && <span className="ml-0.5 text-base">暴击!</span>}
          </span>
        )}
        <div
          className={[
            'flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-5xl ring-2 ring-ink-100 sm:h-24 sm:w-24 sm:text-6xl',
            attackShift,
            hitShake,
            critRing,
            down ? 'kd-down' : 'kd-bob',
          ].join(' ')}
        >
          {down ? '💫' : fighter.emoji}
        </div>
      </div>

      {/* 名字 + 连对 */}
      <div className="flex items-center gap-1.5">
        <span className="max-w-[7rem] truncate text-sm font-bold text-ink-800">
          {fighter.name}
        </span>
        {streak >= 2 && !down && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
            🔥{streak}连
          </span>
        )}
      </div>

      <HpBar fighter={fighter} flip={flip} />
    </div>
  )
}
