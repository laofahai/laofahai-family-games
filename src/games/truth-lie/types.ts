import { getPlayers } from '@/platform/players'

// 玩家 id 改为 string：玩家来自平台共享名单（家人 + 任意添加的朋友/其他人）。
export type PlayerId = string

export interface PlayerInfo {
  id: PlayerId
  name: string
  emoji: string
}

/** 按 id 取玩家显示信息（实时读平台名单，找不到给个兜底） */
export function infoOf(id: PlayerId): PlayerInfo {
  const p = getPlayers().find((x) => x.id === id)
  if (p) return { id: p.id, name: p.name, emoji: p.emoji }
  return { id, name: id, emoji: '🙂' }
}

export type TopicCategory =
  | 'childhood'
  | 'schoolWork'
  | 'food'
  | 'fun'
  | 'embarrassing'
  | 'secret'

export const TOPIC_LABEL: Record<TopicCategory, string> = {
  childhood: '童年回忆',
  schoolWork: '学校与工作',
  food: '吃吃喝喝',
  fun: '玩乐爱好',
  embarrassing: '糗事现场',
  secret: '小心思',
}

export interface TruthTopic {
  text: string
  category: TopicCategory
  emoji: string
}

export type StatementIndex = 1 | 2 | 3

export type Stage = 'intro' | 'setup' | 'tell' | 'vote' | 'reveal' | 'result'

export type RoundsPerPlayer = 1 | 2

export interface RoundRecord {
  teller: PlayerId
  lieIndex: StatementIndex
  votes: Partial<Record<PlayerId, StatementIndex>>
}

/** 投中假话的人 +1；主角每骗过一个人 +1 */
export function scoreRound(record: RoundRecord): Partial<Record<PlayerId, number>> {
  const scores: Partial<Record<PlayerId, number>> = {}
  let fooled = 0
  for (const [voter, vote] of Object.entries(record.votes) as [PlayerId, StatementIndex][]) {
    if (vote === record.lieIndex) {
      scores[voter] = (scores[voter] ?? 0) + 1
    } else {
      fooled += 1
    }
  }
  if (fooled > 0) {
    scores[record.teller] = (scores[record.teller] ?? 0) + fooled
  }
  return scores
}

export function totalScores(history: RoundRecord[]): Partial<Record<PlayerId, number>> {
  const total: Partial<Record<PlayerId, number>> = {}
  for (const record of history) {
    for (const [player, pts] of Object.entries(scoreRound(record)) as [PlayerId, number][]) {
      total[player] = (total[player] ?? 0) + pts
    }
  }
  return total
}
