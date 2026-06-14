import type { Band } from '@/games/_battle/questions'
import { FUN_KINDS, LEARN_KINDS } from '@/games/_battle/questions'
import type { CpuLevel, TopicMode } from './types'

/** 可选头像（孩子/同学自己挑）。 */
export const AVATARS = [
  '🦊', '🐯', '🐼', '🐨', '🦁', '🐸', '🦄', '🐲',
  '🐱', '🐶', '🐰', '🐹', '🦖', '🦕', '🐙', '🦉',
  '👦', '👧', '🧒', '🧑‍🎓', '🦸', '🥷', '🧙', '🤖',
] as const

/** 电脑命中率（按难度）。 */
export const CPU_ACCURACY: Record<CpuLevel, number> = {
  easy: 0.6,
  normal: 0.75,
  hard: 0.88,
}

export const CPU_LEVEL_LABEL: Record<CpuLevel, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
}

export const BAND_LABEL: Record<Band, string> = {
  low: '低年级（一二年级）',
  high: '高年级（六年级）',
}

export const TOPIC_LABEL: Record<TopicMode, string> = {
  learn: '学习题',
  fun: '好玩题',
  mix: '混合',
}

/** 把题型偏好翻译成 drawQuestions 的参数。 */
export function topicToDrawArgs(topic: TopicMode): {
  kinds?: readonly string[]
  learnRatio?: number
} {
  if (topic === 'learn') return { kinds: LEARN_KINDS }
  if (topic === 'fun') return { kinds: FUN_KINDS }
  return { learnRatio: 0.5 }
}

/** 每局题量（够长打到血空，又不至于抽干题库）。 */
export const QUESTION_BATCH = 40

/** 默认血量（回合多一点更有「对轰」感）。 */
export const DEFAULT_HP = 6

/** 电脑名字 / 头像。 */
export const CPU_SETUP = { name: '电脑', emoji: '🤖' } as const
