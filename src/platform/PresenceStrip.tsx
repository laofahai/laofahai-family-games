import { UsersRound } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { PresenceUser } from './presence'

interface PresenceStripProps {
  users: PresenceUser[]
  currentPlayerId?: string
  roomCode?: string | null
  className?: string
}

export function PresenceStrip({ users, currentPlayerId, roomCode, className }: PresenceStripProps) {
  const visible = roomCode ? users.filter((user) => user.room_code === roomCode) : users
  const unique = visible.slice(0, 8)

  return (
    <div
      className={cn(
        'flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border border-ink-100 bg-white/70 px-3 py-2 text-sm text-ink-600 shadow-sm',
        className
      )}
    >
      <span className="inline-flex items-center gap-1.5 font-semibold text-ink-700">
        <UsersRound className="h-4 w-4 text-emerald-600" />
        在线 {visible.length}
      </span>
      {unique.length > 0 ? (
        unique.map((user) => (
          <span
            key={user.peer_id}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border border-ink-100 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700',
              user.player_id === currentPlayerId && 'border-emerald-200 bg-emerald-50 text-emerald-700'
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>{user.emoji}</span>
            <span>{user.name}</span>
          </span>
        ))
      ) : (
        <span className="text-xs text-ink-400">暂无其他人在线</span>
      )}
      {visible.length > unique.length && <span className="text-xs text-ink-400">+{visible.length - unique.length}</span>}
    </div>
  )
}
