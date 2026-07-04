import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { cn } from '@/lib/utils'

interface RoomCodeProps {
  code: string
  className?: string
}

export function RoomCode({ code, className }: RoomCodeProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <span className={cn('inline-flex items-center gap-2 align-middle', className)}>
      <span className="font-mono tracking-[0.3em] text-orange-600">{code}</span>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-orange-200 bg-orange-50 text-orange-700 transition hover:bg-orange-100"
        aria-label="复制房号"
        title={copied ? '已复制' : '复制房号'}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </span>
  )
}
