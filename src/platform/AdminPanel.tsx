// 管理面板（仅管理员设备）：生成 / 列出 / 吊销 数字邀请码。

import { useEffect, useState } from 'react'
import { Copy, RefreshCw, ShieldCheck, Trash2, UserRound, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { adminCode } from './access'
import {
  adminDeleteProfile,
  adminListProfiles,
  adminResetProfileCode,
  listCodes,
  mintCode,
  setCodeRevoked,
  type CodeRow,
  type ProfileRow,
} from './cloud'

function numericCode(len = 6): string {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('')
}

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const admin = adminCode()
  const [codes, setCodes] = useState<CodeRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [inviteName, setInviteName] = useState('')
  const [copied, setCopied] = useState('')

  const refresh = async () => {
    if (!admin) return
    setCodes(await listCodes(admin))
    setProfiles(await adminListProfiles(admin))
    setLoading(false)
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      /* 不支持剪贴板：忽略 */
    }
  }

  const resetCode = async (p: ProfileRow) => {
    if (!admin || busy) return
    if (!window.confirm(`把「${p.name}」的个人码换一个新的？旧码立刻失效。`)) return
    setBusy(true)
    const next = numericCode()
    await adminResetProfileCode(admin, p.id, next)
    await refresh()
    setBusy(false)
  }

  const deleteProfile = async (p: ProfileRow) => {
    if (!admin || busy) return
    if (!window.confirm(`删除「${p.name}」？TA 的进度、错题本、勋章都会一起清掉，且不可恢复。`)) return
    setBusy(true)
    await adminDeleteProfile(admin, p.id)
    await refresh()
    setBusy(false)
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mintInvite = async () => {
    if (!admin || busy) return
    setBusy(true)
    await mintCode(admin, numericCode(), inviteName.trim() || '邀请码', false)
    setInviteName('')
    await refresh()
    setBusy(false)
  }

  const mintAdmin = async () => {
    if (!admin || busy) return
    setBusy(true)
    await mintCode(admin, numericCode(), '管理员', true)
    await refresh()
    setBusy(false)
  }

  const toggle = async (code: string, revoked: boolean) => {
    if (!admin) return
    await setCodeRevoked(admin, code, revoked)
    await refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-ink-900/40 p-4">
      <div className="paper-grid w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-2xl text-ink-900">
            <ShieldCheck className="h-5 w-5 text-melon-600" />
            邀请码管理
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-ink-400 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-500">写上给谁，生成数字邀请码发给 TA，在 TA 自己设备上解锁。可随时停用。</p>

        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void mintInvite()
              }}
              placeholder="给谁？比如 小宇外婆"
              maxLength={12}
              className="h-12 flex-1 rounded-2xl border border-ink-200 px-3 text-sm outline-none focus:border-melon-400"
            />
            <Button onClick={mintInvite} disabled={busy} className="min-h-12 shrink-0 text-base">
              ＋ 生成邀请码
            </Button>
          </div>
          <Button onClick={mintAdmin} disabled={busy} variant="outline" className="min-h-11 w-full text-sm">
            生成管理员码
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {loading && <div className="text-sm text-ink-400">读取中…</div>}
          {!loading && codes.length === 0 && (
            <div className="text-sm text-ink-400">还没有码，点上面生成一个。</div>
          )}
          {codes.map((c) => (
            <div
              key={c.code}
              className={cn(
                'flex items-center justify-between rounded-2xl border p-3',
                c.revoked ? 'border-ink-100 bg-ink-50/60 opacity-60' : 'border-ink-100 bg-white'
              )}
            >
              <div>
                <div className="font-mono text-lg tracking-widest text-ink-900">{c.code}</div>
                <div className="text-xs text-ink-500">
                  {c.is_admin ? '管理员' : c.label || '邀请码'}
                  {c.revoked && ' · 已停用'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggle(c.code, !c.revoked)}
                className={cn(
                  'min-h-10 rounded-full border px-3 text-sm font-semibold',
                  c.revoked
                    ? 'border-melon-400 text-melon-600'
                    : 'border-rose-300 text-rose-500 hover:bg-rose-50'
                )}
              >
                {c.revoked ? '恢复' : '停用'}
              </button>
            </div>
          ))}
        </div>

        {/* 家人个人码：查询 / 找回 / 重置 */}
        <div className="mt-6 border-t border-ink-100 pt-4">
          <div className="flex items-center gap-2 font-semibold text-ink-800">
            <UserRound className="h-4 w-4 text-melon-600" />
            家人个人码
          </div>
          <p className="mt-1 text-xs text-ink-500">谁忘了码就来这查；也能换一个好记的（旧码立即失效，进度/勋章自动迁过去）。</p>
          <div className="mt-3 space-y-2">
            {loading && <div className="text-sm text-ink-400">读取中…</div>}
            {!loading && profiles.length === 0 && (
              <div className="text-sm text-ink-400">还没有人设过个人码。</div>
            )}
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.emoji ?? '🙂'}</span>
                  <div>
                    <div className="text-sm font-semibold text-ink-900">{p.name}</div>
                    <div className="font-mono text-lg tracking-widest text-ink-800">{p.sync_code ?? '—'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.sync_code && (
                    <button
                      type="button"
                      onClick={() => void copyCode(p.sync_code!)}
                      className="flex items-center gap-1 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:border-melon-300"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copied === p.sync_code ? '已复制' : '复制'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void resetCode(p)}
                    disabled={busy}
                    className="flex items-center gap-1 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-500 hover:border-melon-300 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    换码
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteProfile(p)}
                    disabled={busy}
                    aria-label={`删除 ${p.name}`}
                    className="flex items-center gap-1 rounded-full border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-500 hover:border-rose-300 hover:text-rose-500 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
