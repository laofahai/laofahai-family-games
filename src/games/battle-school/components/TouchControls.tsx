// 动作游戏控制层：左=虚拟摇杆（拖动走），右=动作键（👊普攻 · ⚡技能 · ⤴跳）。
// 触摸 + 鼠标通用（pointer 事件，触屏笔记本也能用）。回调式，不直接耦合 scene。
//
// 桌面另有键盘（在 PlayingView 里）：方向键移动、空格跳、J 普攻、K 技能。

import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

export function TouchControls({
  onMove,
  onJump,
  onAttack,
  onSkill,
  skillReady = false,
  energyPct = 0,
}: {
  /** 方向意图：-1 左 / 0 停 / 1 右 */
  onMove: (dir: -1 | 0 | 1) => void
  onJump: () => void
  onAttack: () => void
  onSkill: () => void
  /** 能量是否够放技能（够了高亮可点） */
  skillReady?: boolean
  /** 能量百分比 0~100（画技能键内圈） */
  energyPct?: number
}) {
  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const activeId = useRef<number | null>(null)
  const dirRef = useRef<-1 | 0 | 1>(0)
  const R = 52 // 摇杆最大行程

  const setKnob = (dx: number, dy: number) => {
    const k = knobRef.current
    if (k) k.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
  }
  const handleMove = (e: ReactPointerEvent) => {
    if (activeId.current !== e.pointerId) return
    const base = baseRef.current
    if (!base) return
    const r = base.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const dist = Math.hypot(dx, dy) || 1
    if (dist > R) {
      dx = (dx / dist) * R
      dy = (dy / dist) * R
    }
    setKnob(dx, dy)
    const dir: -1 | 0 | 1 = dx < -14 ? -1 : dx > 14 ? 1 : 0
    if (dir !== dirRef.current) {
      dirRef.current = dir
      onMove(dir)
    }
  }
  const start = (e: ReactPointerEvent) => {
    e.preventDefault()
    activeId.current = e.pointerId
    try {
      baseRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* 忽略 */
    }
    handleMove(e)
  }
  const end = (e: ReactPointerEvent) => {
    if (activeId.current !== e.pointerId) return
    activeId.current = null
    setKnob(0, 0)
    if (dirRef.current !== 0) {
      dirRef.current = 0
      onMove(0)
    }
  }
  const tap = (fn: () => void) => (e: ReactPointerEvent) => {
    e.preventDefault()
    fn()
  }

  const actBtn =
    'pointer-events-auto flex items-center justify-center rounded-full font-black text-white backdrop-blur-sm select-none touch-none active:scale-95 transition-transform'

  return (
    <>
      {/* 左：虚拟摇杆 */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-30 select-none sm:bottom-6 sm:left-6">
        <div
          ref={baseRef}
          className="pointer-events-auto relative h-32 w-32 touch-none rounded-full bg-white/15 ring-2 ring-white/25 backdrop-blur-sm"
          onPointerDown={start}
          onPointerMove={handleMove}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <div
            ref={knobRef}
            className="absolute left-1/2 top-1/2 h-16 w-16 rounded-full bg-white/45 ring-1 ring-white/60 shadow-lg"
            style={{ transform: 'translate(-50%, -50%)' }}
          />
          <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-white/80">
            移动
          </span>
        </div>
      </div>

      {/* 右：动作键 👊普攻 / ⚡技能 / ⤴跳 */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex select-none items-end gap-3 sm:bottom-6 sm:right-6">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            aria-label="技能"
            className={`${actBtn} relative h-14 w-14 text-2xl ${skillReady ? 'bg-amber-400/80 ring-2 ring-amber-200' : 'bg-white/20 ring-1 ring-white/30'}`}
            onPointerDown={tap(onSkill)}
          >
            ⚡
            {/* 能量内圈 */}
            <span
              className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-amber-300/70"
              style={{ clipPath: `inset(${100 - Math.max(0, Math.min(100, energyPct))}% 0 0 0)` }}
            />
          </button>
          <button
            type="button"
            aria-label="跳"
            className={`${actBtn} h-16 w-16 bg-sky-400/70 text-3xl ring-1 ring-white/40`}
            onPointerDown={tap(onJump)}
          >
            ⤴
          </button>
        </div>
        <button
          type="button"
          aria-label="普攻"
          className={`${actBtn} h-24 w-24 bg-rose-500/80 text-5xl ring-2 ring-white/40`}
          onPointerDown={tap(onAttack)}
        >
          👊
        </button>
      </div>
    </>
  )
}
