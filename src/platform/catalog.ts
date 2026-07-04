// 全平台游戏目录：每个游戏一条，带适用年龄段。首页据此渲染与按年龄筛选。

import type { AgeRange } from './taxonomy'

export interface GameMeta {
  /** 同时作为首页路由的 screen key（soon 的没有路由） */
  id: string
  name: string
  desc: string
  status: 'hot' | 'soon'
  /** 适用年龄区间（岁） */
  age: AgeRange
  /** 一句话受众标签，显示在卡片上 */
  audience: string
  /** 内容是否支持难度分级 */
  hasDifficulty?: boolean
  /** 首页分区：main 是常用入口，more 是轻量/备用游戏 */
  homeSection?: 'main' | 'more'
  /** 是否有基于房号的远程模式 */
  supportsRoom?: boolean
  /** 归属人：只给这些玩家 id（+ 家长/管理员）看的「私人」游戏，如某个孩子的学习闯关。留空=人人可见 */
  owner?: string[]
}

export const GAMES: GameMeta[] = [
  { id: 'charades', name: '你来比划', desc: '手机贴额头，限时猜词', status: 'hot', age: { min: 5, max: 99 }, audience: '全家', hasDifficulty: true, supportsRoom: true },
  { id: 'draw', name: '你画我猜', desc: '触屏作画，全家来猜', status: 'hot', age: { min: 5, max: 99 }, audience: '全家', hasDifficulty: true, supportsRoom: true },
  { id: 'undercover', name: '谁是卧底', desc: '适合 3 人起玩', status: 'hot', age: { min: 7, max: 99 }, audience: '全家', supportsRoom: true },
  { id: 'knowYou', name: '我知道你不知道', desc: '猜猜家人的小世界', status: 'hot', age: { min: 6, max: 99 }, audience: '全家', supportsRoom: true },
  { id: 'price', name: '猜价格', desc: '真实物价，最接近的赢', status: 'hot', age: { min: 8, max: 99 }, audience: '全家', supportsRoom: true },
]

export const ACTIVE_GAME_IDS = new Set(
  GAMES.filter((g) => g.status === 'hot').map((g) => g.id)
)

export function gameSections(source: readonly GameMeta[] = GAMES): { main: GameMeta[]; more: GameMeta[] } {
  return {
    main: source.filter((game) => game.homeSection !== 'more'),
    more: source.filter((game) => game.homeSection === 'more'),
  }
}
