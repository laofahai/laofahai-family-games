import type { KnowQuestion, QuestionsPerRole, RoleId } from '../types'

export function shuffle<T>(items: readonly T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

/**
 * 组牌:每位在场角色抽 perRole 道题,然后按"角色轮转"交错排列,
 * 保证主角依次轮换(姐姐→妹妹→妈妈→爸爸→姐姐……)。
 * usedTexts 用于"再来一轮"时避开已出过的题;某角色题不够时回收旧题补足。
 */
export function buildDeck(
  allQuestions: readonly KnowQuestion[],
  players: readonly RoleId[],
  perRole: QuestionsPerRole,
  usedTexts: ReadonlySet<string>,
): KnowQuestion[] {
  const byRole = new Map<RoleId, KnowQuestion[]>()
  for (const role of players) {
    const pool = allQuestions.filter((q) => q.role === role)
    const fresh = shuffle(pool.filter((q) => !usedTexts.has(q.text)))
    let picked = fresh.slice(0, perRole)
    if (picked.length < perRole) {
      const recycled = shuffle(pool.filter((q) => !picked.includes(q)))
      picked = [...picked, ...recycled.slice(0, perRole - picked.length)]
    }
    byRole.set(role, picked)
  }

  const order = shuffle(players)
  const deck: KnowQuestion[] = []
  for (let i = 0; i < perRole; i += 1) {
    for (const role of order) {
      const q = byRole.get(role)?.[i]
      if (q) deck.push(q)
    }
  }
  return deck
}
