// 确定性伪随机数发生器（deterministic PRNG）。
//   关卡布局（平台/坑/管道/?方块/刷怪点/陷阱）用它从一个 seed 生成，保证：
//   · 同 seed → 同布局（可复现、便于联机：将来联机用「共享 seed」即可两端布局一致）。
//   · 不污染 Phaser/Math.random 的全局随机（表演特效仍可用全局随机，无所谓）。
// 算法用 mulberry32：32-bit、快、分布够用，足以铺一关地形。

/** 一个可复用的随机源：next() 取 [0,1) 浮点；附若干便捷方法。 */
export interface Rng {
  /** [0,1) 浮点。 */
  next(): number
  /** [min,max] 闭区间整数。 */
  int(min: number, max: number): number
  /** [min,max) 浮点。 */
  float(min: number, max: number): number
  /** 概率 p（0–1）命中。 */
  chance(p: number): boolean
  /** 从数组里等概率挑一个。 */
  pick<T>(arr: readonly T[]): T
}

/** 由一个 32-bit 种子构造确定性随机源（mulberry32）。 */
export function makeRng(seed: number): Rng {
  // 取整并落到 32-bit 无符号域，保证种子是离散整数。
  let a = seed >>> 0
  const next = (): number => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    float: (min, max) => next() * (max - min) + min,
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  }
}
