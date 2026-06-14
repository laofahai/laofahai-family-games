// 关卡蓝图（StageDef）——一关「横版长地图」的纯数据描述（无 Phaser、无渲染）。
//   一关从近端（heroStartX）走到远端（flagX 关底 Boss 锚点），沿途散布：
//     · 可踩跳的浮空平台（platforms）
//     · 地面坑（pits，real 的会扣血+回位，非 instant death——全家向）
//     · 管道（pipes，可踩可挡，纯地形障碍）
//     · ?方块（qBlocks，顶一下出金币/能量）
//     · 沿路刷怪点（spawns，到一定推进点成簇刷同学小怪）
//     · 伪装陷阱（traps，踩中触发：短暂扣血/击退，非死）
//
// 关键约定：
//   · 所有"高度"用【离地高 heightAboveGround】表达（px，>0 在地面上方）。
//     场景按 worldY = groundY - heightAboveGround 转成世界坐标，绑定渲染/物理。
//   · 跳跃弧线（Hero JUMP_V=780 / gravity=1800 / RUN_SPEED=300）：
//     最高 ≈169px、水平 ≈260px。平台高度/间距都卡在这个弧线内，保证可达。
//   · StageDef 是"设计意图"，可带 range（随机区间）；经 randomize.ts + 一个确定性 Rng
//     解析为具体坐标的 ResolvedStage，保证同 seed 同布局。

/** 一个范围 [min,max]，由 Rng 在解析期取一个确定值（min===max 即定值）。 */
export interface Range {
  min: number
  max: number
}

/** 浮空平台的设计槽：在 [xFrom,xTo] 的某处放一块宽 w、离地高 h 的平台。 */
export interface PlatformSlot {
  xFrom: number
  xTo: number
  /** 平台宽（px）。 */
  w: Range
  /** 离地高（px，平台顶面到地面线）。卡在跳跃弧内（≤ ~160）。 */
  h: Range
  /** 该槽生成几块（连成一段台阶/浮岛）。 */
  count: Range
  /** 同段内相邻平台的中心水平间距（px，卡在 ≤ ~240 保证跳得过去）。 */
  gap: Range
}

/** 地面坑的设计槽：在 [xFrom,xTo] 的某处开一个宽 w 的坑。 */
export interface PitSlot {
  xFrom: number
  xTo: number
  /** 坑宽（px）。卡在 ≤ ~230 保证一跳能过。 */
  w: Range
  /** 是真坑（real=true：掉下去扣血+回位）还是浅坑装饰（real=false：仅视觉）。 */
  realChance: number
}

/** 管道的设计槽：在 [xFrom,xTo] 放一根高 h 的管道（可踩顶、挡路）。 */
export interface PipeSlot {
  xFrom: number
  xTo: number
  /** 管道露出地面的高（px）。卡在 ≤ ~150 让玩家能跳上/跳过。 */
  h: Range
  count: Range
}

/** ?方块的设计槽：在 [xFrom,xTo] 放 count 个离地高 h 的 ?块（顶出奖励）。 */
export interface QBlockSlot {
  xFrom: number
  xTo: number
  /** 离地高（px，块底到地面线）。放在主角跳起能顶到的高度（~110–150）。 */
  h: Range
  count: Range
  /** 奖励种类：coin=金币(能量小)，energy=能量大。 */
  reward: 'coin' | 'energy'
}

/** 沿路刷怪点：当主角推进到 atX 时，成簇刷 count 个小怪。 */
export interface SpawnSlot {
  atX: number
  count: Range
}

/** 伪装陷阱：踩到 [x, x+w] 这段地面触发一次（扣血/击退，非死）。 */
export interface TrapSlot {
  xFrom: number
  xTo: number
  count: Range
}

/** 一关的蓝图（设计意图，含随机区间）。 */
export interface StageDef {
  /** 关卡总长（世界宽，px）。 */
  worldW: number
  /** 主角出生 x（近端）。 */
  heroStartX: number
  /** Boss 锚点 x（远端关底）；与 worldW 留一段缓冲。 */
  flagX: number
  platforms: PlatformSlot[]
  pits: PitSlot[]
  pipes: PipeSlot[]
  qBlocks: QBlockSlot[]
  spawns: SpawnSlot[]
  traps: TrapSlot[]
}

// ── 解析后的具体实体（坐标全部落定，供 ArenaScene 直接建物）──────────────────

/** 解析后的平台：中心 x、离地高 h（顶面）、宽 w。 */
export interface ResolvedPlatform {
  x: number
  h: number
  w: number
}

/** 解析后的坑：地面 [x, x+w] 这段无地面碰撞；real 的掉落要扣血回位。 */
export interface ResolvedPit {
  x: number
  w: number
  real: boolean
}

/** 解析后的管道：中心 x、露出高 h。 */
export interface ResolvedPipe {
  x: number
  h: number
}

/** 解析后的 ?方块：中心 x、离地高 h（块底）、奖励种类、是否已被顶过。 */
export interface ResolvedQBlock {
  x: number
  h: number
  reward: 'coin' | 'energy'
}

/** 解析后的刷怪点：推进到 atX 触发，刷 count 个。 */
export interface ResolvedSpawn {
  atX: number
  count: number
}

/** 解析后的陷阱：地面段 [x, x+w] 踩中触发一次。 */
export interface ResolvedTrap {
  x: number
  w: number
}

/** 解析后的整关（坐标全落定，确定性）。 */
export interface ResolvedStage {
  worldW: number
  heroStartX: number
  flagX: number
  platforms: ResolvedPlatform[]
  pits: ResolvedPit[]
  pipes: ResolvedPipe[]
  qBlocks: ResolvedQBlock[]
  spawns: ResolvedSpawn[]
  traps: ResolvedTrap[]
}
