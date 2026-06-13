// 全平台共享的「年龄段 / 难度」词汇表。各游戏的内容与目录都用这一套标准。

/** 内容/游戏的适用年龄区间（岁） */
export interface AgeRange {
  min: number
  max: number
}

/** 统一难度等级，替代各游戏各自定义的 Difficulty */
export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

/** 首页用来筛选游戏的年龄段标签 */
export interface AgeBand {
  id: string
  label: string
  /** 该段覆盖的年龄区间；与游戏的 AgeRange 有重叠就算适配 */
  range: AgeRange
}

export const AGE_BANDS: AgeBand[] = [
  { id: 'all', label: '全部', range: { min: 0, max: 200 } },
  { id: 'lower', label: '低龄 · 一二年级', range: { min: 5, max: 9 } },
  { id: 'preteen', label: '小升初', range: { min: 11, max: 13 } },
  { id: 'family', label: '全家同乐', range: { min: 14, max: 200 } },
]

/** 两个年龄区间是否有重叠 */
export function ageOverlaps(a: AgeRange, b: AgeRange): boolean {
  return a.min <= b.max && a.max >= b.min
}
