import type { TruthTopic } from '../types'
import { truthTopics } from '../data/truth-topics'

export function pickTopic(exclude?: TruthTopic): TruthTopic {
  const pool = exclude ? truthTopics.filter((t) => t !== exclude) : truthTopics
  return pool[Math.floor(Math.random() * pool.length)]
}
