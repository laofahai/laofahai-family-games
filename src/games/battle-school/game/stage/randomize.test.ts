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

/**
 * 收集一张已解析关卡所有违反「可达约束」的问题（纯 JS，不调用 expect）。
 * 返回空数组 = 全部满足。在大循环里用「收集再一次性断言」模式，避免 5 万次 expect 的开销
 * （否则全量并行跑时易撞 vitest 默认 5s 超时）。违规串里带 seed/字段，失败信息依旧清晰。
 */
function reachabilityViolations(s: ResolvedStage, worldW: number, tag: string): string[] {
  const v: string[] = []
  const chk = (cond: boolean, msg: string) => { if (!cond) v.push(`${tag} ${msg}`) }

  // 平台：高度卡在跳跃弧内、宽度合理、x 在世界内
  chk(s.platforms.length > 0, 'no platforms')
  for (const p of s.platforms) {
    chk(p.h <= 150 && p.h >= 60, `platform h=${p.h} out of [60,150]`) // 跳跃弧
    chk(p.w >= 110 && p.w <= 230, `platform w=${p.w} out of [110,230]`)
    chk(p.x >= 0 && p.x <= worldW, `platform x=${p.x} out of world`)
  }
  // 坑：一跳能过、整段在世界内
  chk(s.pits.length > 0, 'no pits')
  for (const pit of s.pits) {
    chk(pit.w <= 210, `pit w=${pit.w} > 210`)
    chk(pit.x >= 0 && pit.x + pit.w <= worldW, `pit [${pit.x},${pit.x + pit.w}] out of world`)
  }
  // 管道：高度卡在可跳上/跳过、x 在世界内
  for (const pipe of s.pipes) {
    chk(pipe.h <= 140, `pipe h=${pipe.h} > 140`)
    chk(pipe.x >= 0 && pipe.x <= worldW, `pipe x=${pipe.x} out of world`)
  }
  // ?块：高度在能顶到的区间、x 在世界内
  for (const q of s.qBlocks) {
    chk(q.h >= 100 && q.h <= 150, `qblock h=${q.h} out of [100,150]`)
    chk(q.x >= 0 && q.x <= worldW, `qblock x=${q.x} out of world`)
  }
  // 刷怪点：atX 升序、都在世界内、count ≥ 1
  chk(s.spawns.length > 0, 'no spawns')
  let prevAtX = -Infinity
  for (const sp of s.spawns) {
    chk(sp.atX >= prevAtX, `spawn atX=${sp.atX} not ascending`)
    prevAtX = sp.atX
    chk(sp.atX >= 0 && sp.atX <= worldW, `spawn atX=${sp.atX} out of world`)
    chk(sp.count >= 1, `spawn count=${sp.count} < 1`)
  }
  // 陷阱：x 在世界内
  for (const t of s.traps) chk(t.x >= 0 && t.x <= worldW, `trap x=${t.x} out of world`)
  // 关卡级：起点 < 旗子 < 世界宽
  chk(s.heroStartX < s.flagX, 'heroStartX >= flagX')
  chk(s.flagX < worldW, 'flagX >= worldW')
  chk(s.worldW === worldW, 'worldW mismatch')
  return v
}

describe('resolveStage — 可达性不变量（每 seed 都满足）', () => {
  for (const { name, def } of CASES) {
    it(`${name}：seed 0..${SEEDS - 1} 解析出的关卡都满足可达约束`, () => {
      const violations: string[] = []
      for (let seed = 0; seed < SEEDS; seed++) {
        const resolved = resolveStage(def, makeRng(seed))
        violations.push(...reachabilityViolations(resolved, def.worldW, `seed=${seed}`))
        if (violations.length > 20) break // 出问题就别刷屏，留前 20 条
      }
      expect(violations).toEqual([])
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
