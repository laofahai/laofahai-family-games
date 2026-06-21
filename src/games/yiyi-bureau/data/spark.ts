import { contentFor } from '@/platform/content'

import type { SparkFunCard, SparkTrueFalse } from '../types'
import { freshPick, pick, SPARK_INTROS, textChoices, twoMates, type Maker } from './_shared'

// ===========================================================================
// 茶水间（穿插小卡，不计分）
// ===========================================================================

export const sparkQuestion: Maker = (id) => {
  const [a, b] = twoMates()
  if (Math.random() < 0.6) {
    const card = freshPick('spark-tf', contentFor<SparkTrueFalse>('yiyi-truefalse', []))
    const intro = pick(SPARK_INTROS)
    const right = card.real ? '真的' : '假的'
    const built = textChoices(right, [card.real ? '假的' : '真的', card.joke])
    return {
      id: `spark-${id}`,
      kind: 'spark',
      badge: '茶水间 · 真的假的',
      title: '真的假的',
      scenario: intro(a, card.fact),
      prompt: '这是真的，还是假的？',
      ...built,
      hint: '茶水间小卡不计分，大胆猜。',
      explanation: card.why,
    }
  }
  const card = freshPick('spark-fun', contentFor<SparkFunCard>('yiyi-funcards', []))
  const built = textChoices(card.right, card.wrongs)
  return {
    id: `spark-${id}`,
    kind: 'spark',
    badge: '茶水间',
    title: card.title,
    scenario: card.scenario ?? (Math.random() < 0.5 ? `${a}突然发问——` : `${b}举手抢答——`),
    prompt: card.prompt,
    ...built,
    hint: '茶水间小卡不计分，放松一下。',
    explanation: card.why,
  }
}
