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
  your?: string
}

// 茶水间「真的假的」卡：fact 是事实，real=true 表示「真的」，joke 是搞笑的第三个选项。
export interface SparkTrueFalse {
  fact: string
  real: boolean
  why: string
  joke: string
}

// 茶水间「脑筋急转弯 / 吐槽 / 冷知识」卡。
export interface SparkFunCard {
  title: string
  scenario?: string
  prompt: string
  right: string
  wrongs: [string, string]
  why: string
}
