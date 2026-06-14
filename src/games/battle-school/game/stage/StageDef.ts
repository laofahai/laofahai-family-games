// 关卡 schema（手工编排 + ~1/3 随机层）。
// 这是「一张固定地图」的类型定义：横版卷轴，沿世界宽 WORLD_W（≈3600）从左到右铺。
// Mario 风元素：悬空平台、地面坑、水管、?-砖、敌人刷新点、伪装陷阱、终点旗（= Boss 锚点）。
//
// ── 坐标 / 单位约定 ────────────────────────────────────────────────────────
// · 所有 x/w/h 都是【世界像素】，x ∈ [0, WORLD_W]。WORLD_W 由 ArenaScene 定（≈3600）。
// · y 轴向下为正（Phaser 约定）。但本 schema 里平台/砖的 y 用「距地面线的高度」表达，
//   见 PlatformDef.y 注释——这样不依赖具体视口高，换分辨率仍成立。
// · 地面线 groundY = round(H * GROUND_RATIO)（GROUND_RATIO≈0.82）。地面是 y=groundY 处一条水平线，
//   主角/敌人脚底锚点（origin 0.5,1）站在 groundY 上。地平线以下是实心地。
// · 「坑 pit」= 在地面线上挖掉一段 [x, x+w] 的实心地：掉进去触发 onFall（扣血+重生，不是秒死）。
//
// ── 跳跃弧假设（用于判定平台「够得到」）────────────────────────────────────
// Hero.ts: JUMP_V=780，ArenaScene 重力 gravity.y=1800，RUN_SPEED=300。
//   最大跳跃高度 = JUMP_V² / (2*g) = 780² / 3600 ≈ 169px
//   滞空总时长   = 2 * JUMP_V / g  = 1560 / 1800 ≈ 0.867s
//   水平最大跨度 ≈ RUN_SPEED * 滞空 ≈ 300 * 0.867 ≈ 260px
// 编排守则（留安全余量，全家都能玩，不硬核）：
//   · 平台离地高度 PlatformDef.y 取 ≤ 150（< 169，单跳可上）。叠跳台阶每级 ≤ 130。
//   · 需要跨越的坑宽 PitDef.w ≤ 200（< 260），且坑两侧要有落脚地。
//   · 水管高度 PipeDef.h ≤ 150（单跳能跳上/越过）。

import type { Rng } from '../rng'

// 重新导出，方便 stage/* 内部只从一处取类型。
export type { Rng }

/** ?-砖被顶出来的内容种类。 */
export type QBlockContent = 'coin' | 'energy' | 'buff'

/** 伪装陷阱的「真面目」（被触发时变成的形态）。 */
export type TrapKind = 'collapse' | 'spike'

/**
 * 悬空平台（实心、可站立、可作落脚点）。
 * @property x   左边缘世界 x。
 * @property y   平台顶面【距地面线的高度】（正数 = 高出地面多少 px）。务必 ≤ 150 以保证单跳可达。
 * @property w   平台宽度（px）。
 * @property fixed 是否「固定」：true=随机层不会动它；false=随机层可能微调（如左右挪一点 / 改宽）。
 */
export interface PlatformDef {
  x: number
  y: number
  w: number
  fixed: boolean
}

/**
 * 地面坑（在地面线上挖掉 [x, x+w] 的实心地）。
 * @property w     坑宽（px）。跨越用的坑请 ≤ 200。
 * @property fixed true=必为坑；false=随机层可能「填平」让它变安全，或反过来。
 * @property trapBias 随机层把它判成「真陷阱(掉落)」的倾向权重 [0,1]（仅 fixed=false 时参考）。
 *                   未给时随机层用默认 0.5。
 */
export interface PitDef {
  x: number
  w: number
  fixed: boolean
  trapBias?: number
}

/**
 * 水管（实心障碍，站立面在管口顶）。可选传送目标（先留桩，ArenaScene 后续接）。
 * @property h        管高【距地面线】（px），≤ 150 单跳可上/越。
 * @property w        管宽（px），默认由实体侧给（≈64）。
 * @property teleportTo 传送目标世界 x（可选；ResolvedStage 会原样带出，实体侧暂作桩）。
 */
export interface PipeDef {
  x: number
  h: number
  w?: number
  teleportTo?: number
}

/**
 * ?-砖（从下往上顶 → 弹出内容）。
 * @property y       砖底面【距地面线的高度】（px）。常配合下方可起跳点，取 90~150。
 * @property content 固定内容；若想随机由随机层决定，置 'random' 并给 contentPool。
 * @property contentPool 当 content='random' 时，随机层从中按 rng 选一个。
 * @property fixed   true=内容锁定（content 必须是具体值）；false=允许随机层改写。
 */
export interface QBlockDef {
  x: number
  y: number
  content: QBlockContent | 'random'
  contentPool?: QBlockContent[]
  fixed: boolean
}

/**
 * 敌人刷新点（stomp 区：玩家可踩头击杀的小怪聚集处）。
 * @property x     刷新中心世界 x（地面上）。
 * @property count 固定刷新数；随机层可在 [min,max] 内浮动（见 minCount/maxCount）。
 * @property minCount/maxCount 随机层允许的数量区间（仅 fixed=false 时用）。
 * @property fixed true=数量锁死为 count；false=随机层在区间内重掷。
 */
export interface SpawnPointDef {
  x: number
  count: number
  minCount?: number
  maxCount?: number
  fixed: boolean
}

/**
 * 伪装陷阱（地面上看着正常的一段，踩上去可能塌陷/出尖刺）。
 * @property x/w   覆盖的地面区段。
 * @property kind  真面目（塌陷 collapse / 尖刺 spike）。
 * @property fixed true=必定是陷阱且触发点固定在中点；false=随机层决定它是否真触发、以及触发点位置。
 * @property armBias 随机层把它判成「真会触发」的倾向 [0,1]（仅 fixed=false 时用，未给默认 0.5）。
 */
export interface DisguisedTrapDef {
  x: number
  w: number
  kind: TrapKind
  fixed: boolean
  armBias?: number
}

/**
 * 一张手工关卡定义。坐标全部基于 WORLD_W。
 * flagX 同时是「终点旗」与「Boss 锚点」（旗到了即关底，Boss 在此登场）。
 */
export interface StageDef {
  /** 关卡标识（调试/日志用）。 */
  id: string
  /** 该关假定的世界宽（应等于 ArenaScene 的 WORLD_W；不一致时以 ArenaScene 为准、超界元素自然落在世界外）。 */
  worldW: number
  /** 主角入场 x（通常 ≈ 200，留出左侧安全区）。 */
  heroStartX: number
  platforms: PlatformDef[]
  pits: PitDef[]
  pipes: PipeDef[]
  qBlocks: QBlockDef[]
  spawns: SpawnPointDef[]
  disguisedTraps: DisguisedTrapDef[]
  /** 终点旗 = Boss 锚点的世界 x。 */
  flagX: number
}
