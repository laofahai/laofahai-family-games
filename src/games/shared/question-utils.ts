import type { Choice } from '@/games/shiliu-town/types'

export const c = (id: string, text: string): Choice => ({ id, text })

export function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function pick<T>(items: readonly T[]): T {
  return items[rand(0, items.length - 1)]
}

export function shuffle<T>(items: readonly T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = rand(0, i)
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function uniqueNumbers(answer: number, min: number, max: number, preferred: number[] = []): number[] {
  const values = new Set<number>([answer])
  for (const value of preferred) {
    if (value >= min && value <= max && value !== answer) values.add(value)
    if (values.size >= 3) break
  }
  while (values.size < 3) {
    const offset = pick([-4, -3, -2, -1, 1, 2, 3, 4])
    const next = Math.min(max, Math.max(min, answer + offset))
    if (next !== answer) values.add(next)
  }
  return shuffle([...values])
}

export function numberChoices(answer: number, unit: string, min = 0, max = 40, preferred: number[] = []): Choice[] {
  return uniqueNumbers(answer, min, max, preferred).map((value) => c(String(value), `${value} ${unit}`))
}

export function toJiao(yuan: number): number {
  return Math.round(yuan * 10)
}

export function fromJiao(jiao: number): number {
  return jiao / 10
}

export function formatMoney(yuan: number): string {
  const jiao = toJiao(yuan)
  const yuanPart = Math.floor(jiao / 10)
  const jiaoPart = jiao % 10
  if (jiaoPart === 0) return `${yuanPart}元`
  if (yuanPart === 0) return `${jiaoPart}角`
  return `${yuanPart}元${jiaoPart}角`
}

export function moneyExpr(left: number, operator: '+' | '-', right: number, answer: number): string {
  return `${formatMoney(left)} ${operator} ${formatMoney(right)} = ${formatMoney(answer)}`
}

export function moneyChoices(answer: number, preferred: number[] = []): Choice[] {
  const answerJiao = toJiao(answer)
  const preferredJiao = preferred.map(toJiao)
  const values = new Set<number>([answerJiao])
  for (const value of preferredJiao) {
    if (value >= 0 && value <= 600 && value !== answerJiao) values.add(value)
    if (values.size >= 3) break
  }
  while (values.size < 3) {
    const offset = pick([-20, -15, -10, -5, 5, 10, 15, 20])
    const next = Math.min(600, Math.max(0, answerJiao + offset))
    if (next !== answerJiao) values.add(next)
  }
  return shuffle([...values]).map((jiao) => c(String(fromJiao(jiao)), formatMoney(fromJiao(jiao))))
}

export function operationChoices(answerId: string, correctText: string, wrongTexts: string[]): Choice[] {
  return shuffle([c(answerId, correctText), ...wrongTexts.map((text, idx) => c(`wrong-${idx}`, text))])
}
