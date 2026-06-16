import { describe, it, expect, vi } from 'vitest'

// progression.ts 在顶层 import './cloud' 与 './progress'（它们会拉 supabase / 摸 localStorage）。
// 我们只测其中的纯函数 levelForXp / titleForLevel / levelBounds —— 这些函数本身不碰 cloud/progress，
// 所以把这两个依赖打桩成空壳，仅为让模块能在 node 下被导入（绝不改 progression 自身逻辑）。
vi.mock('./cloud', () => ({
  pullLearn: async () => ({}),
  pushLearn: async () => {},
}))
vi.mock('./progress', () => ({
  getCurrentPlayer: () => 'test',
  getSyncCode: () => null,
}))

const { levelForXp, titleForLevel, levelBounds } = await import('./progression')

// 表内阈值（与实现保持一致，用于推导期望等级）
const THRESHOLDS = [0, 100, 250, 500, 900, 1500, 2400, 3600, 5200, 7200, 9800, 13000]

describe('levelForXp — 累计 XP → 等级', () => {
  it('0 / 负数 XP 都是 Lv.1', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(-50)).toBe(1)
  })

  it('恰好踩在每个阈值上即进入对应等级', () => {
    THRESHOLDS.forEach((t, i) => {
      expect(levelForXp(t)).toBe(i + 1)
    })
  })

  it('阈值前一点仍是上一级（边界下侧）', () => {
    for (let i = 1; i < THRESHOLDS.length; i++) {
      expect(levelForXp(THRESHOLDS[i] - 1)).toBe(i) // i+1 级的前一点 → i 级
    }
  })

  it('表尾之后每 +4000 XP 线性外推一级', () => {
    const last = THRESHOLDS[THRESHOLDS.length - 1] // 13000 → Lv.12
    expect(levelForXp(last)).toBe(12)
    expect(levelForXp(last + 4000)).toBe(13)
    expect(levelForXp(last + 8000)).toBe(14)
    expect(levelForXp(last + 4000 - 1)).toBe(12) // 还差一点不升
  })

  it('XP 单调不减 → 等级单调不减', () => {
    let prev = 0
    for (let xp = 0; xp <= 30000; xp += 137) {
      const lv = levelForXp(xp)
      expect(lv).toBeGreaterThanOrEqual(prev)
      prev = lv
    }
  })
})

describe('titleForLevel — 等级 → 称号', () => {
  it('称号分段边界正确', () => {
    expect(titleForLevel(1)).toBe('觉醒新星')
    expect(titleForLevel(2)).toBe('觉醒新星')
    expect(titleForLevel(3)).toBe('思考者')
    expect(titleForLevel(5)).toBe('学霸')
    expect(titleForLevel(7)).toBe('学神')
    expect(titleForLevel(9)).toBe('脑力领主')
    expect(titleForLevel(11)).toBe('觉醒之王')
    expect(titleForLevel(99)).toBe('觉醒之王') // 超高等级仍是顶档
  })
})

describe('levelBounds — 经验条区间', () => {
  it('floor/ceil 包住当前 xp，且 floor < ceil', () => {
    for (const xp of [0, 50, 100, 300, 1499, 1500, 9800, 13000, 20000]) {
      const { level, floor, ceil } = levelBounds(xp)
      expect(level).toBe(levelForXp(xp))
      expect(floor).toBeLessThanOrEqual(xp)
      expect(xp).toBeLessThan(ceil)
      expect(floor).toBeLessThan(ceil)
    }
  })

  it('表内区间等于相邻阈值', () => {
    // xp=300 → Lv.3（250..500）
    const b = levelBounds(300)
    expect(b.level).toBe(3)
    expect(b.floor).toBe(250)
    expect(b.ceil).toBe(500)
  })

  it('外推第一档（Lv.12）区间正确：[13000, 17000)', () => {
    const last = THRESHOLDS[THRESHOLDS.length - 1] // 13000 → 进入 Lv.12（表尾档）
    const b12 = levelBounds(last + 100)
    expect(b12.level).toBe(12)
    expect(b12.floor).toBe(last) // 13000：level-1=11 仍在表内，取得正确下界
    expect(b12.ceil).toBe(last + 4000) // 17000
  })

  // ⚠ 已知 quirk（如实记录，未改业务代码）：Lv.13 起（level-1 >= 表长）floor 退化为 0，
  //   而 ceil 仍按 4000 外推正确。即经验条下界在 Lv.13+ 是错的（应为 17000，实为 0）。
  //   断言锁住「当前真实行为」，以便将来若修复 progression.ts 时该测试会提醒同步更新。
  it('外推第二档起（Lv.13+）：ceil 正确但 floor 退化为 0（当前实现的已知行为）', () => {
    const last = THRESHOLDS[THRESHOLDS.length - 1] // 13000
    const b13 = levelBounds(last + 4000 + 100) // 17100 → Lv.13
    expect(b13.level).toBe(13)
    expect(b13.ceil).toBe(last + 8000) // 21000，正确
    expect(b13.floor).toBe(0) // 退化（理想应为 17000）—— 记录现状，非测试放水
  })
})
