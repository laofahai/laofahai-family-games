export type TownMode = 'detective' | 'shop' | 'vertical' | 'chinese' | 'mixed'

export type QuestionKind = 'detective' | 'shop' | 'spark' | 'vertical' | 'chinese' | 'wonder'

export interface Choice {
  id: string
  text: string
}

export interface BaseQuestion {
  id: string
  kind: QuestionKind
  title: string
  prompt: string
  hint: string
  answer: string
  answerChoices: Choice[]
  explanation: string
}

export interface DetectiveQuestion extends BaseQuestion {
  kind: 'detective'
  clues: Choice[]
  correctClueIds: string[]
  operationChoices: Choice[]
  operationAnswer: string
}

export interface Thing {
  name: string
  unit: string
  emoji?: string
}

export interface ShopItem {
  name: string
  price: number
  emoji: string
}

export interface ShopQuestion extends BaseQuestion {
  kind: 'shop'
  budget: number
  budgetLabel?: string
  items: ShopItem[]
  task: string
  focus: 'total' | 'change' | 'enough' | 'compare'
}

export interface SparkQuestion extends BaseQuestion {
  kind: 'spark'
  flavor: 'joke' | 'riddle' | 'sentence'
}

export interface VerticalQuestion extends BaseQuestion {
  kind: 'vertical'
  top: number
  bottom: number
  operator: '+' | '-'
}

// 语文卡 / 科普卡：简单选择题（卡池在 DB：shiliu-chinese / shiliu-wonder），题干口语、能朗读。
export interface ChineseQuestion extends BaseQuestion {
  kind: 'chinese'
  topic: string
}

export interface WonderQuestion extends BaseQuestion {
  kind: 'wonder'
  topic: string
}

export type TownQuestion =
  | DetectiveQuestion
  | ShopQuestion
  | SparkQuestion
  | VerticalQuestion
  | ChineseQuestion
  | WonderQuestion

export interface AnswerRecord {
  question: TownQuestion
  clueCorrect?: boolean
  operationCorrect?: boolean
  answerCorrect: boolean
  your?: string
}
