import type { Category, StoryCard, Theme } from '../types'

export function shuffle<T>(items: readonly T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function pickOne<T>(items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined
  return items[Math.floor(Math.random() * items.length)]
}

/**
 * 从选定主题里抽一组关键词卡。
 * 始终包含：1 人物 + 1 地点 + 1 物品。
 * 4 张时再加 1 转折；5 张时再追加一张随机类别（人物/物品/转折）。
 * 抽不到对应类别时降级用任意主题补足。
 */
export function drawCards(
  allCards: readonly StoryCard[],
  themes: ReadonlySet<Theme>,
  count: 3 | 4 | 5,
): StoryCard[] {
  const themed = allCards.filter((c) => themes.has(c.theme))
  const pool = themed.length > 0 ? themed : allCards

  function fromCategory(category: Category, exclude: ReadonlySet<StoryCard>): StoryCard | undefined {
    const filtered = pool.filter((c) => c.category === category && !exclude.has(c))
    return pickOne(filtered) ?? pickOne(allCards.filter((c) => c.category === category && !exclude.has(c)))
  }

  const used = new Set<StoryCard>()
  const result: StoryCard[] = []

  const order: Category[] = ['character', 'place', 'item']
  if (count >= 4) order.push('twist')
  if (count >= 5) {
    const extras: Category[] = ['character', 'item', 'twist']
    order.push(extras[Math.floor(Math.random() * extras.length)])
  }

  for (const cat of order) {
    const card = fromCategory(cat, used)
    if (card) {
      used.add(card)
      result.push(card)
    }
  }

  return shuffle(result)
}
