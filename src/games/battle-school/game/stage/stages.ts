// 手工编排的关卡布局（StageDef）。至少两张：STAGE_1 / STAGE_2，都是「真能玩」的 Mario 风：
// 够得到的悬空平台、公平的地面坑、几根水管、带内容的 ?-砖、几处敌人刷新点、1~2 个伪装陷阱、终点旗(=Boss锚点)。
//
// ── ArenaScene 怎么消费这张表（集成说明）──────────────────────────────────
//   1. 选关：const def = STAGES[level % STAGES.length]（或按 level 自定映射）。
//   2. 解算：import { resolveStage } from './stage/randomize'
//            const resolved = resolveStage(def, makeRng(seed))   // seed 联机共享 → 各端同布局
//   3. 建世界：在 buildLevelWorld 里——
//        · 地面：按 resolved.pits 把铺满世界的实心地「挖洞」（真坑 real=true 处不放碰撞地、放 Pit 触发区）。
//        · resolved.platforms → new Platform / staticGroup 加实心矩形（y 是「距地面线高度」，
//          实际世界 y = groundY - p.y）。
//        · resolved.pipes → new Pipe(scene, x, groundY, h, w)；resolved.qBlocks → new QBlock(...)。
//        · resolved.traps → new DisguisedTrap(...)（armed=false 的就是哑的，照常铺看着正常）。
//        · resolved.spawns → 记下来，按你现有波次系统在这些 x 刷小怪（count 个）。
//        · resolved.flagX → 终点旗 + Boss 在此登场（替代/对接现有 spawnBoss 的 x）。
//   4. 主角入场用 resolved.heroStartX。
// 详见 entities.ts 顶部的「集成接口」。
//
// 坐标全部基于 WORLD_W=3600（与 ArenaScene 常量一致）。y 字段=距地面线高度（见 StageDef 注释）。
// 跳跃弧：单跳最高≈169px、水平跨度≈260px → 平台高 ≤150、跨越坑宽 ≤200、管高 ≤150（留余量）。

import type { StageDef } from './StageDef'

const WORLD_W = 3600

/**
 * 第一关「热身操场」：节奏平缓，教会玩家跳台阶、跨小坑、顶 ?-砖、越水管。
 * 左侧 0~520 是无坑安全入场区（主角 200 起步，给入场无敌缓冲）。
 */
export const STAGE_1: StageDef = {
  id: 'stage-1',
  worldW: WORLD_W,
  heroStartX: 200,
  platforms: [
    // 一组上升台阶（每级抬 ~110，单跳可逐级上）。
    { x: 700, y: 110, w: 140, fixed: true },
    { x: 900, y: 130, w: 140, fixed: false },
    // 坑上方的「奖励高台」，鼓励玩家跳上去拿 ?-砖。
    { x: 1500, y: 140, w: 180, fixed: true },
    // 中段连跳两块小浮台（非固定，随机层可能微调，仍可达）。
    { x: 2050, y: 120, w: 120, fixed: false },
    { x: 2260, y: 120, w: 120, fixed: false },
    // 临近终点的高台（站上去俯冲 Boss 区）。
    { x: 3050, y: 130, w: 160, fixed: true },
  ],
  pits: [
    // 第一个坑：固定真坑，宽 160（< 200 可跨）。两侧有落脚地。
    { x: 1180, w: 160, fixed: true },
    // 第二个坑：非固定，随机层可能填平；偏向真坑。
    { x: 1760, w: 150, fixed: false, trapBias: 0.6 },
    // 终点前小坑：非固定，偏安全（trapBias 低）。
    { x: 2700, w: 140, fixed: false, trapBias: 0.35 },
  ],
  pipes: [
    { x: 1080, h: 110 }, // 第一个坑前的水管：可跳上去再跨坑。
    { x: 2480, h: 130, teleportTo: 3000 }, // 带传送桩（实体侧暂不真传送）。
  ],
  qBlocks: [
    { x: 760, y: 130, content: 'coin', fixed: true }, // 台阶上方，新手必经。
    { x: 1560, y: 140, content: 'energy', fixed: false }, // 奖励高台上：非固定，可能变 buff/coin。
    { x: 2160, y: 150, content: 'random', contentPool: ['coin', 'energy', 'buff'], fixed: false },
  ],
  spawns: [
    { x: 1000, count: 1, fixed: true }, // 开局热身怪。
    { x: 1650, count: 2, minCount: 1, maxCount: 3, fixed: false },
    { x: 2900, count: 2, minCount: 2, maxCount: 3, fixed: false }, // 终点前的小队。
  ],
  disguisedTraps: [
    // 看着是普通地面的一段：非固定，随机层决定这局是否真塌 + 触发点。
    { x: 1900, w: 120, kind: 'collapse', fixed: false, armBias: 0.5 },
  ],
  flagX: 3380, // 终点旗 = Boss 锚点。
}

/**
 * 第二关「断桥险道」：更密集的坑与平台跳跃，水管更高，两个伪装陷阱，节奏更紧。
 */
export const STAGE_2: StageDef = {
  id: 'stage-2',
  worldW: WORLD_W,
  heroStartX: 200,
  platforms: [
    // 开局就要跳浮台过第一个坑。
    { x: 560, y: 120, w: 130, fixed: true },
    { x: 820, y: 130, w: 120, fixed: false },
    // 双层平台（下层落脚 → 上层拿砖）。
    { x: 1350, y: 90, w: 150, fixed: true },
    { x: 1380, y: 150, w: 100, fixed: false },
    // 连续浮台跨大坑（每块间距 ~210，需稳跳；非固定但高度锁可达）。
    { x: 1900, y: 130, w: 110, fixed: false },
    { x: 2120, y: 130, w: 110, fixed: false },
    { x: 2340, y: 130, w: 110, fixed: false },
    // 终点前高台。
    { x: 3080, y: 140, w: 170, fixed: true },
  ],
  pits: [
    { x: 480, w: 130, fixed: true }, // 开局坑，逼玩家立刻跳。
    { x: 980, w: 170, fixed: false, trapBias: 0.7 }, // 偏真坑。
    { x: 1980, w: 180, fixed: true }, // 大坑：靠连续浮台过（180 < 200 也可硬跨）。
    { x: 2600, w: 150, fixed: false, trapBias: 0.5 },
  ],
  pipes: [
    { x: 700, h: 120 },
    { x: 1620, h: 140 },
    { x: 2520, h: 150, teleportTo: 3020 },
  ],
  qBlocks: [
    { x: 1370, y: 150, content: 'random', contentPool: ['energy', 'buff'], fixed: false },
    { x: 2120, y: 150, content: 'coin', fixed: true },
    { x: 3120, y: 150, content: 'buff', fixed: false }, // 终点前奖励。
  ],
  spawns: [
    { x: 760, count: 1, fixed: true },
    { x: 1450, count: 2, minCount: 1, maxCount: 3, fixed: false },
    { x: 2200, count: 2, minCount: 2, maxCount: 3, fixed: false },
    { x: 2950, count: 3, minCount: 2, maxCount: 4, fixed: false },
  ],
  disguisedTraps: [
    { x: 1180, w: 130, kind: 'spike', fixed: false, armBias: 0.6 },
    { x: 2780, w: 120, kind: 'collapse', fixed: true }, // 固定必塌（教学：让玩家见识一次）。
  ],
  flagX: 3400,
}

/** 所有手工关卡（ArenaScene 按 level 取用）。 */
export const STAGES: StageDef[] = [STAGE_1, STAGE_2]
