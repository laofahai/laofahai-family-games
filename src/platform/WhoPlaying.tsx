// 单人游戏开头的轻提示：一台设备多人用（比如两个孩子）时，谁玩就点一下选谁，
// 这样「玩过/进度」按人分开记。默认就是当前的「我」，不另铺管理界面。

import { useState } from 'react'
import { UserRound } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Player } from './players'

export function WhoPlaying({
  players,
  currentId,
  onPick,
}: {
  players: Player[]
  currentId: string
  onPick: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const me = players.find((p) => p.id === currentId)

  if (open) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink-100 bg-white/70 p-3">
        <span className="text-xs font-semibold text-ink-500">谁在玩这局？（按人记进度）</span>
        {players.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              onPick(p.id)
              setOpen(false)
            }}
            className={cn(
              'flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm font-semibold transition',
              p.id === currentId
                ? 'border-melon-500 bg-melon-50 text-melon-700'
                : 'border-ink-200 bg-white text-ink-600 hover:border-melon-300'
            )}
          >
            <span>{p.emoji}</span>
            <span>{p.name}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 self-start rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-melon-300"
    >
      <UserRound className="h-3.5 w-3.5 text-melon-600" />
      现在是 {me?.emoji ?? '🙂'} {me?.name ?? '谁'} 在玩 · 不是？换人
    </button>
  )
}
