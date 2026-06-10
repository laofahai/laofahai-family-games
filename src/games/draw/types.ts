export type DrawDifficulty = 'easy' | 'medium' | 'hard'

export interface DrawWord {
  text: string
  /** 给猜的人的类别提示，如「动物」「成语」 */
  hint: string
  difficulty: DrawDifficulty
}

export const DIFFICULTY_LABEL: Record<DrawDifficulty, string> = {
  easy: '简单 · 妹妹也能画',
  medium: '中等',
  hard: '困难 · 成语热词',
}

export type Duration = 60 | 90 | 120

export type Stage = 'intro' | 'setup' | 'preview' | 'drawing' | 'roundEnd' | 'result'

export type RoundOutcome = 'guessed' | 'giveup' | 'timeout'

export interface RoundRecord {
  word: DrawWord
  outcome: RoundOutcome
}
