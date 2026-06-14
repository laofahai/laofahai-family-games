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
}

export const GAMES: GameMeta[] = [
  { id: 'undercover', name: '谁是卧底', desc: '适合 3 人起玩', status: 'hot', age: { min: 7, max: 99 }, audience: '全家' },
  { id: 'charades', name: '你来比划', desc: '手机贴额头，限时猜词', status: 'hot', age: { min: 5, max: 99 }, audience: '全家', hasDifficulty: true },
  { id: 'story', name: '编故事', desc: '抽关键词，限时编故事', status: 'hot', age: { min: 7, max: 99 }, audience: '全家' },
  { id: 'knowYou', name: '我知道你不知道', desc: '猜猜家人的小世界', status: 'hot', age: { min: 6, max: 99 }, audience: '全家' },
  { id: 'draw', name: '你画我猜', desc: '触屏作画，全家来猜', status: 'hot', age: { min: 5, max: 99 }, audience: '全家', hasDifficulty: true },
  { id: 'price', name: '猜价格', desc: '真实物价，最接近的赢', status: 'hot', age: { min: 8, max: 99 }, audience: '全家' },
  { id: 'shiliuTown', name: '闫顺儿小镇', desc: '读题破案，购物算钱', status: 'hot', age: { min: 6, max: 9 }, audience: '一二年级' },
  { id: 'yiyiBureau', name: '闫一依任务局', desc: '当策划队长，破任务闯关', status: 'hot', age: { min: 11, max: 13 }, audience: '小升初' },
  { id: 'truthLie', name: '两真一假', desc: '拆穿家人的小谎话', status: 'hot', age: { min: 8, max: 99 }, audience: '全家' },
  { id: 'dice', name: '骰子任务', desc: '掷骰子，抽任务全家做', status: 'hot', age: { min: 6, max: 99 }, audience: '全家' },
  { id: 'sound', name: '声音模仿', desc: '学个声音，大家来猜', status: 'hot', age: { min: 6, max: 99 }, audience: '全家' },
  { id: 'memory', name: '记忆翻牌', desc: '翻牌配对，考考记性', status: 'hot', age: { min: 5, max: 99 }, audience: '全家' },
]

export const ACTIVE_GAME_IDS = new Set(
  GAMES.filter((g) => g.status === 'hot').map((g) => g.id)
)
