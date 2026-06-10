export type PlayerId = 'dad' | 'mom' | 'bigSis' | 'lilSis'

export interface PlayerInfo {
  id: PlayerId
  name: string
  emoji: string
}

export const PLAYERS: PlayerInfo[] = [
  { id: 'dad', name: '爸爸', emoji: '👨‍💻' },
  { id: 'mom', name: '妈妈', emoji: '🛍️' },
  { id: 'bigSis', name: '姐姐', emoji: '🎤' },
  { id: 'lilSis', name: '妹妹', emoji: '🎀' },
]

export const PLAYER_MAP: Record<PlayerId, PlayerInfo> = Object.fromEntries(
  PLAYERS.map((p) => [p.id, p])
) as Record<PlayerId, PlayerInfo>

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
