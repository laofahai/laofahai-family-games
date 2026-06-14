// 战斗题库（两个战斗游戏共用）：学习 + 好玩 各占一半（learnRatio 可调）。
// 内容**不硬编码**：运行时经 contentFor 优先读数据库（game_content 的 'battle-questions'），
// 读不到再回退到打包聚合的 RAW_QUESTIONS（离线/未配置照玩）。题库内容在数据库里维护。

import type { Band, BattleQuestion } from './core'
import { contentFor } from '@/platform/content'
import { RAW_QUESTIONS } from './banks'

export type { Band }

export const LEARN_KINDS = ['math', 'chinese', 'english', 'science', 'sports'] as const
export const FUN_KINDS = ['life', 'social', 'interest', 'funny'] as const

/** 题库（扁平数组）：DB 优先、回退打包聚合。绝不在模块顶层取（会被冻结成回退副本）。 */
function bank(): BattleQuestion[] {
  return contentFor<BattleQuestion>('battle-questions', RAW_QUESTIONS)
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
