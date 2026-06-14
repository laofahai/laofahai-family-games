// 触屏控制（thin）：左下虚拟摇杆（按下生成、拇指跟手、回中）+ 右下大号动作按钮（普攻/跳/技能）。
// 只把意图通过 controls 喂回场景（setMove/jump/attack/triggerSkill），不持有任何逻辑。
// 摇杆：在左侧区域按下 → 记录起点 → 拖动算横向偏移 → 过死区即 setMove(±1) → 松开回中 setMove(0)。
// 游戏是横版二向移动，所以摇杆只取水平分量映射到 -1/0/1（仍支持斜向按下，只看 x）。

import { useRef, useState } from 'react'
import type { GameControls, SkillKind } from '../game/bridge'
import { cn } from '@/lib/utils'

const STICK_RADIUS = 56 // 摇杆底盘半径（px）
const DEAD_ZONE = 14 // 死区（px），小于它视为不动

export function TouchControls({
  controls,
  skill,
  energyFull,
  paused,
  onSwitchSkill,
}: {
  controls: GameControls
  skill: SkillKind
  energyFull: boolean
  paused: boolean // 弹窗（答题卡片/飘题）打开时为真：摇杆需清栓锁回中（见 #23）
  onSwitchSkill: () => void
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex select-none items-end justify-between p-4 sm:p-6">
      {/* 左：虚拟摇杆（按下生成、拇指跟手、回中）。
          paused 翻转时用 key 强制重挂 → 内部 heldDir/active/knob/pointer 全部复位（#23），
          避免「暂停时手指仍按着 → 关闭后还按旧方向自动走、按反方向无反应」的卡死。 */}
      <Thumbstick key={paused ? 'paused' : 'live'} controls={controls} />

      {/* 右：大号动作按钮 */}
      <div className="pointer-events-auto flex items-end gap-3">
        <ActionButton label="跳" sub="JUMP" color="bg-sky-500/85" onTap={() => controls.jump()} />
        <ActionButton label="巴掌" sub="ATK" color="bg-rose-500/90" big onTap={() => controls.attack()} />
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onSwitchSkill}
            className="rounded-full bg-black/45 px-2 py-0.5 text-[11px] text-white backdrop-blur"
          >
            切换 {skill === 'nova' ? '⚡' : '💚'}
          </button>
          <ActionButton
            label={skill === 'nova' ? '大招' : '回血'}
            sub="SKILL"
            color={energyFull ? 'bg-amber-400/95 animate-pulse' : 'bg-slate-500/70'}
            big
            onTap={() => controls.triggerSkill()}
          />
        </div>
      </div>
    </div>
  )
}

/** 左下虚拟摇杆：按下处生成底盘，拇指跟手，横向偏移 → setMove(±1)，松开回中。 */
function Thumbstick({ controls }: { controls: GameControls }) {
  const [active, setActive] = useState(false)
  const [base, setBase] = useState({ x: 0, y: 0 }) // 底盘中心（按下点）
  const [knob, setKnob] = useState({ x: 0, y: 0 }) // 手柄相对底盘的偏移
  const pointerId = useRef<number | null>(null)
  const heldDir = useRef<-1 | 0 | 1>(0)

  function setDir(dir: -1 | 0 | 1) {
    if (heldDir.current === dir) return
    heldDir.current = dir
    controls.setMove(dir)
  }

  function onDown(e: React.PointerEvent) {
    e.preventDefault()
    pointerId.current = e.pointerId
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setBase({ x: e.clientX, y: e.clientY })
    setKnob({ x: 0, y: 0 })
    setActive(true)
  }

  function onMove(e: React.PointerEvent) {
    if (!active || e.pointerId !== pointerId.current) return
    let dx = e.clientX - base.x
    let dy = e.clientY - base.y
    // 限制手柄在底盘半径内（视觉跟手）。
    const dist = Math.hypot(dx, dy)
    if (dist > STICK_RADIUS) {
      dx = (dx / dist) * STICK_RADIUS
      dy = (dy / dist) * STICK_RADIUS
    }
    setKnob({ x: dx, y: dy })
    // 横向分量过死区 → 方向。
    if (dx <= -DEAD_ZONE) setDir(-1)
    else if (dx >= DEAD_ZONE) setDir(1)
    else setDir(0)
  }

  function onUp(e: React.PointerEvent) {
    if (e.pointerId !== pointerId.current) return
    pointerId.current = null
    setActive(false)
    setKnob({ x: 0, y: 0 })
    setDir(0)
  }

  return (
    <div
      className="pointer-events-auto relative h-40 w-40 touch-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
    >
      {/* 闲置时给个提示底盘（半透明），按下后跟手显示真正的底盘+手柄。 */}
      {!active && (
        <div className="absolute bottom-2 left-2 flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/25 bg-black/25 text-xs text-white/60 backdrop-blur">
          移动
        </div>
      )}
      {active && (
        <div
          className="pointer-events-none fixed h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40 bg-black/35 backdrop-blur"
          style={{ left: base.x, top: base.y }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 shadow-lg"
            style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
          />
        </div>
      )}
    </div>
  )
}

function ActionButton({
  label,
  sub,
  color,
  big,
  onTap,
}: {
  label: string
  sub: string
  color: string
  big?: boolean
  onTap: () => void
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault()
        onTap()
      }}
      className={cn(
        'flex flex-col items-center justify-center rounded-full text-white shadow-lg backdrop-blur transition active:scale-95',
        color,
        big ? 'h-20 w-20 text-lg sm:h-24 sm:w-24' : 'h-16 w-16 text-base sm:h-18 sm:w-18',
      )}
    >
      <span className="font-bold leading-none">{label}</span>
      <span className="text-[9px] opacity-80">{sub}</span>
    </button>
  )
}
