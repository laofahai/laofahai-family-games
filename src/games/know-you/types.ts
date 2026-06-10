export type RoleId = 'dad' | 'mom' | 'bigSis' | 'lilSis'

export type QuestionKind = 'trivia' | 'personal'

export interface KnowQuestion {
  role: RoleId
  kind: QuestionKind
  text: string
  /** trivia 题的参考答案;personal 题由主角现场公布 */
  answer?: string
  emoji: string
  /** 主题标签,如"青春回忆""游戏""谷子圈""工作日常""走心" */
  tag: string
}

export interface RoleInfo {
  id: RoleId
  name: string
  emoji: string
  desc: string
}

export const ROLES: RoleInfo[] = [
  { id: 'dad', name: '爸爸', emoji: '👨‍💻', desc: '程序员的神秘世界' },
  { id: 'mom', name: '妈妈', emoji: '🛍️', desc: '商场打工人的一天' },
  { id: 'bigSis', name: '姐姐', emoji: '🎤', desc: '邓紫棋十级学者' },
  { id: 'lilSis', name: '妹妹', emoji: '🎀', desc: '一年级小当家' },
]

export const ROLE_MAP: Record<RoleId, RoleInfo> = Object.fromEntries(
  ROLES.map((r) => [r.id, r])
) as Record<RoleId, RoleInfo>

export type QuestionsPerRole = 3 | 5 | 8

export type Stage = 'intro' | 'setup' | 'playing' | 'result'

/** 一道题的结算:谁答对了;空数组 = 没人答对,主角拿独家分 */
export interface RoundRecord {
  question: KnowQuestion
  correctGuessers: RoleId[]
}

export const KIND_LABEL: Record<QuestionKind, string> = {
  trivia: '知识卡',
  personal: '走心卡',
}
