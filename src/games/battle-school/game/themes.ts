// 场景主题（biome）：程序化画背景的配色与装饰种类，外加天气类型。
// 多种生物群系（操场/森林/沙漠/雪原/夜晚/黄昏/雨/草地），每关随机选一种，让画面有变化。
// 这里只是数据 + 画法描述；实际绘制在 ArenaScene.buildBackground 里用 Graphics 完成。

export type DecoKind = 'tree' | 'cactus' | 'pine' | 'building' | 'hill' | 'lamp'
export type Weather = 'none' | 'rain' | 'snow'

export interface Theme {
  name: string // 给 HUD 显示
  skyTop: number
  skyBottom: number
  ground: number
  groundLine: number
  decoFar: number // 远景剪影色
  decoNear: number // 近景装饰色
  deco: DecoKind
  weather: Weather
  night: boolean // 夜晚：叠暗色 + 星星/月亮
  cloud: number // 云/雾的颜色（0=不画）
}

export const THEMES: Theme[] = [
  // 操场（晴）
  { name: '操场', skyTop: 0x8fd0ff, skyBottom: 0xeaf6ff, ground: 0xd7c4a3, groundLine: 0xb89b6e, decoFar: 0x7fb0d8, decoNear: 0x9fd6a0, deco: 'building', weather: 'none', night: false, cloud: 0xffffff },
  // 森林（草地）
  { name: '森林', skyTop: 0x9fe0c0, skyBottom: 0xeefcf2, ground: 0x6f9b54, groundLine: 0x4f7a3a, decoFar: 0x4f9e72, decoNear: 0x2f7d4f, deco: 'pine', weather: 'none', night: false, cloud: 0xffffff },
  // 沙漠
  { name: '沙漠', skyTop: 0xffd98a, skyBottom: 0xfff3d6, ground: 0xe6c48a, groundLine: 0xc7a35e, decoFar: 0xe0b56a, decoNear: 0x4f9e72, deco: 'cactus', weather: 'none', night: false, cloud: 0xfff0c8 },
  // 雪原
  { name: '雪原', skyTop: 0xbfd7ee, skyBottom: 0xf3f9ff, ground: 0xeef4fb, groundLine: 0xc6d4e6, decoFar: 0x9fb6d2, decoNear: 0xdfeaf6, deco: 'pine', weather: 'snow', night: false, cloud: 0xffffff },
  // 夜晚
  { name: '夜晚', skyTop: 0x141a36, skyBottom: 0x2a2f57, ground: 0x33344f, groundLine: 0x55567a, decoFar: 0x1f2240, decoNear: 0x3a3d64, deco: 'building', weather: 'none', night: true, cloud: 0 },
  // 黄昏
  { name: '黄昏', skyTop: 0xff9e6a, skyBottom: 0xffd9a8, ground: 0xb98f6a, groundLine: 0x946f50, decoFar: 0xc77a52, decoNear: 0x7d5a3e, deco: 'hill', weather: 'none', night: false, cloud: 0xffd0a0 },
  // 雨天
  { name: '雨天', skyTop: 0x6f7d92, skyBottom: 0xb8c4d4, ground: 0x6e7560, groundLine: 0x515845, decoFar: 0x5a6678, decoNear: 0x3f4636, deco: 'tree', weather: 'rain', night: false, cloud: 0xcfd8e4 },
  // 草地（晴）
  { name: '草地', skyTop: 0x88d8ff, skyBottom: 0xe8faff, ground: 0x7fbf5f, groundLine: 0x5f9e42, decoFar: 0x6fc090, decoNear: 0x3f8f5a, deco: 'tree', weather: 'none', night: false, cloud: 0xffffff },
]

/** 按关卡序号选主题（错开取，相邻关不同 biome）。 */
export function themeForLevel(level: number): Theme {
  return THEMES[(level * 3 + 1) % THEMES.length]
}
