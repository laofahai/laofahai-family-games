// 关卡蓝图库（stages）：横版长地图的设计意图。每关从近端走到远端关底 Boss。
//   设计长度 ~20000px（约旧版 3600 的 5.5 倍）：Boss 在最远端，沿途散布多段平台/坑/管道/
//   ?块/刷怪点/陷阱，玩家要打穿一长串同学簇才到关底老师。刷怪点一路铺到 Boss 前，不留空走。
//
//   可达性约束（按 Hero 跳跃弧 ≈169px 高 / ≈260px 远）：
//     · 平台离地高 h ≤ 150；同段相邻平台间距 gap ≤ 230；
//     · 坑宽 w ≤ 210（一跳能过，不靠平台也安全）；管道高 ≤ 140；?块离地高 110–150（跳起能顶到）。
//   刷怪点（spawns）沿全程铺 ~12 个，保证到 Boss 前有"一长串"小怪遭遇，不会有大段无事可做的赶路。

import type { StageDef } from './StageDef'

export const WORLD_W = 20000 // 关卡总长（世界宽，px）。相机/物理/地面/背景都按它铺满。

const HERO_START_X = 220
const FLAG_X = WORLD_W - 520 // Boss 锚点（关底，留缓冲不贴世界边）= 19480

/** 第一关：操场——平缓起步，台阶+坑+管道+?块循序，刷怪点 12 处，Boss 在最远端。 */
export const STAGE_1: StageDef = {
  worldW: WORLD_W,
  heroStartX: HERO_START_X,
  flagX: FLAG_X,
  platforms: [
    // 起步台阶（教学：先放矮平台）。
    { xFrom: 900, xTo: 1700, w: { min: 150, max: 210 }, h: { min: 70, max: 110 }, count: { min: 2, max: 3 }, gap: { min: 180, max: 220 } },
    // 浮岛群（跨坑用）。
    { xFrom: 2300, xTo: 3200, w: { min: 140, max: 190 }, h: { min: 90, max: 140 }, count: { min: 2, max: 3 }, gap: { min: 190, max: 230 } },
    { xFrom: 4200, xTo: 5200, w: { min: 150, max: 200 }, h: { min: 80, max: 130 }, count: { min: 2, max: 4 }, gap: { min: 180, max: 220 } },
    // 阶梯爬升。
    { xFrom: 6000, xTo: 7000, w: { min: 130, max: 170 }, h: { min: 70, max: 150 }, count: { min: 3, max: 4 }, gap: { min: 170, max: 210 } },
    { xFrom: 7800, xTo: 8800, w: { min: 150, max: 200 }, h: { min: 90, max: 140 }, count: { min: 2, max: 3 }, gap: { min: 190, max: 230 } },
    { xFrom: 9400, xTo: 10400, w: { min: 150, max: 210 }, h: { min: 80, max: 130 }, count: { min: 2, max: 4 }, gap: { min: 180, max: 220 } },
    { xFrom: 11000, xTo: 12000, w: { min: 140, max: 190 }, h: { min: 80, max: 140 }, count: { min: 3, max: 4 }, gap: { min: 175, max: 215 } },
    { xFrom: 12800, xTo: 13900, w: { min: 150, max: 200 }, h: { min: 90, max: 150 }, count: { min: 2, max: 4 }, gap: { min: 180, max: 220 } },
    { xFrom: 14600, xTo: 15700, w: { min: 130, max: 180 }, h: { min: 70, max: 140 }, count: { min: 3, max: 4 }, gap: { min: 170, max: 210 } },
    { xFrom: 16400, xTo: 17600, w: { min: 150, max: 210 }, h: { min: 80, max: 130 }, count: { min: 2, max: 4 }, gap: { min: 180, max: 220 } },
  ],
  pits: [
    { xFrom: 2050, xTo: 2300, w: { min: 150, max: 200 }, realChance: 1 },
    { xFrom: 3600, xTo: 3900, w: { min: 150, max: 190 }, realChance: 1 },
    { xFrom: 5300, xTo: 5600, w: { min: 150, max: 200 }, realChance: 1 },
    { xFrom: 7100, xTo: 7400, w: { min: 150, max: 200 }, realChance: 1 },
    { xFrom: 9000, xTo: 9300, w: { min: 140, max: 190 }, realChance: 1 },
    { xFrom: 10800, xTo: 11100, w: { min: 150, max: 200 }, realChance: 1 },
    { xFrom: 13900, xTo: 14200, w: { min: 150, max: 210 }, realChance: 1 },
    { xFrom: 17600, xTo: 17900, w: { min: 150, max: 200 }, realChance: 1 },
  ],
  pipes: [
    { xFrom: 1750, xTo: 2000, h: { min: 90, max: 130 }, count: { min: 1, max: 1 } },
    { xFrom: 5700, xTo: 6100, h: { min: 90, max: 140 }, count: { min: 1, max: 2 } },
    { xFrom: 9900, xTo: 10200, h: { min: 90, max: 130 }, count: { min: 1, max: 1 } },
    { xFrom: 13400, xTo: 13700, h: { min: 100, max: 140 }, count: { min: 1, max: 2 } },
    { xFrom: 16000, xTo: 16300, h: { min: 90, max: 130 }, count: { min: 1, max: 1 } },
  ],
  qBlocks: [
    { xFrom: 1200, xTo: 1500, h: { min: 110, max: 140 }, count: { min: 1, max: 2 }, reward: 'coin' },
    { xFrom: 3400, xTo: 3700, h: { min: 120, max: 150 }, count: { min: 1, max: 1 }, reward: 'energy' },
    { xFrom: 6300, xTo: 6700, h: { min: 110, max: 145 }, count: { min: 1, max: 2 }, reward: 'coin' },
    { xFrom: 8200, xTo: 8600, h: { min: 120, max: 150 }, count: { min: 1, max: 1 }, reward: 'energy' },
    { xFrom: 10500, xTo: 10900, h: { min: 110, max: 145 }, count: { min: 1, max: 2 }, reward: 'coin' },
    { xFrom: 12400, xTo: 12800, h: { min: 120, max: 150 }, count: { min: 1, max: 1 }, reward: 'energy' },
    { xFrom: 15000, xTo: 15400, h: { min: 110, max: 145 }, count: { min: 1, max: 2 }, reward: 'coin' },
    { xFrom: 17000, xTo: 17400, h: { min: 120, max: 150 }, count: { min: 1, max: 1 }, reward: 'energy' },
  ],
  spawns: [
    { atX: 1100, count: { min: 2, max: 3 } },
    { atX: 2600, count: { min: 2, max: 3 } },
    { atX: 3900, count: { min: 3, max: 4 } },
    { atX: 5400, count: { min: 2, max: 3 } },
    { atX: 6800, count: { min: 3, max: 4 } },
    { atX: 8400, count: { min: 2, max: 4 } },
    { atX: 10000, count: { min: 3, max: 4 } },
    { atX: 11500, count: { min: 2, max: 3 } },
    { atX: 13000, count: { min: 3, max: 4 } },
    { atX: 14800, count: { min: 2, max: 4 } },
    { atX: 16500, count: { min: 3, max: 4 } },
    { atX: 18200, count: { min: 2, max: 3 } },
  ],
  traps: [
    { xFrom: 3700, xTo: 4100, count: { min: 1, max: 1 } },
    { xFrom: 7200, xTo: 7500, count: { min: 1, max: 1 } },
    { xFrom: 10300, xTo: 10700, count: { min: 1, max: 2 } },
    { xFrom: 13900, xTo: 14300, count: { min: 1, max: 1 } },
    { xFrom: 16800, xTo: 17200, count: { min: 1, max: 2 } },
  ],
}

/** 第二关：更密——平台更高、坑更多、刷怪更密，仍卡在可达弧内。 */
export const STAGE_2: StageDef = {
  worldW: WORLD_W,
  heroStartX: HERO_START_X,
  flagX: FLAG_X,
  platforms: [
    { xFrom: 800, xTo: 1800, w: { min: 130, max: 180 }, h: { min: 80, max: 130 }, count: { min: 2, max: 3 }, gap: { min: 180, max: 220 } },
    { xFrom: 2400, xTo: 3400, w: { min: 120, max: 170 }, h: { min: 90, max: 150 }, count: { min: 3, max: 4 }, gap: { min: 170, max: 210 } },
    { xFrom: 4000, xTo: 5000, w: { min: 130, max: 180 }, h: { min: 100, max: 150 }, count: { min: 3, max: 4 }, gap: { min: 170, max: 215 } },
    { xFrom: 5800, xTo: 6900, w: { min: 120, max: 170 }, h: { min: 80, max: 140 }, count: { min: 3, max: 4 }, gap: { min: 175, max: 215 } },
    { xFrom: 7600, xTo: 8800, w: { min: 130, max: 180 }, h: { min: 90, max: 150 }, count: { min: 3, max: 5 }, gap: { min: 170, max: 210 } },
    { xFrom: 9400, xTo: 10600, w: { min: 130, max: 180 }, h: { min: 80, max: 140 }, count: { min: 3, max: 4 }, gap: { min: 175, max: 215 } },
    { xFrom: 11200, xTo: 12400, w: { min: 120, max: 170 }, h: { min: 90, max: 150 }, count: { min: 3, max: 5 }, gap: { min: 170, max: 210 } },
    { xFrom: 13000, xTo: 14200, w: { min: 130, max: 180 }, h: { min: 80, max: 140 }, count: { min: 3, max: 4 }, gap: { min: 175, max: 215 } },
    { xFrom: 14800, xTo: 16000, w: { min: 120, max: 170 }, h: { min: 90, max: 150 }, count: { min: 3, max: 5 }, gap: { min: 170, max: 210 } },
    { xFrom: 16600, xTo: 17900, w: { min: 140, max: 190 }, h: { min: 90, max: 140 }, count: { min: 2, max: 4 }, gap: { min: 180, max: 220 } },
  ],
  pits: [
    { xFrom: 1900, xTo: 2200, w: { min: 160, max: 210 }, realChance: 1 },
    { xFrom: 3500, xTo: 3800, w: { min: 150, max: 200 }, realChance: 1 },
    { xFrom: 5100, xTo: 5400, w: { min: 160, max: 200 }, realChance: 1 },
    { xFrom: 7000, xTo: 7300, w: { min: 150, max: 200 }, realChance: 1 },
    { xFrom: 8900, xTo: 9200, w: { min: 160, max: 210 }, realChance: 1 },
    { xFrom: 10700, xTo: 11000, w: { min: 150, max: 200 }, realChance: 1 },
    { xFrom: 12500, xTo: 12800, w: { min: 160, max: 210 }, realChance: 1 },
    { xFrom: 14300, xTo: 14600, w: { min: 150, max: 200 }, realChance: 1 },
    { xFrom: 17900, xTo: 18200, w: { min: 160, max: 210 }, realChance: 1 },
  ],
  pipes: [
    { xFrom: 1800, xTo: 1900, h: { min: 100, max: 140 }, count: { min: 1, max: 1 } },
    { xFrom: 5400, xTo: 5800, h: { min: 100, max: 140 }, count: { min: 1, max: 2 } },
    { xFrom: 9200, xTo: 9400, h: { min: 100, max: 140 }, count: { min: 1, max: 1 } },
    { xFrom: 12800, xTo: 13000, h: { min: 100, max: 140 }, count: { min: 1, max: 2 } },
    { xFrom: 16200, xTo: 16600, h: { min: 100, max: 140 }, count: { min: 1, max: 1 } },
  ],
  qBlocks: [
    { xFrom: 1000, xTo: 1300, h: { min: 115, max: 145 }, count: { min: 1, max: 2 }, reward: 'energy' },
    { xFrom: 3900, xTo: 4200, h: { min: 120, max: 150 }, count: { min: 1, max: 1 }, reward: 'coin' },
    { xFrom: 6400, xTo: 6800, h: { min: 115, max: 145 }, count: { min: 1, max: 2 }, reward: 'energy' },
    { xFrom: 9300, xTo: 9700, h: { min: 120, max: 150 }, count: { min: 1, max: 1 }, reward: 'coin' },
    { xFrom: 11400, xTo: 11800, h: { min: 115, max: 145 }, count: { min: 1, max: 2 }, reward: 'energy' },
    { xFrom: 13400, xTo: 13800, h: { min: 120, max: 150 }, count: { min: 1, max: 1 }, reward: 'coin' },
    { xFrom: 15200, xTo: 15600, h: { min: 115, max: 145 }, count: { min: 1, max: 2 }, reward: 'energy' },
    { xFrom: 17200, xTo: 17600, h: { min: 120, max: 150 }, count: { min: 1, max: 1 }, reward: 'coin' },
  ],
  spawns: [
    { atX: 1000, count: { min: 3, max: 4 } },
    { atX: 2500, count: { min: 2, max: 3 } },
    { atX: 4100, count: { min: 3, max: 4 } },
    { atX: 5500, count: { min: 3, max: 4 } },
    { atX: 7100, count: { min: 2, max: 4 } },
    { atX: 8500, count: { min: 3, max: 4 } },
    { atX: 9800, count: { min: 3, max: 5 } },
    { atX: 11300, count: { min: 2, max: 4 } },
    { atX: 12900, count: { min: 3, max: 4 } },
    { atX: 14700, count: { min: 3, max: 5 } },
    { atX: 16400, count: { min: 2, max: 4 } },
    { atX: 18300, count: { min: 3, max: 4 } },
  ],
  traps: [
    { xFrom: 2200, xTo: 2500, count: { min: 1, max: 1 } },
    { xFrom: 6000, xTo: 6400, count: { min: 1, max: 2 } },
    { xFrom: 8200, xTo: 8600, count: { min: 1, max: 1 } },
    { xFrom: 10200, xTo: 10600, count: { min: 1, max: 2 } },
    { xFrom: 13600, xTo: 14000, count: { min: 1, max: 1 } },
    { xFrom: 16800, xTo: 17200, count: { min: 1, max: 2 } },
  ],
}

/** 关卡轮转表：ArenaScene 用 level % STAGES.length 取一关。 */
export const STAGES: StageDef[] = [STAGE_1, STAGE_2]
