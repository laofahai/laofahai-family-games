// 关卡解析（randomize）：StageDef（含随机区间）+ 一个确定性 Rng → ResolvedStage（坐标落定）。
//   同一个 (def, seed) 永远解析出同一张地图（确定性），便于复现与将来联机共享 seed。
//   解析时尽量保证：平台高度/间距在跳跃弧内、坑宽一跳能过、?块在能顶到的高度。

import type { Rng } from '../rng'
import type {
  StageDef,
  ResolvedStage,
  Range,
  PlatformSlot,
  ResolvedPlatform,
} from './StageDef'

/** 从一个 Range 用 rng 取一个整数值（含端点）。 */
function rangeInt(r: Range, rng: Rng): number {
  return rng.int(Math.round(r.min), Math.round(r.max))
}

/** 把一个平台槽展开成 count 块连续平台（沿 x 递进，间距 gap）。 */
function expandPlatformSlot(slot: PlatformSlot, rng: Rng): ResolvedPlatform[] {
  const out: ResolvedPlatform[] = []
  const count = rangeInt(slot.count, rng)
  // 起点在 [xFrom, xTo] 偏左处，留出 count*gap 的延展空间不冲出 xTo。
  const span = slot.xTo - slot.xFrom
  let x = slot.xFrom + rng.float(0, Math.max(0, span * 0.25))
  for (let i = 0; i < count; i++) {
    const w = rangeInt(slot.w, rng)
    const h = rangeInt(slot.h, rng)
    out.push({ x: Math.round(x), h, w })
    const gap = rangeInt(slot.gap, rng)
    x += gap
    if (x > slot.xTo) break
  }
  return out
}

/** 解析一关：把所有槽展开为具体实体。 */
export function resolveStage(def: StageDef, rng: Rng): ResolvedStage {
  const platforms: ResolvedPlatform[] = []
  for (const slot of def.platforms) platforms.push(...expandPlatformSlot(slot, rng))

  const pits = def.pits.map((slot) => {
    const w = rangeInt(slot.w, rng)
    const x = Math.round(slot.xFrom + rng.float(0, Math.max(0, slot.xTo - slot.xFrom - w)))
    const real = rng.chance(slot.realChance)
    return { x, w, real }
  })

  const pipes: ResolvedStage['pipes'] = []
  for (const slot of def.pipes) {
    const count = rangeInt(slot.count, rng)
    const span = slot.xTo - slot.xFrom
    for (let i = 0; i < count; i++) {
      const x = Math.round(slot.xFrom + (span * (i + 0.5)) / count + rng.float(-30, 30))
      pipes.push({ x, h: rangeInt(slot.h, rng) })
    }
  }

  const qBlocks: ResolvedStage['qBlocks'] = []
  for (const slot of def.qBlocks) {
    const count = rangeInt(slot.count, rng)
    const span = slot.xTo - slot.xFrom
    for (let i = 0; i < count; i++) {
      const x = Math.round(slot.xFrom + (span * (i + 0.5)) / count + rng.float(-24, 24))
      qBlocks.push({ x, h: rangeInt(slot.h, rng), reward: slot.reward })
    }
  }

  const spawns = def.spawns
    .map((slot) => ({ atX: slot.atX, count: rangeInt(slot.count, rng) }))
    .sort((a, b) => a.atX - b.atX)

  const traps: ResolvedStage['traps'] = []
  for (const slot of def.traps) {
    const count = rangeInt(slot.count, rng)
    const span = slot.xTo - slot.xFrom
    for (let i = 0; i < count; i++) {
      const w = 70
      const x = Math.round(slot.xFrom + (span * (i + 0.5)) / count + rng.float(-40, 40))
      traps.push({ x, w })
    }
  }

  return {
    worldW: def.worldW,
    heroStartX: def.heroStartX,
    flagX: def.flagX,
    platforms,
    pits,
    pipes,
    qBlocks,
    spawns,
    traps,
  }
}
