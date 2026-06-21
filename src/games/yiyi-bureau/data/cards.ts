import { contentFor } from '@/platform/content'

import type { ChemCard, InsightCard } from '../types'
import { freshPick, textChoices, withWho, type Maker } from './_shared'

// ===========================================================================
// 化学引导卡 / 见识卡：卡池在 DB（yiyi-chem / yiyi-insight），随机插同学名增代入感。
// ===========================================================================

export const chemReady = () => contentFor<ChemCard>('yiyi-chem', []).length > 0
export const insightReady = () => contentFor<InsightCard>('yiyi-insight', []).length > 0

// 化学引导题：从生活现象切入，重在把「为什么」讲清楚（解析 = card.why）。
export const chemQuestion: Maker = (id) => {
  const card = freshPick('chem', contentFor<ChemCard>('yiyi-chem', []))
  const built = textChoices(card.right, card.wrongs)
  return {
    id: `chem-${id}`,
    kind: 'chem',
    badge: `化学实验室 · ${card.topic}`,
    title: card.title,
    scenario: withWho(card.scenario),
    prompt: card.prompt,
    ...built,
    hint: '从现象想原理，别死记。',
    explanation: card.why,
  }
}

// 见识题：只在「见识型」知识上跳级——高中见识 / 大学科普 / 前沿与人生。
export const insightQuestion: Maker = (id) => {
  const card = freshPick('insight', contentFor<InsightCard>('yiyi-insight', []))
  const built = textChoices(card.right, card.wrongs)
  const badge =
    card.level === 'frontier'
      ? `前沿视野 · ${card.subject}`
      : card.level === 'college'
        ? `大学脑洞 · ${card.subject}`
        : `高中见识 · ${card.subject}`
  return {
    id: `insight-${id}`,
    kind: 'insight',
    badge,
    title: card.title,
    scenario: withWho(card.scenario),
    prompt: card.prompt,
    ...built,
    hint: '靠理解，不靠背。',
    explanation: card.why,
  }
}
