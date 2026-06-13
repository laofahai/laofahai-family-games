// 首次进入的解锁门：输一次数字识别码解锁这台设备。

import { useState } from 'react'
import { KeyRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { tryUnlock } from './access'

export function UnlockGate({
  onUnlocked,
}: {
  onUnlocked: (person?: { name: string; emoji: string | null; code: string }) => void
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)

  const submit = async () => {
    if (!code.trim() || busy) return
    setBusy(true)
    setErr(false)
    const res = await tryUnlock(code)
    setBusy(false)
    if (res.ok) onUnlocked(res.person)
    else setErr(true)
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
            每人一个码：输你的个人码就进，玩过的题、错题本都跟着你换设备走。管理员输管理码。第一次输一次，以后免输。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder="数字识别码"
            autoFocus
            className="h-14 w-full rounded-2xl border border-ink-200 bg-white px-4 text-center text-2xl tracking-[0.3em] outline-none focus:border-melon-400"
          />
          {err && <p className="text-sm text-rose-500">识别码不对，或已被停用。找发码的人要一个。</p>}
          <Button onClick={submit} disabled={busy || !code.trim()} className="min-h-14 w-full text-base">
            {busy ? '验证中…' : '解锁'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
