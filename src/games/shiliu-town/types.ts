export type TownMode = 'detective' | 'shop' | 'vertical' | 'mixed'

export type QuestionKind = 'detective' | 'shop' | 'spark' | 'vertical'

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

export type TownQuestion = DetectiveQuestion | ShopQuestion | SparkQuestion | VerticalQuestion

export interface AnswerRecord {
  question: TownQuestion
  clueCorrect?: boolean
  operationCorrect?: boolean
  answerCorrect: boolean
  your?: string
}
