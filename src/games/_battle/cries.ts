// 中二台词取词器（打老师 / 知识对战共用）：纯读数据库。
//  - skillCry(subject, band)：答对出招时喊的「招式名」，按当前题目【学科】匹配。
//  - battleCry(kind, band)：暴击 / 连击 / 终结 / 挑衅 的战吼。
// 内容只在 DB：battle-skills（按学科+年龄段）、battle-cries（按类型+年龄段）。未拉到则返回 null，调用方自行不显示。

import type { Band } from './core'
import { contentFor } from '@/platform/content'

export interface BattleSkill {
  id: string
  text: string
  subject: string
  band: Band
}

export type CryKind = 'crit' | 'combo' | 'finish' | 'taunt'

export interface BattleCry {
  id: string
  text: string
  kind: CryKind
  band: Band
}

function pick<T>(arr: readonly T[]): T | null {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null
}

/** 按学科+年龄段取一个中二招式名（答对出招时喊）。无精确匹配则退到同年龄段、再退到全体。 */
export function skillCry(subject: string, band: Band): string | null {
  const all = contentFor<BattleSkill>('battle-skills', [])
  if (!all.length) return null
  const exact = all.filter((s) => s.subject === subject && s.band === band)
  const byBand = all.filter((s) => s.band === band)
  return (pick(exact) ?? pick(byBand) ?? pick(all))?.text ?? null
}

/** 按类型+年龄段取一句战吼。无同段则退到同类型任意年龄段。 */
export function battleCry(kind: CryKind, band: Band): string | null {
  const all = contentFor<BattleCry>('battle-cries', [])
  if (!all.length) return null
  const sameBand = all.filter((c) => c.kind === kind && c.band === band)
  const sameKind = all.filter((c) => c.kind === kind)
  return (pick(sameBand) ?? pick(sameKind))?.text ?? null
}
