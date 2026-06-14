// 触屏控制（thin）：左下虚拟摇杆（左/右）+ 右下动作按钮（普攻/跳/技能）。
// 只把意图通过 controls 喂回场景（setMove/jump/attack/triggerSkill），不持有任何逻辑。
// 用 pointer 事件：按下→setMove(dir)，松开/离开→setMove(0)，保证不会「卡住一直走」。

import { useRef } from 'react'
import type { GameControls, SkillKind } from '../game/bridge'
import { cn } from '@/lib/utils'

export function TouchControls({
  controls,
  skill,
  energyFull,
  onSwitchSkill,
}: {
  controls: GameControls
  skill: SkillKind
  energyFull: boolean
  onSwitchSkill: () => void
}) {
  // 记录当前按住的方向键，避免重复 setMove。
  const heldDir = useRef<-1 | 0 | 1>(0)

  function press(dir: -1 | 1) {
    if (heldDir.current === dir) return
    heldDir.current = dir
    controls.setMove(dir)
  }
  function release() {
    if (heldDir.current === 0) return
    heldDir.current = 0
    controls.setMove(0)
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex select-none items-end justify-between p-4 sm:p-6">
      {/* 左：方向 */}
      <div className="pointer-events-auto flex gap-3">
        <DirButton label="◀" onDown={() => press(-1)} onUp={release} />
        <DirButton label="▶" onDown={() => press(1)} onUp={release} />
      </div>

      {/* 右：动作 */}
      <div className="pointer-events-auto flex items-end gap-3">
        <ActionButton label="跳" sub="JUMP" color="bg-sky-500/85" onTap={() => controls.jump()} />
        <ActionButton label="普攻" sub="ATK" color="bg-rose-500/85" big onTap={() => controls.attack()} />
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onSwitchSkill}
            className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white backdrop-blur"
          >
            切换 {skill === 'nova' ? '⚡' : '💚'}
          </button>
          <ActionButton
            label={skill === 'nova' ? '大招' : '回血'}
            sub="SKILL"
            color={energyFull ? 'bg-amber-400/95' : 'bg-slate-500/70'}
            onTap={() => controls.triggerSkill()}
          />
        </div>
      </div>
    </div>
  )
}

function DirButton({ label, onDown, onUp }: { label: string; onDown: () => void; onUp: () => void }) {
  return (
    <button
      type="button"
      className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/40 text-2xl text-white backdrop-blur active:bg-black/60 sm:h-20 sm:w-20"
      onPointerDown={(e) => {
        e.preventDefault()
        onDown()
      }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
    >
      {label}
    </button>
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
