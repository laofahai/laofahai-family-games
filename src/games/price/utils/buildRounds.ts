import { contentFor } from '@/platform/content'
import { pickUnseen } from '@/platform/progress'
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
  // 运行时（开局构建本局回合）读取云端/缓存内容，拿不到回退到打包副本。
  const items = contentFor('price', priceItems)
  const pool = items.filter((item) => categories.has(item.category))
  const source = pool.length >= count ? pool : items
  // 先 shuffle 提供随机性，再用 pickUnseen 优先挑近期没猜过的商品（整库用过一轮后自动回收）。
  // name 唯一区分一件商品，作为稳定 id。
  return pickUnseen('price', shuffle(source), (item) => item.name, count)
}
