export type Difficulty = 'easy' | 'medium' | 'hard'

export interface WordEntry {
  text: string
  difficulty: Difficulty
}

export type Duration = 60 | 90 | 120 | 180

export type Stage = 'intro' | 'setup' | 'countdown' | 'playing' | 'result'

export type Outcome = 'correct' | 'pass'

export interface RoundResult {
  word: WordEntry
  outcome: Outcome
}

export interface SessionConfig {
  difficulties: Set<Difficulty>
  durationSec: Duration
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}
