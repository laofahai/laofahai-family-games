import { describe, it, expect, vi } from 'vitest'
import type { BattleQuestion, Band } from './core'

// questions.ts 从 @/platform/content 的 contentFor('battle-questions', []) 读题。
// 把 contentFor 打桩成返回一个固定的小题库（两个 band、多 subject、learn 类与 fun 类都有），
// 这样既不碰云端/localStorage，又能验证抽题逻辑。

// LEARN_KINDS = math/chinese/english/science/sports；FUN_KINDS = life/social/interest/funny
function makeQuestion(id: string, subject: string, band: Band): BattleQuestion {
  return {
    id,
    subject,
    band,
    prompt: `Q-${id}`,
    choices: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ],
    answer: 'a',
  }
}

const LEARN = ['math', 'chinese', 'english', 'science', 'sports']
const FUN = ['life', 'social', 'interest', 'funny']

/** 造一个足够大的桩题库：每个 band、每个 subject 各 N 题。 */
function buildBank(n: number): BattleQuestion[] {
  const out: BattleQuestion[] = []
  for (const band of ['low', 'high'] as Band[]) {
    for (const subject of [...LEARN, ...FUN]) {
      for (let i = 0; i < n; i++) {
        out.push(makeQuestion(`${band}-${subject}-${i}`, subject, band))
      }
    }
  }
  return out
}

const BANK = buildBank(40)

vi.mock('@/platform/content', () => ({
  contentFor: <T>(key: string, fallback: readonly T[]): T[] =>
    key === 'battle-questions' ? (BANK as unknown as T[]) : (fallback as T[]),
}))

// mock 之后再导入被测模块
const { drawQuestions, drawBySubject } = await import('./questions')

describe('drawQuestions', () => {
  it('返回数量 ≤ count', () => {
    const r = drawQuestions({ band: 'low', count: 10 })
    expect(r.length).toBeLessThanOrEqual(10)
    expect(r.length).toBe(10) // 桩题库足够大，应取满
  })

  it('count 大于库存时不超量、不报错', () => {
    const r = drawQuestions({ band: 'low', count: 100000 })
    expect(r.length).toBeLessThanOrEqual(BANK.filter((q) => q.band === 'low').length)
  })

  it('band 过滤：只返回该 band 的题', () => {
    for (const band of ['low', 'high'] as Band[]) {
      const r = drawQuestions({ band, count: 50 })
      expect(r.length).toBeGreaterThan(0)
      expect(r.every((q) => q.band === band)).toBe(true)
    }
  })

  it('指定 kinds 时只含这些 subject', () => {
    const kinds = ['math', 'english']
    const r = drawQuestions({ band: 'high', count: 30, kinds })
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((q) => kinds.includes(q.subject))).toBe(true)
  })

  it('learnRatio 控制学习题占比（大样本验证大致比例）', () => {
    const count = 100
    const r = drawQuestions({ band: 'low', count, learnRatio: 0.7 })
    expect(r.length).toBe(count)
    const learnN = r.filter((q) => LEARN.includes(q.subject)).length
    // round(100 * 0.7) = 70 学习题
    expect(learnN).toBe(70)
    const funN = r.filter((q) => FUN.includes(q.subject)).length
    expect(funN).toBe(30)
  })

  it('learnRatio=0 时几乎全是好玩题；=1 时几乎全是学习题', () => {
    const all = drawQuestions({ band: 'low', count: 50, learnRatio: 1 })
    expect(all.every((q) => LEARN.includes(q.subject))).toBe(true)
    const none = drawQuestions({ band: 'low', count: 50, learnRatio: 0 })
    expect(none.every((q) => FUN.includes(q.subject))).toBe(true)
  })

  it('返回的题不重复（同一抽内）', () => {
    const r = drawQuestions({ band: 'high', count: 30 })
    const ids = new Set(r.map((q) => q.id))
    expect(ids.size).toBe(r.length)
  })
})

describe('drawBySubject', () => {
  it('只返回该 subject 且该 band 的题', () => {
    const r = drawBySubject('math', 'low', 20)
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((q) => q.subject === 'math' && q.band === 'low')).toBe(true)
  })

  it('不串 band：high band 抽 science 不含 low 的题', () => {
    const r = drawBySubject('science', 'high', 20)
    expect(r.every((q) => q.subject === 'science' && q.band === 'high')).toBe(true)
  })

  it('count 限制生效', () => {
    const r = drawBySubject('chinese', 'low', 5)
    expect(r.length).toBe(5)
  })
})
