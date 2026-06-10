import type { KnowQuestion } from '../types'
import { dadQuestions } from './dad'
import { momQuestions } from './mom'
import { bigSisQuestions } from './big-sis'
import { lilSisQuestions } from './lil-sis'

export const knowQuestions: KnowQuestion[] = [
  ...dadQuestions,
  ...momQuestions,
  ...bigSisQuestions,
  ...lilSisQuestions,
]
