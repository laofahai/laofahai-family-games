// 关卡随机解算：把一张「手工 StageDef」+ 一个 seeded rng → 「完全确定的 ResolvedStage」。
// ResolvedStage 里所有东西都已拍板（不再有 'random' / fixed 这类待定字段），ArenaScene 拿去直接实例化。
//
// ── ~1/3 随机层 ────────────────────────────────────────────────────────────
// 设计要求：大约三分之一的「可随机元素」会被 rng 改写，其余保持手工原样，
// 从而「每局有变化但骨架稳定」。本实现：fixed=true 的元素永不变；fixed=false 的元素
// 各自掷一次 rng.bool(VARY_CHANCE)（VARY_CHANCE≈1/3）决定这一局要不要动它，动哪些由 rng 决定。
//
// ── 确定性 ────────────────────────────────────────────────────────────────
// 同一 (def, seed) → 同一 ResolvedStage。所有随机都走传入的 rng，绝不 Math.random()。
// rng 的消费顺序是固定的（按 platforms→pits→qBlocks→spawns→traps、数组内按下标），
// 因此不同客户端只要 def 和 seed 相同就得到逐字段一致的结果。

import type { Rng } from '../rng'
import type {
  StageDef,
  QBlockContent,
  TrapKind,
} from './StageDef'

/** 可随机元素这一局「被改写」的概率（≈1/3 随机层）。 */
const VARY_CHANCE = 1 / 3

// ── 解算后结构（ArenaScene 直接实例化这些）──────────────────────────────────

export interface ResolvedPlatform {
  x: number
  /** 距地面线高度（px）。 */
  y: number
  w: number
}

export interface ResolvedPit {
  x: number
  w: number
  /** true=真坑（掉进去 onFall）；false=已被随机层填平，是安全实地。 */
  real: boolean
}

export interface ResolvedPipe {
  x: number
  h: number
  w: number
  /** 传送目标世界 x（无则 undefined，实体侧作桩）。 */
  teleportTo?: number
}

export interface ResolvedQBlock {
  x: number
  y: number
  content: QBlockContent
}

export interface ResolvedSpawn {
  x: number
  count: number
}

export interface ResolvedTrap {
  x: number
  w: number
  kind: TrapKind
  /** true=这一局真的会触发；false=哑的（看着像但踩了没事）。 */
  armed: boolean
  /** 触发点世界 x（armed 时实体在此处判定塌陷/出刺）。 */
  triggerX: number
}

export interface ResolvedStage {
  id: string
  worldW: number
  heroStartX: number
  platforms: ResolvedPlatform[]
  pits: ResolvedPit[]
  pipes: ResolvedPipe[]
  qBlocks: ResolvedQBlock[]
  spawns: ResolvedSpawn[]
  traps: ResolvedTrap[]
  flagX: number
}

const DEFAULT_PIPE_W = 64

/**
 * 把手工关卡按 seed 解算成确定布局。纯函数。
 * @param def 手工关卡定义。
 * @param rng 种子 RNG（同 seed → 同结果）。
 */
export function resolveStage(def: StageDef, rng: Rng): ResolvedStage {
  // 平台：fixed 原样；非 fixed 这一局可能被「微调」（小幅左右挪 + 宽度微变），高度仍夹在可达范围内。
  const platforms: ResolvedPlatform[] = def.platforms.map((p) => {
    if (p.fixed || !rng.bool(VARY_CHANCE)) {
      return { x: p.x, y: p.y, w: p.w }
    }
    const dx = rng.between(-40, 40)
    const dw = rng.between(-20, 20)
    return {
      x: Math.max(0, p.x + dx),
      y: clamp(p.y, 70, 150), // 守住跳跃可达上限
      w: Math.max(64, p.w + dw),
    }
  })

  // 坑：fixed 必为真坑；非 fixed 这一局可能被「填平变安全」或「确认为真陷阱」，按 trapBias。
  const pits: ResolvedPit[] = def.pits.map((pit) => {
    if (pit.fixed) return { x: pit.x, w: pit.w, real: true }
    if (!rng.bool(VARY_CHANCE)) return { x: pit.x, w: pit.w, real: true } // 这一局不动它 → 维持手工默认（真坑）
    const bias = pit.trapBias ?? 0.5
    return { x: pit.x, w: pit.w, real: rng.bool(bias) }
  })

  // 水管：结构固定（障碍要稳），只把可选字段补全。
  const pipes: ResolvedPipe[] = def.pipes.map((pp) => ({
    x: pp.x,
    h: pp.h,
    w: pp.w ?? DEFAULT_PIPE_W,
    teleportTo: pp.teleportTo,
  }))

  // ?-砖：fixed 锁定内容；非 fixed（或 content='random'）这一局可能改内容，从 contentPool 里抽。
  const qBlocks: ResolvedQBlock[] = def.qBlocks.map((q) => {
    const pool = q.contentPool && q.contentPool.length > 0 ? q.contentPool : DEFAULT_CONTENT_POOL
    if (q.content !== 'random' && (q.fixed || !rng.bool(VARY_CHANCE))) {
      return { x: q.x, y: q.y, content: q.content }
    }
    // content='random' 一定重掷；非 fixed 命中 VARY_CHANCE 也重掷。
    return { x: q.x, y: q.y, content: rng.pick(pool) }
  })

  // 敌人刷新点：fixed 锁数量；非 fixed 这一局可能在 [min,max] 内重掷。
  const spawns: ResolvedSpawn[] = def.spawns.map((s) => {
    if (s.fixed || !rng.bool(VARY_CHANCE)) return { x: s.x, count: s.count }
    const lo = s.minCount ?? Math.max(0, s.count - 1)
    const hi = s.maxCount ?? s.count + 1
    return { x: s.x, count: rng.between(lo, hi) }
  })

  // 伪装陷阱：fixed 必触发、触发点取中点；非 fixed 这一局可能决定它是否真触发 + 触发点位置。
  const traps: ResolvedTrap[] = def.disguisedTraps.map((t) => {
    const mid = t.x + t.w / 2
    if (t.fixed) return { x: t.x, w: t.w, kind: t.kind, armed: true, triggerX: mid }
    if (!rng.bool(VARY_CHANCE)) return { x: t.x, w: t.w, kind: t.kind, armed: true, triggerX: mid }
    const armed = rng.bool(t.armBias ?? 0.5)
    // 触发点在区段内随机（留出 20% 边距，避免贴边触发体验差）。
    const margin = t.w * 0.2
    const triggerX = t.x + margin + rng.frac() * (t.w - 2 * margin)
    return { x: t.x, w: t.w, kind: t.kind, armed, triggerX }
  })

  return {
    id: def.id,
    worldW: def.worldW,
    heroStartX: def.heroStartX,
    platforms,
    pits,
    pipes,
    qBlocks,
    spawns,
    traps,
    flagX: def.flagX,
  }
}

const DEFAULT_CONTENT_POOL: QBlockContent[] = ['coin', 'coin', 'energy', 'buff']

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
