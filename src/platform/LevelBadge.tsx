// 等级牌：展示玩家在《觉醒者》里的 等级 + 中二称号 + 经验条 + 金币。
// 传 playerId（读本地缓存）或直接传 progress 对象（已有数据时免读）。
// 纯展示组件，不联网、不写库——父组件负责拉数据与升级提示。

import { getProgress, levelBounds, type Progress } from './progression'
import { cn } from '@/lib/utils'

interface LevelBadgeProps {
  /** 给 playerId 自动读本地缓存；或直接给 progress 对象。二选一。 */
  playerId?: string
  progress?: Progress
  /** 紧凑模式：单行小牌，适合塞进顶栏 */
  compact?: boolean
  className?: string
}

export function LevelBadge({ playerId, progress, compact = false, className }: LevelBadgeProps) {
  const p = progress ?? getProgress(playerId)
  const { floor, ceil } = levelBounds(p.xp)
  const span = Math.max(1, ceil - floor)
  const pct = Math.min(100, Math.max(0, Math.round(((p.xp - floor) / span) * 100)))
  const toNext = Math.max(0, ceil - p.xp)

  if (compact) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/80 px-3 py-1 shadow-sm',
          className
        )}
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-melon-500 text-xs font-bold text-white">
          {p.level}
        </span>
        <span className="font-display text-sm text-ink-900">{p.title}</span>
        <span className="ml-0.5 inline-flex items-center gap-0.5 text-sm font-semibold text-ink-700">
          <span aria-hidden>🪙</span>
          {p.coins}
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-3xl border border-ink-100 bg-white/90 p-4 shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {/* 等级徽 */}
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-melon-400 to-melon-600 text-white shadow-inner">
          <span className="text-[10px] leading-none opacity-80">LV</span>
          <span className="text-xl font-bold leading-none">{p.level}</span>
        </div>
        {/* 称号 + 金币 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-display text-lg text-ink-900">{p.title}</span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink-50 px-2.5 py-0.5 text-sm font-semibold text-ink-700">
              <span aria-hidden>🪙</span>
              {p.coins}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-ink-500">觉醒者 · 累计 {p.xp} XP</div>
        </div>
      </div>

      {/* 经验条 */}
      <div className="mt-3">
        <div
          className="h-2.5 overflow-hidden rounded-full bg-ink-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="经验值进度"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-melon-400 to-melon-600 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-ink-400">
          <span>{pct}%</span>
          <span>距下一级还差 {toNext} XP</span>
        </div>
      </div>
    </div>
  )
}

export default LevelBadge
