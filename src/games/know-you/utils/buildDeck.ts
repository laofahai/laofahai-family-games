import { pickUnseen } from '@/platform/progress'
import type { DeckCard, FamilyCard, KnowQuestion, QuestionsPerRole, RoleId } from '../types'

export function shuffle<T>(items: readonly T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

/** 每个角色用各自的 scope 记录「已问过」的题;彩蛋卡用 family scope。idOf 用稳定的题面文本。 */
function roleScope(role: RoleId): string {
  return `knowYou:${role}`
}
const FAMILY_SCOPE = 'knowYou:family'

/**
 * 组牌:每位在场角色抽 perRole 道题,然后按"角色轮转"交错排列,
 * 保证主角依次轮换(姐姐→妹妹→妈妈→爸爸→姐姐……)。
 * withFamilyCards 时,每轮完整轮转之后(最后一轮除外)穿插一张全家彩蛋卡。
 * 抽题改用共享的 pickUnseen:每角色/彩蛋各用独立 scope,优先没问过的;池子抽完自动回收再补。
 * usedTexts 仍用于同一局内「再来一轮」时避开本局已出过的题。
 */
export function buildDeck(
  allQuestions: readonly KnowQuestion[],
  allFamilyCards: readonly FamilyCard[],
  players: readonly RoleId[],
  perRole: QuestionsPerRole,
  withFamilyCards: boolean,
  usedTexts: ReadonlySet<string>,
): DeckCard[] {
  const byRole = new Map<RoleId, KnowQuestion[]>()
  for (const role of players) {
    // 本局内排除已出过的题,再 shuffle 后交给 pickUnseen 优先挑「跨局没问过」的;不够时自动回收。
    const pool = allQuestions.filter((q) => q.role === role && !usedTexts.has(q.text))
    let picked = pickUnseen(roleScope(role), shuffle(pool), (q) => q.text, perRole)
    if (picked.length < perRole) {
      // 本局未出过的不够 perRole 道(题库太小):回收本局已出过的旧题补足。
      const recycled = shuffle(
        allQuestions.filter((q) => q.role === role && !picked.includes(q)),
      )
      picked = [...picked, ...recycled.slice(0, perRole - picked.length)]
    }
    byRole.set(role, picked)
  }

  // 整局最多穿插 perRole - 1 张彩蛋卡(最后一轮不插)。
  const familyNeeded = Math.max(0, perRole - 1)
  let familyPool: FamilyCard[] = []
  if (withFamilyCards && familyNeeded > 0) {
    const familyFresh = allFamilyCards.filter((c) => !usedTexts.has(c.text))
    // 本局没出过的彩蛋卡里优先挑没问过的;若本局已全部出过,回收旧卡补足,保证仍有彩蛋穿插。
    familyPool = pickUnseen(FAMILY_SCOPE, shuffle(familyFresh), (c) => c.text, familyNeeded)
    if (familyPool.length < familyNeeded) {
      const recycled = shuffle(allFamilyCards.filter((c) => !familyPool.includes(c)))
      familyPool = [...familyPool, ...recycled.slice(0, familyNeeded - familyPool.length)]
    }
  }

  const order = shuffle(players)
  const deck: DeckCard[] = []
  for (let i = 0; i < perRole; i += 1) {
    for (const role of order) {
      const q = byRole.get(role)?.[i]
      if (q) deck.push(q)
    }
    const isLastCycle = i === perRole - 1
    if (!isLastCycle && familyPool.length > 0) {
      const card = familyPool.shift()
      if (card) deck.push(card)
    }
  }
  return deck
}
