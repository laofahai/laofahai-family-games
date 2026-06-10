import type { PriceCategory, PriceItem } from '../types'
import { priceItems } from './../data/price-items'

function shuffle<T>(items: readonly T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function buildRounds(categories: ReadonlySet<PriceCategory>, count: number): PriceItem[] {
  const pool = priceItems.filter((item) => categories.has(item.category))
  const source = pool.length >= count ? pool : priceItems
  return shuffle(source).slice(0, count)
}
