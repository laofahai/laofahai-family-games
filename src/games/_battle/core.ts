// 战斗内核：答题驱动的回合制战斗逻辑（纯逻辑、无渲染）。两个游戏共用：
//  · 打老师（横版 PvE）：主角 vs 一串老师 Boss / 同学小怪
//  · 知识对战（回合 PvP）：两名玩家轮流答题对轰
// 渲染各游戏自己实现，这里只管「答对/答错 → 谁掉多少血 → 暴击 → 胜负」。

export interface Fighter {
  id: string
  name: string
  emoji: string
  hp: number
  maxHp: number
}

export function makeFighter(id: string, name: string, emoji: string, hp: number): Fighter {
  return { id, name, emoji, hp, maxHp: hp }
}

export interface DamagePlan {
  base: number // 基础伤害
  critEvery: number // 连对到几次触发一次暴击
  critMul: number // 暴击倍数
}

export const DEFAULT_DAMAGE: DamagePlan = { base: 1, critEvery: 3, critMul: 2 }

export interface AttackResult {
  damage: number
  crit: boolean
  target: 'enemy' | 'self' // 答对→打敌人；答错→自己受击
}

/**
 * 一次作答的结算。
 * @param correct 是否答对
 * @param streakBefore 作答前的连对数（用于判断这次是否凑成暴击）
 */
export function resolveAnswer(correct: boolean, streakBefore: number, plan: DamagePlan = DEFAULT_DAMAGE): AttackResult {
  if (correct) {
    const newStreak = streakBefore + 1
    const crit = plan.critEvery > 0 && newStreak % plan.critEvery === 0
    return { damage: plan.base * (crit ? plan.critMul : 1), crit, target: 'enemy' }
  }
  return { damage: plan.base, crit: false, target: 'self' }
}

export function applyDamage(f: Fighter, dmg: number): Fighter {
  return { ...f, hp: Math.max(0, f.hp - dmg) }
}

export function isDown(f: Fighter): boolean {
  return f.hp <= 0
}

/** 血量百分比（0-100），画血条用。 */
export function hpPct(f: Fighter): number {
  return f.maxHp > 0 ? Math.round((f.hp / f.maxHp) * 100) : 0
}

// ── 题目：两个战斗游戏共用的题目形状（与各自题库解耦）──────────────────
export interface BattleQuestion {
  id: string
  subject: string // math | chinese | english | science | sports | life | social | interest | funny
  band?: Band // 年龄段（聚合时打上，便于扁平数组按年龄筛）
  prompt: string
  choices: { id: string; text: string }[]
  answer: string // 正确选项的 id
  explanation?: string
}

/** 学科 → 给人看的中文名 + 图标，UI 复用。 */
export const SUBJECT_META: Record<string, { label: string; emoji: string }> = {
  math: { label: '数学', emoji: '➗' },
  chinese: { label: '语文', emoji: '📖' },
  english: { label: '英语', emoji: '🔤' },
  science: { label: '科学', emoji: '🔬' },
  sports: { label: '体育', emoji: '🏃' },
  life: { label: '生活技能', emoji: '🧩' },
  social: { label: '同学社交', emoji: '🤝' },
  interest: { label: '兴趣', emoji: '⭐' },
  funny: { label: '搞笑', emoji: '😂' },
}

export function subjectLabel(subject: string): string {
  return SUBJECT_META[subject]?.label ?? subject
}
export function subjectEmoji(subject: string): string {
  return SUBJECT_META[subject]?.emoji ?? '❓'
}

// 年龄段：low=一二年级(闫顺儿) high=六年级(闫一依)。放在 core（纯模块）里，
// 让题库/遭遇/名册等叶子数据文件都能引用而不互相牵连。
export type Band = 'low' | 'high'
