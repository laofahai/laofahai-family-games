// 管理面板（仅管理员设备）：生成 / 列出 / 吊销 数字邀请码。

import { useEffect, useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { adminCode } from './access'
import { listCodes, mintCode, setCodeRevoked, type CodeRow } from './cloud'

function numericCode(len = 6): string {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('')
}

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const admin = adminCode()
  const [codes, setCodes] = useState<CodeRow[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [inviteName, setInviteName] = useState('')

  const refresh = async () => {
    if (!admin) return
    setCodes(await listCodes(admin))
    setLoading(false)
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
      </div>
    </div>
  )
}
