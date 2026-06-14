// 「我」抽屉：把这台设备的身份与管理都收在一处——切换我是谁 / 加人删人 / 云同步 /
// （管理员）邀请码 / 锁设备。首页只留一个小入口，不再铺一排。
// 注意：每一局玩的人是在「进游戏后选」或「远程房间里定」的，这里只管「这台设备现在是谁」（按人记进度）。

import { useState } from 'react'
import { Award, KeyRound, Lock, UserRound, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Player } from './players'
import { adminCode, gateActive, isAdmin, lock } from './access'
import { AdminPanel } from './AdminPanel'
import { SyncBar } from './SyncBar'
import { BadgeWallModal } from './BadgeWall'
import { badgeStats } from './badges'
import type { LearnGame } from './learning'

export function IdentitySheet({
  players,
  currentId,
  onPick,
  onAdd,
  onRemove,
  onClose,
}: {
  players: Player[]
  currentId: string
  onPick: (id: string) => void
  onAdd: (name: string) => void
  onRemove: (id: string) => void
  onClose: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [showAdmin, setShowAdmin] = useState(false)
  const [showBadges, setShowBadges] = useState(false)
  const meName = players.find((p) => p.id === currentId)?.name ?? '这个人'
  // 学习游戏=哪个孩子；非孩子只有探索勋章
  const learnGame: LearnGame | undefined =
    currentId === 'yiyi' ? 'yiyi' : currentId === 'shuner' ? 'shiliu' : undefined
  const bs = badgeStats(currentId, learnGame)

  const confirmAdd = () => {
    const name = newName.trim()
    setNewName('')
    setAdding(false)
    if (name) onAdd(name)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 sm:items-center sm:p-4">
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      {showBadges && (
        <BadgeWallModal
          player={currentId}
          learnGame={learnGame}
          title={`${meName} 的勋章`}
          onClose={() => setShowBadges(false)}
        />
      )}
      <div className="paper-grid max-h-[90vh] w-full max-w-md overflow-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-2xl text-ink-900">
            <UserRound className="h-5 w-5 text-melon-600" />
            我
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-ink-400 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 我是谁 */}
        <div className="mt-4 space-y-2">
          <div className="text-xs font-semibold text-ink-500">这台设备现在是谁？（按人记「玩过」和进度）</div>
          <div className="flex flex-wrap items-center gap-2">
            {players.map((p) => (
              <span key={p.id} className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => onPick(p.id)}
                  className={cn(
                    'flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition',
                    p.id === currentId
                      ? 'border-melon-500 bg-melon-50 text-melon-700'
                      : 'border-ink-200 bg-white text-ink-600 hover:border-melon-300'
                  )}
                >
                  <span>{p.emoji}</span>
                  <span>{p.name}</span>
                </button>
                {p.kind === 'guest' && (
                  <button
                    type="button"
                    aria-label={`删除 ${p.name}`}
                    onClick={() => onRemove(p.id)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-ink-200 bg-white text-[10px] text-ink-400 shadow-sm hover:border-rose-300 hover:text-rose-500"
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
            {adding ? (
              <span className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmAdd()
                    if (e.key === 'Escape') {
                      setAdding(false)
                      setNewName('')
                    }
                  }}
                  placeholder="名字"
                  maxLength={8}
                  className="h-10 w-24 rounded-full border border-melon-400 px-3 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={confirmAdd}
                  className="min-h-10 rounded-full border border-melon-500 bg-melon-50 px-3 text-sm font-semibold text-melon-700"
                >
                  加入
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="min-h-10 rounded-full border border-dashed border-ink-300 px-3 text-sm font-semibold text-ink-500 hover:border-melon-400"
              >
                ＋ 加人
              </button>
            )}
          </div>
          <p className="text-xs text-ink-400">每一局玩的人，进游戏后再选；远程局在房间里定。这里只是「我是谁」。</p>
        </div>

        {/* 我的勋章 */}
        <button
          type="button"
          onClick={() => setShowBadges(true)}
          className="mt-4 flex w-full items-center justify-between rounded-2xl border border-ink-200 bg-white px-4 py-3 text-left transition hover:border-melon-300"
        >
          <span className="flex items-center gap-2">
            <Award className="h-5 w-5 text-melon-600" />
            <span className="font-semibold text-ink-800">{meName} 的勋章</span>
          </span>
          <span className="text-sm text-ink-500">
            点亮 <span className="font-semibold text-melon-600">{bs.got}</span> / {bs.total} ›
          </span>
        </button>

        {/* 个人码：解锁 + 身份 + 进度/错题本，一个码全包 */}
        <div className="mt-5 space-y-1.5">
          <div className="text-xs font-semibold text-ink-500">个人码（换设备 / 解锁都用它）</div>
          <p className="text-xs text-ink-400">
            「{meName}」的专属码：别的手机/平板输这个码就能进，而且玩过的题、进度、错题本都跟着 TA 走。
            每人一个，互不影响；只在这一台玩就用不着。
          </p>
          <SyncBar playerId={currentId} />
        </div>

        {/* 管理员 + 锁 */}
        {(isAdmin() || gateActive()) && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
            {isAdmin() && adminCode() && (
              <button
                type="button"
                onClick={() => setShowAdmin(true)}
                className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-melon-300"
              >
                <KeyRound className="h-3.5 w-3.5 text-melon-600" />
                管理邀请码
              </button>
            )}
            {gateActive() && (
              <button
                type="button"
                onClick={() => {
                  lock()
                  window.location.reload()
                }}
                className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500 transition hover:border-rose-300 hover:text-rose-500"
              >
                <Lock className="h-3.5 w-3.5" />
                锁定（退出，下次要重新输码）
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
