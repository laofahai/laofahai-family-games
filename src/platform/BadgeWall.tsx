// 勋章墙：展示一个玩家的全部勋章，按稀有度上色（白/绿/蓝/紫/橙），
// 解锁的炫彩、未解锁的灰显并带进度条。可内嵌（Grid）也可弹层（Modal）。

import { X } from 'lucide-react'

import { getBadgeWall, TIER_DOT, TIER_LABEL, TIER_ORDER, TIER_STYLE, type BadgeView } from './badges'
import type { LearnGame } from './learning'
import { cn } from '@/lib/utils'

function BadgeChip({ b }: { b: BadgeView }) {
  if (b.unlocked) {
    return (
      <div className={cn('rounded-2xl border p-3 transition', TIER_STYLE[b.tier])}>
        <div className="flex items-start justify-between">
          <span className="text-3xl">{b.emoji}</span>
          <span className={cn('mt-1 h-2 w-2 rounded-full', TIER_DOT[b.tier])} title={TIER_LABEL[b.tier]} />
        </div>
        <div className="mt-1.5 font-display text-sm leading-tight text-ink-900">{b.name}</div>
        <div className="text-[11px] leading-tight text-ink-500">{b.desc}</div>
      </div>
    )
  }
  // 未解锁：灰显 + 进度
  const p = b.progress
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/60 p-3">
      <div className="flex items-start justify-between">
        <span className="text-3xl opacity-30 grayscale">{b.emoji}</span>
        <span className={cn('mt-1 h-2 w-2 rounded-full opacity-40', TIER_DOT[b.tier])} title={TIER_LABEL[b.tier]} />
      </div>
      <div className="mt-1.5 font-display text-sm leading-tight text-ink-400">{b.name}</div>
      <div className="text-[11px] leading-tight text-ink-400">{b.desc}</div>
      {p && p.goal > 0 && (
        <div className="mt-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-ink-300"
              style={{ width: `${Math.min(100, Math.round((p.cur / p.goal) * 100))}%` }}
            />
          </div>
          <div className="mt-0.5 text-right text-[10px] text-ink-400">
            {Math.min(p.cur, p.goal)} / {p.goal}
          </div>
        </div>
      )}
    </div>
  )
}

export function BadgeWallGrid({ player, learnGame }: { player: string; learnGame?: LearnGame }) {
  const wall = getBadgeWall(player, learnGame)
  const got = wall.filter((b) => b.unlocked).length
  // 按「分组」聚合，组内炫色靠后（白→橙）
  const groups = new Map<string, BadgeView[]>()
  for (const b of wall) {
    const arr = groups.get(b.group) ?? []
    arr.push(b)
    groups.set(b.group, arr)
  }
  for (const arr of groups.values()) {
    arr.sort((a, c) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(c.tier))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-ink-700">勋章墙</div>
        <div className="text-xs text-ink-500">
          已点亮 <span className="font-semibold text-melon-600">{got}</span> / {wall.length}
        </div>
      </div>
      {/* 稀有度小图例 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-400">
        {TIER_ORDER.map((t) => (
          <span key={t} className="flex items-center gap-1">
            <span className={cn('h-2 w-2 rounded-full', TIER_DOT[t])} />
            {TIER_LABEL[t]}
          </span>
        ))}
      </div>
      {[...groups.entries()].map(([group, arr]) => (
        <div key={group} className="space-y-2">
          <div className="text-xs font-semibold text-ink-500">{group}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {arr.map((b) => (
              <BadgeChip key={b.id} b={b} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function BadgeWallModal({
  player,
  learnGame,
  title,
  onClose,
}: {
  player: string
  learnGame?: LearnGame
  title?: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-ink-900/40 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="font-display text-xl text-ink-900">{title ?? '我的勋章'}</h2>
          <button onClick={onClose} aria-label="关闭" className="rounded-full p-1.5 text-ink-500 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <BadgeWallGrid player={player} learnGame={learnGame} />
        </div>
      </div>
    </div>
  )
}
