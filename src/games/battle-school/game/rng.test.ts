import { describe, it, expect } from 'vitest'
import { makeRng } from './rng'

describe('makeRng — 确定性 PRNG', () => {
  it('同 seed 产生同序列（next 连续取若干次比对）', () => {
    const a = makeRng(123)
    const b = makeRng(123)
    const seqA = Array.from({ length: 50 }, () => a.next())
    const seqB = Array.from({ length: 50 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('不同 seed 产生不同序列', () => {
    const a = makeRng(1)
    const b = makeRng(2)
    const seqA = Array.from({ length: 50 }, () => a.next())
    const seqB = Array.from({ length: 50 }, () => b.next())
    expect(seqA).not.toEqual(seqB)
  })

  it('next() 落在 [0,1)', () => {
    const rng = makeRng(7)
    for (let i = 0; i < 2000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('int(min,max) 落在 [min,max] 闭区间，且能取到两端', () => {
    const rng = makeRng(42)
    let sawMin = false
    let sawMax = false
    for (let i = 0; i < 5000; i++) {
      const v = rng.int(3, 8)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(8)
      if (v === 3) sawMin = true
      if (v === 8) sawMax = true
    }
    expect(sawMin).toBe(true)
    expect(sawMax).toBe(true)
  })

  it('int(n,n) 退化为定值 n', () => {
    const rng = makeRng(99)
    for (let i = 0; i < 100; i++) {
      expect(rng.int(5, 5)).toBe(5)
    }
  })

  it('float(min,max) 落在 [min,max)', () => {
    const rng = makeRng(11)
    for (let i = 0; i < 5000; i++) {
      const v = rng.float(10, 20)
      expect(v).toBeGreaterThanOrEqual(10)
      expect(v).toBeLessThan(20)
    }
  })

  it('chance(0) 恒 false、chance(1) 恒 true', () => {
    const rng = makeRng(5)
    for (let i = 0; i < 1000; i++) {
      expect(rng.chance(0)).toBe(false)
      expect(rng.chance(1)).toBe(true)
    }
  })

  it('chance(p) 命中频率大致符合 p', () => {
    const rng = makeRng(2024)
    const N = 20000
    let hits = 0
    for (let i = 0; i < N; i++) if (rng.chance(0.3)) hits++
    const ratio = hits / N
    expect(ratio).toBeGreaterThan(0.27)
    expect(ratio).toBeLessThan(0.33)
  })

  it('pick(arr) 总是返回数组内元素', () => {
    const rng = makeRng(314)
    const arr = ['a', 'b', 'c', 'd'] as const
    for (let i = 0; i < 1000; i++) {
      expect(arr).toContain(rng.pick(arr))
    }
  })

  it('pick(arr) 能覆盖到每个元素', () => {
    const rng = makeRng(271)
    const arr = ['a', 'b', 'c', 'd'] as const
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) seen.add(rng.pick(arr))
    expect(seen.size).toBe(arr.length)
  })
})
