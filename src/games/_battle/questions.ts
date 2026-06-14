// 战斗题库（两个战斗游戏共用）：学习 + 好玩 各占一半（learnRatio 可调）。
// 内容**只在数据库**：运行时经 contentFor 读 game_content 的 'battle-questions'，
// 首次联网拉取后缓存到 localStorage（之后离线走缓存）。**不打包兜底**——题库文件
// （banks/）只作灌库种子，不进运行包。未拉到内容时抽不出题，由调用方显示「加载中」。

import type { Band, BattleQuestion } from './core'
import { contentFor } from '@/platform/content'

export type { Band }

export const LEARN_KINDS = ['math', 'chinese', 'english', 'science', 'sports'] as const
export const FUN_KINDS = ['life', 'social', 'interest', 'funny'] as const

/** 题库（扁平数组）：只读数据库（contentFor 经 localStorage 缓存）。未拉到则为空，调用方显示「加载中」。绝不在模块顶层取。 */
function bank(): BattleQuestion[] {
  return contentFor<BattleQuestion>('battle-questions', [])
}

function byBand(band: Band): BattleQuestion[] {
  return bank().filter((q) => q.band === band)
}

function shuffle<T>(a: readonly T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

/**
 * 抽一批混合题。
 * @param band 年龄段
 * @param count 题数
 * @param kinds 限定类别（默认全部）
 * @param learnRatio 学习题占比（0-1，默认 0.5 = 一半一半）
 */
export function drawQuestions(opts: {
  band: Band
  count: number
  kinds?: readonly string[]
  learnRatio?: number
}): BattleQuestion[] {
  const all = byBand(opts.band)
  const allow = opts.kinds ? all.filter((q) => opts.kinds!.includes(q.subject)) : all
  if (opts.kinds || opts.learnRatio == null) return shuffle(allow).slice(0, opts.count)
  // 按比例混学习/好玩
  const learn = shuffle(allow.filter((q) => (LEARN_KINDS as readonly string[]).includes(q.subject)))
  const fun = shuffle(allow.filter((q) => (FUN_KINDS as readonly string[]).includes(q.subject)))
  const nLearn = Math.round(opts.count * opts.learnRatio)
  const picked = [...learn.slice(0, nLearn), ...fun.slice(0, opts.count - nLearn)]
  return shuffle(picked).slice(0, opts.count)
}

/** 单一学科抽题（打老师 Boss 用）。 */
export function drawBySubject(subject: string, band: Band, count: number): BattleQuestion[] {
  return shuffle(byBand(band).filter((q) => q.subject === subject)).slice(0, count)
}
