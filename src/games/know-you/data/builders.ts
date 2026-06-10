import type { KnowQuestion, RoleId } from '../types'

/** [题面, 参考答案, emoji] */
export type TriviaRow = [string, string, string]

/** [题面, emoji] */
export type PersonalRow = [string, string]

export const trivia = (role: RoleId, tag: string, rows: TriviaRow[]): KnowQuestion[] =>
  rows.map(([text, answer, emoji]) => ({ role, kind: 'trivia', text, answer, emoji, tag }))

export const personal = (role: RoleId, tag: string, rows: PersonalRow[]): KnowQuestion[] =>
  rows.map(([text, emoji]) => ({ role, kind: 'personal', text, emoji, tag }))
