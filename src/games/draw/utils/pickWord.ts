import type { DrawDifficulty, DrawWord } from '../types'
import { drawWords } from '../data/draw-words'

/**
 * 从选定难度里抽词，优先避开本局已出现过的词；
 * 全部用完时重置去重池。
 */
export function pickWord(
  difficulties: ReadonlySet<DrawDifficulty>,
  usedTexts: ReadonlySet<string>,
): DrawWord {
  const pool = drawWords.filter((w) => difficulties.has(w.difficulty))
  const source = pool.length > 0 ? pool : drawWords
  const fresh = source.filter((w) => !usedTexts.has(w.text))
  const candidates = fresh.length > 0 ? fresh : source
  return candidates[Math.floor(Math.random() * candidates.length)]
}
