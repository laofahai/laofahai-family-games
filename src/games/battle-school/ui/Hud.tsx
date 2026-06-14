// HUD 浮层（thin）：只渲染场景推来的 HudState，不持有任何游戏逻辑。
// 显示主角血条、关卡/波次、BOSS 血条、能量/技能槽、连杀、静音、返回。

import type { HudState } from '../game/bridge'
import { cn } from '@/lib/utils'

export function Hud({
  hud,
  onBack,
  onToggleMute,
}: {
  hud: HudState
  onBack: () => void
  onToggleMute: () => void
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 select-none p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        {/* 左上：返回 + 主角血 + 能量 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="pointer-events-auto rounded-full bg-black/45 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition hover:bg-black/60"
            >
              ← 返回
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className="pointer-events-auto rounded-full bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur transition hover:bg-black/60"
            >
              {hud.muted ? '🔇' : '🔊'}
            </button>
          </div>

          {/* 主角血（爱心格） */}
          <div className="flex items-center gap-1 rounded-full bg-black/35 px-3 py-1.5 backdrop-blur">
            {Array.from({ length: hud.maxHp }).map((_, i) => (
              <span key={i} className={cn('text-xl leading-none transition', i < hud.hp ? '' : 'opacity-25 grayscale')}>
                ❤️
              </span>
            ))}
          </div>

          {/* 能量 / 技能槽 */}
          <div className="w-44 rounded-full bg-black/35 px-3 py-1.5 backdrop-blur">
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-white/90">
              <span>{hud.skill === 'nova' ? '⚡ 学霸大招' : '💚 学霸回血'}</span>
              <span>{Math.round(hud.energy * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className={cn('h-full rounded-full transition-all', hud.energy >= 1 ? 'bg-amber-300' : 'bg-sky-400')}
                style={{ width: `${Math.round(hud.energy * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 右上：关卡 / 波次 / biome / 连杀 */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="rounded-full bg-black/45 px-3 py-1.5 text-right text-sm font-semibold text-white backdrop-blur">
            第 {hud.level}/{hud.totalLevels} 关 · {hud.biome}
          </div>
          <div className="rounded-full bg-black/35 px-3 py-1 text-right text-xs text-white/90 backdrop-blur">
            {hud.isBossWave ? '🎓 关底·老师！' : `第 ${hud.waveIndex}/${hud.waveTotal} 波 · 剩 ${hud.waveRemaining} 人`}
          </div>
          {hud.combo >= 2 && (
            <div className="rounded-full bg-amber-400/90 px-3 py-1 text-right text-xs font-bold text-amber-950 backdrop-blur">
              连击 ×{hud.combo}
            </div>
          )}
        </div>
      </div>

      {/* BOSS 血条（居中顶部） */}
      {hud.isBossWave && hud.bossMaxHp > 0 && (
        <div className="mx-auto mt-2 w-full max-w-md rounded-2xl bg-black/45 px-4 py-2 backdrop-blur">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-white">
            <span>🎓 {hud.bossName}（学霸护盾·答题破防）</span>
            <span>
              {hud.bossHp}/{hud.bossMaxHp}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all"
              style={{ width: `${hud.bossMaxHp ? (hud.bossHp / hud.bossMaxHp) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
