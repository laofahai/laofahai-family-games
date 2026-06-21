import { c, pick, rand, shuffle } from '@/games/shared/question-utils'
import { contentFor } from '@/platform/content'
import { pickUnseen } from '@/platform/progress'

import type { BureauQuestion, Choice } from '../types'

export { c, pick, rand, shuffle }

export type Maker = (id: number) => BureauQuestion

// 固定卡池的稳定 key：优先用不随机插名的字段（right / fact / odd），
// 避免用带 ${同学名} 插值的 text，保证「玩过的卡」跨局能稳定去重。
export function cardKey(card: unknown): string {
  const o = card as Record<string, unknown>
  return String(o.right ?? o.fact ?? o.odd ?? o.text ?? JSON.stringify(card))
}

// 从固定卡池里挑一张「优先没出过」的；池子出完自动回收。
export function freshPick<T>(scope: string, cards: readonly T[]): T {
  return pickUnseen(`yiyi:${scope}`, cards, cardKey, 1)[0] ?? cards[0]
}

export function mate(): string {
  return pick(contentFor<string>('roster-yiyi', []))
}

export function twoMates(): [string, string] {
  const [a, b] = shuffle(contentFor<string>('roster-yiyi', []))
  return [a, b]
}

// 优先使用精心设计的「踩坑」干扰项；不足或碰撞时再补足到 3 个。
export function numChoices(answer: number, unit: string, wrongs: number[]): { choices: Choice[]; answer: string } {
  const values = new Set<number>([answer])
  for (const w of wrongs) {
    if (values.size >= 3) break
    if (w !== answer && Number.isFinite(w)) values.add(w)
  }
  let bump = 1
  while (values.size < 3) {
    const filler = answer + bump * (bump % 2 === 0 ? -2 : 3)
    if (filler > 0) values.add(filler)
    bump += 1
  }
  return {
    choices: shuffle([...values]).map((v) => c(String(v), `${v}${unit}`)),
    answer: String(answer),
  }
}

export function textChoices(correct: string, wrongs: string[]): { choices: Choice[]; answer: string } {
  const seen = new Set<string>([correct])
  const picked: string[] = []
  for (const w of wrongs) {
    if (picked.length >= 2) break
    if (!seen.has(w)) {
      seen.add(w)
      picked.push(w)
    }
  }
  return { choices: shuffle([correct, ...picked]).map((text) => c(text, text)), answer: correct }
}

export const WEEK = ['一', '二', '三', '四', '五']

// 同学引入语：让卡片像班上有人在抛话题，更有代入感。
export const CARD_INTROS = [
  (s: string) => `${s}神秘兮兮地凑过来——`,
  (s: string) => `${s}举手抢答：`,
  (s: string) => `${s}突然发问：`,
  (s: string) => `情报站：${s}带回一条——`,
  (s: string) => `${s}托腮想了想：`,
]

export function withWho(scenario: string | undefined): string {
  if (scenario && scenario.trim().length > 0) return scenario
  return pick(CARD_INTROS)(mate())
}

export const SPARK_INTROS = [
  (s: string, f: string) => `${s}拍着胸脯保证：${f}`,
  (s: string, f: string) => `${s}压低声音说：${f}`,
  (s: string, f: string) => `茶水间情报站：${f}（消息来自 ${s}）`,
  (s: string, f: string) => `${s}赌一包辣条：${f}`,
  (s: string, f: string) => `${s}神秘兮兮地凑过来：${f}`,
]
