// 可复用的「这一局有谁」选人组件：勾选在场玩家，可内联添加朋友/其他人。
// 供谁是卧底、两真一假、编故事等"传手机"类游戏在开局时使用。

import { useState } from 'react'

import { cn } from '@/lib/utils'
import { addPlayer, getPlayers, type Player } from './players'

interface RosterPickerProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  /** 至少要选几人；不足时父组件可据此禁用开始按钮 */
  min?: number
  /** 最多选几人 */
  max?: number
}

export function RosterPicker({ selectedIds, onChange, max = 99 }: RosterPickerProps) {
  const [players, setPlayers] = useState<Player[]>(getPlayers)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id))
    } else if (selectedIds.length < max) {
      onChange([...selectedIds, id])
    }
  }

  const confirmAdd = () => {
    const n = name.trim()
    if (!n) {
      setAdding(false)
      return
    }
    const p = addPlayer(n)
    setPlayers(getPlayers())
    if (selectedIds.length < max) onChange([...selectedIds, p.id])
    setName('')
    setAdding(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {players.map((p) => {
        const active = selectedIds.includes(p.id)
        const order = selectedIds.indexOf(p.id) + 1
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            className={cn(
              'flex min-h-11 items-center gap-1.5 rounded-2xl border px-3 text-sm font-semibold transition',
              active
                ? 'border-melon-500 bg-melon-50 text-melon-700'
                : 'border-ink-200 bg-white text-ink-600 hover:border-melon-300'
            )}
          >
            {active && <span className="text-xs text-melon-500">{order}</span>}
            <span>{p.emoji}</span>
            <span>{p.name}</span>
          </button>
        )
      })}
      {adding ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmAdd()
              if (e.key === 'Escape') {
                setAdding(false)
                setName('')
              }
            }}
            placeholder="名字"
            maxLength={8}
            className="h-11 w-24 rounded-2xl border border-melon-400 px-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={confirmAdd}
            className="min-h-11 rounded-2xl border border-melon-500 bg-melon-50 px-3 text-sm font-semibold text-melon-700"
          >
            加入
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="min-h-11 rounded-2xl border border-dashed border-ink-300 px-3 text-sm font-semibold text-ink-500 hover:border-melon-400"
        >
          ＋ 加人
        </button>
      )}
    </div>
  )
}
