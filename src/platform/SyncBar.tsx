// 个人进度同步条：给当前选中的玩家连一个数字同步码，TA 的「玩过/进度」就能跟着换设备。
// 没配云端时整块隐藏；连接 = 领取档案 + 双向合并（先拉云、再把本机推上去）。

import { useState } from 'react'
import { Cloud, Loader2 } from 'lucide-react'

import { claimProfile, cloudAvailable } from './cloud'
import { getPlayers } from './players'
import { clearSyncCode, getSyncCode, hydratePlayer, pushAllLocal, setSyncCode } from './progress'

function randomSyncCode(): string {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
}

export function SyncBar({ playerId }: { playerId: string }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [, force] = useState(0)
  const refresh = () => force((n) => n + 1)

  if (!cloudAvailable()) return null

  const code = getSyncCode(playerId)
  const player = getPlayers().find((p) => p.id === playerId)
  const name = player?.name ?? '这个人'

  const connect = async (raw: string) => {
    const c = raw.replace(/\D/g, '')
    if (c.length < 4 || busy || !player) {
      if (c.length < 4) setErr('同步码至少 4 位数字')
      return
    }
    setBusy(true)
    setErr('')
    const id = await claimProfile(c, player.name, player.emoji, player.kind)
    if (!id) {
      setErr('连不上，检查网络或换个码再试')
      setBusy(false)
      return
    }
    setSyncCode(c, playerId)
    await hydratePlayer(playerId) // 云 → 本地
    await pushAllLocal(playerId) // 本地 → 云（两边都成并集）
    setBusy(false)
    setInput('')
    setOpen(false)
    refresh()
  }

  const disconnect = () => {
    clearSyncCode(playerId)
    setOpen(false)
    refresh()
  }

  // 已连接：显示码 + 断开
  if (code) {
    return (
      <div className="flex flex-wrap items-center gap-2 self-start rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-700">
        <Cloud className="h-3.5 w-3.5" />
        <span>
          {name} 已同步 · 码 <span className="font-mono font-semibold tracking-widest">{code}</span>
        </span>
        <button
          type="button"
          onClick={disconnect}
          className="rounded-full border border-sky-300 px-2 py-0.5 font-semibold text-sky-600 hover:bg-white"
        >
          断开
        </button>
      </div>
    )
  }

  // 未连接：收起时一个按钮，展开后输码/生成
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setErr('')
        }}
        className="flex items-center gap-1.5 self-start rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-sky-300"
      >
        <Cloud className="h-3.5 w-3.5 text-sky-500" />
        给「{name}」连个同步码
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 self-start rounded-2xl border border-sky-200 bg-sky-50/60 p-3 text-xs">
      <div className="text-ink-600">
        给「{name}」连个数字同步码。别的设备给 TA 输同一个码，进度就接着走。
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void connect(input)
          }}
          placeholder="输已有同步码"
          maxLength={10}
          className="h-10 w-36 rounded-full border border-ink-200 bg-white px-3 text-center font-mono tracking-widest outline-none focus:border-sky-400"
        />
        <button
          type="button"
          onClick={() => void connect(input)}
          disabled={busy}
          className="flex min-h-10 items-center gap-1 rounded-full border border-sky-400 bg-white px-3 font-semibold text-sky-700 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          连上
        </button>
        <button
          type="button"
          onClick={() => void connect(randomSyncCode())}
          disabled={busy}
          className="min-h-10 rounded-full border border-dashed border-sky-300 px-3 font-semibold text-sky-600 disabled:opacity-50"
        >
          生成新码
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setErr('')
          }}
          className="min-h-10 px-2 text-ink-400"
        >
          取消
        </button>
      </div>
      {err && <div className="text-rose-500">{err}</div>}
    </div>
  )
}
