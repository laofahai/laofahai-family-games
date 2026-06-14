// 首次进入的解锁门：输数字码解锁这台设备。
// 个人码 / 普通访问码：一步即进。管理码：先输码 → 再输「管理员名字」二次校验（防撞库）。

import { useState } from 'react'
import { KeyRound, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { tryAdminLogin, tryUnlock } from './access'

export type UnlockInfo = { name: string; emoji: string | null; code: string; admin?: boolean }

export function UnlockGate({ onUnlocked }: { onUnlocked: (info?: UnlockInfo) => void }) {
  const [step, setStep] = useState<'code' | 'adminName'>('code')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submitCode = async () => {
    if (!code.trim() || busy) return
    setBusy(true)
    setErr('')
    const res = await tryUnlock(code)
    setBusy(false)
    if (res.needAdminName) {
      setStep('adminName') // 是管理码：进第二步要名字
      return
    }
    if (res.ok) onUnlocked(res.person)
    else setErr('码不对，或已被停用。找发码的人要一个。')
  }

  const submitAdmin = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    setErr('')
    const res = await tryAdminLogin(code, name)
    setBusy(false)
    if (res.ok) onUnlocked({ name: name.trim(), emoji: '🧙', code: code.trim(), admin: true })
    else setErr('码或名字不对。') // 不提示是哪个错，防撞库
  }

  if (step === 'adminName') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="paper-grid w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldCheck className="h-5 w-5 text-melon-600" />
              管理员验证
            </CardTitle>
            <CardDescription>再输入管理员名字才能进（名字 + 码都对才算数）。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitAdmin()
              }}
              placeholder="管理员名字"
              autoFocus
              maxLength={16}
              className="h-14 w-full rounded-2xl border border-ink-200 bg-white px-4 text-center text-xl outline-none focus:border-melon-400"
            />
            {err && <p className="text-sm text-rose-500">{err}</p>}
            <Button onClick={submitAdmin} disabled={busy || !name.trim()} className="min-h-14 w-full text-base">
              {busy ? '验证中…' : '进入'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep('code')
                setName('')
                setErr('')
              }}
              className="w-full text-sm text-ink-400 hover:text-ink-600"
            >
              ← 换个码
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="paper-grid w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <KeyRound className="h-5 w-5 text-melon-600" />
            输入你的码
          </CardTitle>
          <CardDescription>
            每人一个码：输你的个人码就进，玩过的题、错题本都跟着你换设备走。管理员输管理码（还要再输名字）。第一次输一次，以后免输。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCode()
            }}
            placeholder="数字识别码"
            autoFocus
            className="h-14 w-full rounded-2xl border border-ink-200 bg-white px-4 text-center text-2xl tracking-[0.3em] outline-none focus:border-melon-400"
          />
          {err && <p className="text-sm text-rose-500">{err}</p>}
          <Button onClick={submitCode} disabled={busy || !code.trim()} className="min-h-14 w-full text-base">
            {busy ? '验证中…' : '解锁'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
