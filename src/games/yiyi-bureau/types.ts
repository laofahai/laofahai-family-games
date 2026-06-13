import type { Choice } from '@/games/shiliu-town/types'

export type { Choice }

export type BureauMode = 'planner' | 'archive' | 'preview' | 'mixed'

export type BureauKind = 'math' | 'chinese' | 'english' | 'science' | 'spark'

export interface BureauQuestion {
  id: string
  kind: BureauKind
  badge: string
  title: string
  scenario?: string
  prompt: string
  choices: Choice[]
  answer: string
  hint: string
  explanation: string
}

export interface BureauRecord {
  question: BureauQuestion
  correct: boolean
}
