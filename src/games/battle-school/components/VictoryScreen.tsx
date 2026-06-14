import type { RosterDef } from '@/games/_battle/roster'
import type { Band } from '@/games/_battle/core'
import { battleCry } from '@/games/_battle/cries'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// 毕业日期：六年级隐藏款按真实日期解锁。到这天(含)以后通关 → 毕业典礼。
export const GRAD_DATE = '2026-07-01'

function todayStr(): string {
  const d = new Date()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function gradUnlocked(): boolean {
  return new Date() >= new Date(`${GRAD_DATE}T00:00:00`)
}

const CONFETTI = ['🎉', '🎊', '⭐', '🌟', '🎈', '✨', '💫']

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 24 }).map((_, i) => (
        <span
          key={i}
          className="bs-confetti"
          style={{
            left: `${(i * 4.2 + 2) % 100}%`,
            animationDuration: `${2.4 + (i % 5) * 0.6}s`,
            animationDelay: `${(i % 7) * 0.25}s`,
          }}
        >
          {CONFETTI[i % CONFETTI.length]}
        </span>
      ))}
    </div>
  )
}

export function VictoryScreen({
  roster,
  playerName,
  band,
  onRestart,
  onExit,
}: {
  roster: RosterDef
  playerName: string
  /** 玩家年龄段：用来取一句中二「终结」战吼作庆祝词（来自 DB，取不到则不显示）。 */
  band?: Band
  onRestart: () => void
  onExit: () => void
}) {
  const wantGraduation = roster.finale === 'graduation'
  const showGraduation = wantGraduation && gradUnlocked()
  // 中二终结战吼（庆祝）。组件只在通关时渲染一次，render 期取一次即可。
  const finishCry = band ? battleCry('finish', band) : null

  if (showGraduation) {
    return (
      <Card className="relative mx-auto max-w-xl space-y-4 overflow-hidden p-6 text-center">
        <Confetti />
        <div className="relative">
          <div className="text-5xl">
            <span className="bs-cap-toss">🎓</span>
          </div>
          <h2 className="mt-1 font-display text-2xl text-ink-900">毕业典礼 🎓</h2>
          <p className="mt-1 text-sm text-ink-600">同学们列队鼓掌，老师们送上祝福！</p>
          {finishCry && (
            <p className="mx-auto mt-2 max-w-sm rounded-2xl bg-rose-600/95 px-4 py-1.5 text-center font-display text-base font-black text-white shadow">
              {finishCry}
            </p>
          )}

          {/* 毕业证书卡 */}
          <div className="mx-auto mt-4 max-w-sm rounded-3xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-white p-5 shadow-inner">
            <div className="text-3xl">📜</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-widest text-amber-600">
              小学毕业证书
            </div>
            <div className="mt-2 text-xl font-bold text-ink-900">{playerName}</div>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              恭喜你顺利完成小学全部学业，今日光荣毕业！
              <br />
              愿你带着勇气与好奇，奔向更大的世界。
            </p>
            <div className="mt-3 text-xs text-ink-400">颁发日期：{todayStr()}</div>
          </div>

          <div className="mt-4 space-y-1 text-sm text-ink-600">
            {roster.bosses.map((b) => (
              <p key={b.id}>
                {b.emoji} {b.name}：{b.winLine}
              </p>
            ))}
          </div>

          <div className="mt-3 text-3xl">
            <span className="bs-firework">🎆</span> <span className="bs-firework" style={{ animationDelay: '0.4s' }}>🎇</span>{' '}
            <span className="bs-firework" style={{ animationDelay: '0.8s' }}>🎆</span>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <Button onClick={onRestart} variant="outline" className="min-h-12 text-base">
              再玩一遍
            </Button>
            <Button onClick={onExit} className="min-h-12 text-base">
              返回
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  // 普通通关庆祝
  return (
    <Card className="relative mx-auto max-w-xl space-y-4 overflow-hidden p-6 text-center">
      <Confetti />
      <div className="relative">
        <div className="text-5xl">🏆</div>
        <h2 className="mt-1 font-display text-2xl text-ink-900">通关啦！</h2>
        <p className="mt-1 text-sm text-ink-600">
          {playerName} 把全部老师都答服气啦，太厉害了！
        </p>
        {finishCry && (
          <p className="mx-auto mt-2 max-w-sm rounded-2xl bg-rose-600/95 px-4 py-1.5 text-center font-display text-base font-black text-white shadow">
            {finishCry}
          </p>
        )}
        {wantGraduation && (
          <p className="mx-auto mt-3 max-w-sm rounded-2xl bg-sky-50 p-3 text-sm text-sky-700">
            毕业典礼要等毕业季哦 🎓（{GRAD_DATE} 起开放）
          </p>
        )}
        <div className="mt-3 space-y-1 text-sm text-ink-600">
          {roster.bosses.map((b) => (
            <p key={b.id}>
              {b.emoji} {b.name}：{b.winLine}
            </p>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <Button onClick={onRestart} variant="outline" className="min-h-12 text-base">
            再玩一遍
          </Button>
          <Button onClick={onExit} className="min-h-12 text-base">
            返回
          </Button>
        </div>
      </div>
    </Card>
  )
}
