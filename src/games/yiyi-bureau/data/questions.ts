import type { BureauMode, BureauQuestion } from '../types'
import { chemQuestion, chemReady, insightQuestion, insightReady } from './cards'
import { cnClassical, cnInfer, CHINESE_MAKERS } from './chinese'
import { enPassage, ENGLISH_MAKERS } from './english'
import { mathFracRemain, mathNeg2, mathReverse, MATH_MAKERS, PLANNER_MAKERS } from './math'
import { sciCode, SCIENCE_MAKERS } from './science'
import { shuffle, type Maker } from './_shared'
import { sparkQuestion } from './spark'

// ===========================================================================
// 组卷
// ===========================================================================

const PREVIEW_MAKERS: Maker[] = [
  mathFracRemain,
  mathReverse,
  mathNeg2,
  cnInfer,
  cnClassical,
  enPassage,
  sciCode,
]

function cycled(makers: Maker[]): Maker {
  const order = shuffle(makers)
  let i = 0
  return (id) => order[i++ % order.length](id)
}

export function buildBureauQuestions(mode: BureauMode, count: number): BureauQuestion[] {
  const planner = cycled(PLANNER_MAKERS)
  const archive = cycled([...CHINESE_MAKERS, ...ENGLISH_MAKERS])
  const preview = cycled(PREVIEW_MAKERS)
  // 全科基础（小学复盘，巩固自信）；初中核心（主战场）= 初中预告题
  const primary = cycled([...MATH_MAKERS, ...CHINESE_MAKERS, ...ENGLISH_MAKERS, ...SCIENCE_MAKERS])
  const middle = cycled(PREVIEW_MAKERS)

  const hasChem = chemReady()
  const hasInsight = insightReady()

  // 「混合任务局」修正版（默认更硬）：化学~20% / 见识~18% / 初中核心~40% / 小学复盘~22%
  const mixed = (idx: number): BureauQuestion => {
    const r = Math.random()
    if (hasChem && r < 0.2) return chemQuestion(idx)
    if (hasInsight && r < 0.38) return insightQuestion(idx)
    if (r < 0.78) return middle(idx)
    return primary(idx)
  }
  // 「学霸特训局」：去掉小学复盘，全初中核心 + 化学 + 见识/前沿，给吃不饱的孩子上强度
  const challenge = (idx: number): BureauQuestion => {
    const r = Math.random()
    if (hasChem && r < 0.25) return chemQuestion(idx)
    if (hasInsight && r < 0.55) return insightQuestion(idx)
    return middle(idx)
  }

  const questions = Array.from({ length: count }, (_, idx) => {
    if (idx > 0 && idx % 4 === 3) return sparkQuestion(idx)
    if (mode === 'planner') return planner(idx)
    if (mode === 'archive') return archive(idx)
    if (mode === 'preview') return preview(idx)
    if (mode === 'challenge') return challenge(idx)
    return mixed(idx)
  })

  return shuffle(questions)
}
