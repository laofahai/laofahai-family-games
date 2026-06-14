// 种子随机数（mulberry32）。纯函数、零 Phaser 依赖、确定性：同一 seed → 同一序列。
//
// 为什么需要它：课间大乱斗是「合作 / 联机感知」的——同一关卡的 ~1/3 随机层（哪些坑是真陷阱、
// ?-砖内容、敌人数量、伪装陷阱触发点）必须在所有客户端上「跑出完全一样的布局」。
// 因此关卡随机一律走这个 seeded rng，绝不调用 Math.random()。
//
// 用法：
//   const rng = makeRng(seed)            // seed 可来自房间号 / 关卡号 / 服务器下发
//   rng.frac()        → [0,1)
//   rng.between(a, b) → [a,b] 闭区间整数
//   rng.pick(arr)     → 数组里挑一个
//   rng.bool(0.3)     → 30% 概率为 true
//   rng.shuffle(arr)  → 返回打乱后的「新数组」（不改原数组）

export interface Rng {
  /** [0, 1) 的浮点随机。 */
  frac(): number
  /** [a, b] 闭区间整数随机（a、b 会先取整；自动纠正 a>b）。 */
  between(a: number, b: number): number
  /** 从数组里等概率取一个元素（空数组抛错）。 */
  pick<T>(arr: readonly T[]): T
  /** 以概率 p（默认 0.5）返回 true。 */
  bool(p?: number): boolean
  /** Fisher–Yates 洗牌，返回新数组（不修改入参）。 */
  shuffle<T>(arr: readonly T[]): T[]
}

/**
 * 创建一个 mulberry32 种子 RNG。
 * @param seed 任意 number；内部会按 32 位无符号处理（NaN/非整会被规整）。
 */
export function makeRng(seed: number): Rng {
  // 规整种子为 32 位无符号整数；保证非有限值也有确定行为。
  let state = (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0

  const frac = (): number => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const between = (a: number, b: number): number => {
    let lo = Math.floor(a)
    let hi = Math.floor(b)
    if (lo > hi) [lo, hi] = [hi, lo]
    return lo + Math.floor(frac() * (hi - lo + 1))
  }

  const pick = <T,>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error('rng.pick: empty array')
    return arr[Math.floor(frac() * arr.length)]
  }

  const bool = (p = 0.5): boolean => frac() < p

  const shuffle = <T,>(arr: readonly T[]): T[] => {
    const out = arr.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(frac() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }

  return { frac, between, pick, bool, shuffle }
}
