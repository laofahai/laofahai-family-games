// 全平台共享的「角色库」：人物定义一次，各游戏按 id 引用，不再在代码里硬编码人名。
// 也是进度统计的对象（每个「孩子」角色就是一份档案）。

import type { AgeRange } from './taxonomy'

export type PersonRole = 'self' | 'parent' | 'sibling' | 'teacher' | 'classmate' | 'other'

/** 人物所属圈子，方便各游戏成批取用 */
export type Circle = 'family' | 'yiyi-class' | 'shuner-class'

export interface Person {
  id: string
  name: string
  role: PersonRole
  circle: Circle
  /** 家庭关系或称呼，如 爸爸 / 妈妈 / 姐姐 / 妹妹；老师可放科目 */
  relation?: string
  /** 年级，用于内容适配 */
  grade?: string
  /** 适用/对应年龄 */
  age?: AgeRange
  emoji?: string
}

// —— 家庭 ——
export const FAMILY: Person[] = [
  { id: 'dad', name: '爸爸', role: 'parent', circle: 'family', relation: '爸爸', emoji: '👨‍💻' },
  { id: 'mom', name: '妈妈', role: 'parent', circle: 'family', relation: '妈妈', emoji: '🛍️' },
  { id: 'yiyi', name: '闫一依', role: 'self', circle: 'family', relation: '姐姐', grade: '六年级', age: { min: 11, max: 13 }, emoji: '🎤' },
  { id: 'shuner', name: '闫顺儿', role: 'sibling', circle: 'family', relation: '妹妹', grade: '二年级', age: { min: 7, max: 10 }, emoji: '🎀' },
]

// —— 闫一依的班级 ——
export const YIYI_TEACHERS: Person[] = [
  { id: 'zhang', name: '张超越', role: 'teacher', circle: 'yiyi-class', relation: '班主任·英语', emoji: '🧑‍🏫' },
  { id: 'zheng', name: '郑老师', role: 'teacher', circle: 'yiyi-class', relation: '数学', emoji: '📐' },
  { id: 'tai', name: '台老师', role: 'teacher', circle: 'yiyi-class', relation: '语文', emoji: '📖' },
]

// —— 闫顺儿的小镇 ——
export const SHUNER_TEACHERS: Person[] = [
  { id: 'zhu', name: '朱老师', role: 'teacher', circle: 'shuner-class', relation: '数学', emoji: '🧮' },
  { id: 'chen', name: '陈老师', role: 'teacher', circle: 'shuner-class', relation: '语文', emoji: '📚' },
]

/** 闫一依班上的同学名单（角色库的同学圈，供任务局等游戏取用） */
export const YIYI_CLASSMATES = [
  '傅美晴', '李怡晓', '杨茗皓', '王苏畅', '于嘉宁', '刘语欣', '李宣潼', '王凯旋', '韩雨桐', '魏越凡',
  '丁月淇', '安韵涵', '李嘉蓉', '王梓润', '赵宇轩', '隋昊雨', '崔皓然', '李星谕', '耿若涵', '谢宇聪',
  '郑辰宇', '马铭骏', '孟子轩', '王梓哲', '管清然', '臧可悦', '刘效含', '李清澄', '王晨菲', '王柏润',
  '肖雲凡', '陈钰涵', '何静茹', '刘依含', '隋佳骏', '王瑞', '范雨彤', '马浩坤', '周睿洋', '张嘉桐',
  '徐一嘉', '曹凤越', '程一馨', '刘欣菲', '张博轩', '管瑾萱',
] as const

export const ALL_PEOPLE: Person[] = [...FAMILY, ...YIYI_TEACHERS, ...SHUNER_TEACHERS]

export const PERSON_BY_ID: Record<string, Person> = Object.fromEntries(
  ALL_PEOPLE.map((p) => [p.id, p])
)

export function personName(id: string): string {
  return PERSON_BY_ID[id]?.name ?? id
}

/** 取某个圈子的成员 */
export function peopleInCircle(circle: Circle): Person[] {
  return ALL_PEOPLE.filter((p) => p.circle === circle)
}
