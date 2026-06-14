// 解锁庆祝浮层：拿到新勋章时弹一下，逐个展示。点一下/点关闭即收。
import type { BadgeDef } from './badges'
import { Button } from '@/components/ui/button'

export function BadgeUnlock({ badges, onClose }: { badges: BadgeDef[]; onClose: () => void }) {
  if (badges.length === 0) return null
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold tracking-widest text-melon-600">🎉 解锁新勋章</div>
        <div className="mt-4 space-y-3">
          {badges.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-2xl border border-melon-200 bg-melon-50 px-4 py-3 text-left"
            >
              <span className="text-3xl">{b.emoji}</span>
              <div>
                <div className="font-display text-lg text-ink-900">{b.name}</div>
                <div className="text-xs text-ink-500">{b.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <Button onClick={onClose} className="mt-5 w-full">
          收下啦！
        </Button>
      </div>
    </div>
  )
}
