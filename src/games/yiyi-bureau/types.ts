import type { Choice } from '@/games/shiliu-town/types'

export type { Choice }

export type BureauMode = 'planner' | 'archive' | 'preview' | 'mixed' | 'challenge'

export type BureauKind = 'math' | 'chinese' | 'english' | 'science' | 'chem' | 'insight' | 'spark'

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

// 化学引导卡（卡池 yiyi-chem 在 DB）：从生活现象切入，重在把「为什么」讲清楚。
export interface ChemCard {
  topic: string // 小类：金属生锈 / 溶解 / 燃烧 / 酸碱 / 气体…
  level: 'primary' | 'middle' // primary=小学常识打底，middle=初中概念
  title: string
  scenario?: string
  prompt: string
  right: string
  wrongs: [string, string]
  why: string
}

// 见识卡（卡池 yiyi-insight 在 DB）：只在「见识型」知识上跳级——高中见识 / 大学趣味科普 / 前沿与人生。
export interface InsightCard {
  subject: string // 历史 / 地理 / 生物 / 天文 / 经济 / 心理 / 前沿科技 / 人生智慧…
  level: 'high' | 'college' | 'frontier'
  title: string
  scenario?: string
  prompt: string
  right: string
  wrongs: [string, string]
  why: string
}
