import { contentFor } from '@/platform/content'
import { pickUnseen } from '@/platform/progress'
import type { TruthTopic } from '../types'
import { truthTopics } from '../data/truth-topics'

// 话题文本唯一且稳定，用作「已见库」的 id。
const topicId = (topic: TruthTopic): string => topic.text

function shuffle<T>(items: readonly T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

/**
 * 给主角抽一个话题提示。优先从「没用过」的里挑（shuffle 后取第一个没见过的并自动标记），
 * 一轮全用过才回收，使近期用过的话题不再重复。scope 固定 'truth-lie'。
 * exclude：当前话题，换一个时排除它，避免抽到同一个。
 */
export function pickTopic(exclude?: TruthTopic): TruthTopic {
  const topics = contentFor('truth-lie', truthTopics)
  const pool = exclude ? topics.filter((t) => t !== exclude) : topics
  const [picked] = pickUnseen('truth-lie', shuffle(pool), topicId, 1)
  return picked
}
