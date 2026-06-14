// 损人/嘴炮浮层：可选一句预设损人台词，或自己打字。低伤害，但「侮辱性极强」的演出
// 由 reducer 写 diss fx、scene 播大字 + 抖屏 + emoji 爆发。这里只管选/输入并 dispatch。

import { useRef, useState } from 'react'
import type { DissLine } from '../types'
import { Button } from '@/components/ui/button'

const MAX_LEN = 30

export function DissOverlay({
  presets,
  enemyEmoji,
  enemyName,
  locked,
  onDiss,
}: {
  presets: DissLine[]
  enemyEmoji: string
  enemyName: string
  locked: boolean
  onDiss: (text: string) => void
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const fire = () => {
    const t = text.trim()
    if (!t || locked) return
    onDiss(t)
    setText('')
  }

  return (
    <div className="bs-pop pointer-events-auto w-full max-w-xl rounded-3xl border border-ink-100 bg-white/95 p-4 shadow-lg backdrop-blur sm:p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
          🗯️ 嘴炮时间
        </span>
        <span className="text-sm font-medium text-ink-600">
          {enemyEmoji} {enemyName}
        </span>
      </div>

      <p className="mb-3 text-lg font-semibold leading-snug text-ink-900">
        损 TA 一句！选个段子，或自己编一句（伤害不高，但侮辱性极强）。
      </p>

      {presets.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {presets.slice(0, 4).map((d) => (
            <Button
              key={d.id}
              variant="outline"
              disabled={locked}
              onClick={() => onDiss(d.text)}
              className="min-h-12 justify-start whitespace-normal py-2 text-left text-base"
            >
              {d.text}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') fire()
          }}
          disabled={locked}
          placeholder="自己打一句损 TA 的话…"
          maxLength={MAX_LEN}
          className="h-12 flex-1 rounded-2xl border border-ink-200 px-3 text-base outline-none focus:border-rose-400 disabled:opacity-50"
        />
        <Button
          onClick={fire}
          disabled={locked || !text.trim()}
          className="h-12 w-full bg-rose-500 text-white hover:bg-rose-600 sm:w-auto"
        >
          开喷 💢
        </Button>
      </div>
    </div>
  )
}
