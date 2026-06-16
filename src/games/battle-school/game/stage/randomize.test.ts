import { describe, it, expect } from 'vitest'
import { makeRng } from '../rng'
import { resolveStage } from './randomize'
import { STAGE_1, STAGE_2, STAGES, WORLD_W } from './stages'
import type { StageDef, ResolvedStage } from './StageDef'

// 地图可达性不变量 + 确定性。
// 这能挡住 tsc 抓不到的「地图不可通关」类坑：随机解析出的关卡若高度/坑宽/坐标越界，
// 玩家就跳不过去 / 走不到旗子。对每个 seed 都断言解析结果落在「可达弧」内。

const SEEDS = 500 // seed = 0..499

const CASES: { name: string; def: StageDef }[] = [
  { name: 'STAGE_1', def: STAGE_1 },
  { name: 'STAGE_2', def: STAGE_2 },
]

/** 对一张已解析关卡做全部不变量断言。 */
function assertReachableInvariants(s: ResolvedStage, worldW: number): void {
  // ── 平台：高度卡在跳跃弧内、宽度合理、x 在世界内 ──
  expect(s.platforms.length).toBeGreaterThan(0)
  for (const p of s.platforms) {
    expect(p.h).toBeLessThanOrEqual(150) // 跳跃弧上限
    expect(p.h).toBeGreaterThanOrEqual(60)
    expect(p.w).toBeGreaterThanOrEqual(110)
    expect(p.w).toBeLessThanOrEqual(230)
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.x).toBeLessThanOrEqual(worldW)
  }

  // ── 坑：一跳能过、整段在世界内 ──
  expect(s.pits.length).toBeGreaterThan(0)
  for (const pit of s.pits) {
    expect(pit.w).toBeLessThanOrEqual(210)
    expect(pit.x).toBeGreaterThanOrEqual(0)
    expect(pit.x + pit.w).toBeLessThanOrEqual(worldW)
  }

  // ── 管道：高度卡在可跳上/跳过、x 在世界内 ──
  for (const pipe of s.pipes) {
    expect(pipe.h).toBeLessThanOrEqual(140)
    expect(pipe.x).toBeGreaterThanOrEqual(0)
    expect(pipe.x).toBeLessThanOrEqual(worldW)
  }

  // ── ?块：高度在能顶到的区间、x 在世界内 ──
  for (const q of s.qBlocks) {
    expect(q.h).toBeGreaterThanOrEqual(100)
    expect(q.h).toBeLessThanOrEqual(150)
    expect(q.x).toBeGreaterThanOrEqual(0)
    expect(q.x).toBeLessThanOrEqual(worldW)
  }

  // ── 刷怪点：atX 升序、都在世界内、count ≥ 1 ──
  expect(s.spawns.length).toBeGreaterThan(0)
  let prevAtX = -Infinity
  for (const sp of s.spawns) {
    expect(sp.atX).toBeGreaterThanOrEqual(prevAtX) // 升序
    prevAtX = sp.atX
    expect(sp.atX).toBeGreaterThanOrEqual(0)
    expect(sp.atX).toBeLessThanOrEqual(worldW)
    expect(sp.count).toBeGreaterThanOrEqual(1)
  }

  // ── 陷阱：x 在世界内 ──
  for (const t of s.traps) {
    expect(t.x).toBeGreaterThanOrEqual(0)
    expect(t.x).toBeLessThanOrEqual(worldW)
  }

  // ── 关卡级：起点 < 旗子 < 世界宽 ──
  expect(s.heroStartX).toBeLessThan(s.flagX)
  expect(s.flagX).toBeLessThan(worldW)
  expect(s.worldW).toBe(worldW)
}

describe('resolveStage — 可达性不变量（每 seed 都满足）', () => {
  for (const { name, def } of CASES) {
    it(`${name}：seed 0..${SEEDS - 1} 解析出的关卡都满足可达约束`, () => {
      for (let seed = 0; seed < SEEDS; seed++) {
        const resolved = resolveStage(def, makeRng(seed))
        assertReachableInvariants(resolved, def.worldW)
      }
    })
  }

  it('STAGES 轮转表包含 STAGE_1 与 STAGE_2，WORLD_W 一致', () => {
    expect(STAGES).toEqual([STAGE_1, STAGE_2])
    expect(WORLD_W).toBe(20000)
    expect(STAGE_1.worldW).toBe(WORLD_W)
    expect(STAGE_2.worldW).toBe(WORLD_W)
  })
})

describe('resolveStage — 确定性', () => {
  for (const { name, def } of CASES) {
    it(`${name}：同 seed 两次解析深度相等`, () => {
      const a = resolveStage(def, makeRng(7))
      const b = resolveStage(def, makeRng(7))
      expect(a).toEqual(b)
    })

    it(`${name}：不同 seed 结果不应完全相同`, () => {
      const a = resolveStage(def, makeRng(7))
      const b = resolveStage(def, makeRng(8))
      expect(a).not.toEqual(b)
    })
  }
})
