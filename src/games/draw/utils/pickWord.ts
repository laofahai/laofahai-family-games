import { pickUnseen } from '@/platform/progress'
import type { DrawDifficulty, DrawWord } from '../types'
import { drawWords } from '../data/draw-words'

function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * 从选定难度里抽词：
 * 1. 先按难度过滤；
 * 2. 在过滤后的词集合上用 pickUnseen 跨场次去重——优先挑「以前没画过」的词，
 *    画过的词下次不再重复出现，整池画完后自动回收再来；
 * 3. usedTexts 仍负责「本局内」不重复（pickUnseen 的随机顺序由 shuffle 保证）。
 */
export function pickWord(
  difficulties: ReadonlySet<DrawDifficulty>,
  usedTexts: ReadonlySet<string>,
): DrawWord {
  const pool = drawWords.filter((w) => difficulties.has(w.difficulty))
  const source = pool.length > 0 ? pool : drawWords
  // 本局已出现过的优先排除；都用过了就回到完整难度池
  const fresh = source.filter((w) => !usedTexts.has(w.text))
  const candidates = fresh.length > 0 ? fresh : source
  // shuffle 后交给 pickUnseen：从「跨场次没见过」的里取第一个并自动标记已见
  const [picked = candidates[Math.floor(Math.random() * candidates.length)]] =
    pickUnseen('draw', shuffle(candidates), (w) => w.text, 1)
  return picked
}
