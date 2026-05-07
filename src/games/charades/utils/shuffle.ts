import type { Difficulty, WordEntry } from '../types'

export function shuffle<T>(items: readonly T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function buildPool(
  allWords: readonly WordEntry[],
  difficulties: ReadonlySet<Difficulty>,
): WordEntry[] {
  return allWords.filter((word) => difficulties.has(word.difficulty))
}

export function shuffledPool(
  allWords: readonly WordEntry[],
  difficulties: ReadonlySet<Difficulty>,
): WordEntry[] {
  return shuffle(buildPool(allWords, difficulties))
}
