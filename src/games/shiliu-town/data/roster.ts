// 石榴镇（闫顺儿的学习闯关）—— 纯静态内容/名单叶子数据文件。
//
// 只允许相对/类型导入，不要用 @/ 别名 —— 这样脚本可以直接 import 这份数据。
// 这里只放「纯数组/常量/模板」；运行时拼装（people / buyerNames）以及接云
// （contentFor）都在 questions.ts 里做，不在本文件做。

import type { ShopItem } from '../types'

export interface Thing {
  name: string
  unit: string
  emoji?: string
}

export const things: Thing[] = [
  { name: '苹果', unit: '个' },
  { name: '草莓', unit: '颗' },
  { name: '贴纸', unit: '张' },
  { name: '糖果', unit: '颗' },
  { name: '铅笔', unit: '支' },
  { name: '本子', unit: '本' },
  { name: '小花', unit: '朵' },
  { name: '小鱼', unit: '条' },
  { name: '积木', unit: '块' },
  { name: '星星卡', unit: '张' },
  { name: '小饼干', unit: '块' },
  { name: '跳绳次数', unit: '下' },
]

export const PLAYER_NAME = '闫顺儿'
export const MATH_TEACHER_NAME = '朱老师'
export const CHINESE_TEACHER_NAME = '陈老师'

export const classmates = [
  '邸飞宇',
  '丁怡铭',
  '范晨宇',
  '范煜林',
  '冯珺涵',
  '高锦轩',
  '高梓皓',
  '郭欣妍',
  '郭智旭',
  '韩一菲',
  '林子文',
  '刘霄',
  '卢昱润',
  '马晨硕',
  '潘芊语',
  '逄钧然',
  '戚艺曦',
  '齐玉林',
  '施政宇',
  '宋翔赫',
  '宋梓宸',
  '王博冉',
  '王晗伊',
  '王浩宇',
  '王佳雯',
  '王婧瑄',
  '王俊哲',
  '王姝心',
  '王兴琰',
  '王雨航',
  '王御阳',
  '吴恺澄',
  '徐嘉泽',
  '闫鑫怡',
  '殷中和',
  '臧晨希',
  '张力文',
  '张轩宁',
  '张怡甜',
  '张韵渲',
  '赵蕴涵',
  '郑皓俊',
  '钟嘉馨',
  '周源',
]

export const missingScenes = [
  { planner: MATH_TEACHER_NAME, verb: '准备', targetName: '闯关卡' },
  { planner: CHINESE_TEACHER_NAME, verb: '准备', targetName: '故事卡' },
  { planner: '班长', verb: '收齐', targetName: '小组任务' },
  { planner: `小店老板${PLAYER_NAME}`, verb: '备货', targetName: '下午营业' },
  { planner: '妈妈', verb: '准备', targetName: '晚饭' },
  { planner: '图书管理员', verb: '整理', targetName: '书架' },
]

export const twoStepScenes = [
  { place: '小店货架上', more: '又补上', away: '卖出去', ask: '货架上现在有' },
  { place: `${MATH_TEACHER_NAME}讲台上`, more: '又收上来', away: '发下去', ask: '讲台上现在有' },
  { place: `${CHINESE_TEACHER_NAME}讲台上`, more: '又收上来', away: '发下去', ask: '讲台上现在有' },
  { place: '班级图书角', more: '又捐来', away: '借出去', ask: '图书角现在有' },
  { place: '家里的盘子里', more: '又放进来', away: '吃掉', ask: '盘子里现在有' },
  { place: `${PLAYER_NAME}的盒子里`, more: '又得到', away: '送出去', ask: '盒子里现在有' },
]

export const shopCatalog: ShopItem[] = [
  { name: '铅笔', price: 2, emoji: '✏️' },
  { name: '自动铅笔芯', price: 1.5, emoji: '✏️' },
  { name: '橡皮', price: 3, emoji: '🧽' },
  { name: '彩色橡皮', price: 3.5, emoji: '🧽' },
  { name: '本子', price: 5, emoji: '📘' },
  { name: '贴纸包', price: 4, emoji: '🎟️' },
  { name: '小贴纸', price: 2.5, emoji: '⭐' },
  { name: '小印章', price: 7, emoji: '🔖' },
  { name: '果汁', price: 6, emoji: '🧃' },
  { name: '酸梅汤', price: 3.5, emoji: '🥤' },
  { name: '牛奶', price: 4, emoji: '🥛' },
  { name: '包子', price: 3, emoji: '🥟' },
  { name: '小馒头', price: 1.5, emoji: '🥟' },
  { name: '蛋挞', price: 5, emoji: '🥧' },
  { name: '冰淇淋', price: 8, emoji: '🍦' },
  { name: '小发夹', price: 9, emoji: '🌼' },
  { name: '角色卡', price: 10, emoji: '🃏' },
  { name: '弹力球', price: 6, emoji: '🏀' },
  { name: '酸奶', price: 5, emoji: '🥣' },
  { name: '饼干', price: 6.5, emoji: '🍪' },
  { name: '水彩笔', price: 12, emoji: '🖍️' },
  { name: '小发圈', price: 6, emoji: '🎀' },
  { name: '便利贴', price: 4, emoji: '📝' },
]

export const shopPlaces = ['文具店', '小卖部', '零食铺', '玩具摊', '班级义卖摊']
