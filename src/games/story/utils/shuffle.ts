import { pickUnseen } from '@/platform/progress'
import type { Category, StoryCard, Theme } from '../types'

export function shuffle<T>(items: readonly T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

// 卡片文本本身唯一且稳定，用作「已见库」的 id。
const cardId = (card: StoryCard): string => card.text

// 优先从没抽过的里挑一张（shuffle 后取第一个「没见过」的并自动标记），
// 一类卡全抽过一轮才回收。每个类别用独立 scope，互不影响。
function pickUnseenFrom(category: Category, candidates: readonly StoryCard[]): StoryCard | undefined {
  const [picked] = pickUnseen(`story:${category}`, shuffle(candidates), cardId, 1)
  return picked
}

/**
 * 从选定主题里抽一组关键词卡。
 * 始终包含：1 人物 + 1 地点 + 1 物品。
 * 4 张时再加 1 转折；5 张时再追加一张随机类别（人物/物品/转折）。
 * 抽不到对应类别时降级用任意主题补足。
 * 抽过的关键词卡（按类别）短期内不再出现，全用过一轮才回收。
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
    if (filtered.length > 0) return pickUnseenFrom(category, filtered)
    return pickUnseenFrom(category, allCards.filter((c) => c.category === category && !exclude.has(c)))
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
