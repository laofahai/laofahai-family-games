// 题库聚合：把 18 个分片（9 类 × 2 年龄段）合成 RAW_QUESTIONS。
// 纯数据模块（只用相对/类型导入），可被 seed 脚本直接 import → 灌进数据库。
// 运行时由 ../questions.ts 经 contentFor 优先读云端、回退到这份。

import type { Band, BattleQuestion } from '../core'

import { items as mathLow } from './q-math-low'
import { items as mathHigh } from './q-math-high'
import { items as chineseLow } from './q-chinese-low'
import { items as chineseHigh } from './q-chinese-high'
import { items as englishLow } from './q-english-low'
import { items as englishHigh } from './q-english-high'
import { items as scienceLow } from './q-science-low'
import { items as scienceHigh } from './q-science-high'
import { items as sportsLow } from './q-sports-low'
import { items as sportsHigh } from './q-sports-high'
import { items as lifeLow } from './q-life-low'
import { items as lifeHigh } from './q-life-high'
import { items as socialLow } from './q-social-low'
import { items as socialHigh } from './q-social-high'
import { items as interestLow } from './q-interest-low'
import { items as interestHigh } from './q-interest-high'
import { items as funnyLow } from './q-funny-low'
import { items as funnyHigh } from './q-funny-high'

function tag(band: Band, arr: BattleQuestion[]): BattleQuestion[] {
  return arr.map((q) => ({ ...q, band }))
}

// 扁平数组（每题带 band）：contentFor 只吃数组，这样也能整库进数据库 + 离线回退。
export const RAW_QUESTIONS: BattleQuestion[] = [
  ...tag('low', mathLow),
  ...tag('low', chineseLow),
  ...tag('low', englishLow),
  ...tag('low', scienceLow),
  ...tag('low', sportsLow),
  ...tag('low', lifeLow),
  ...tag('low', socialLow),
  ...tag('low', interestLow),
  ...tag('low', funnyLow),
  ...tag('high', mathHigh),
  ...tag('high', chineseHigh),
  ...tag('high', englishHigh),
  ...tag('high', scienceHigh),
  ...tag('high', sportsHigh),
  ...tag('high', lifeHigh),
  ...tag('high', socialHigh),
  ...tag('high', interestHigh),
  ...tag('high', funnyHigh),
]
