// 石榴镇（闫顺儿的学习闯关）—— 纯静态内容/名单叶子数据文件。
//
// 只允许相对/类型导入，不要用 @/ 别名 —— 这样脚本可以直接 import 这份数据。
// 这里只放「纯数组/常量/模板」；运行时拼装（people / buyerNames）以及接云
// （contentFor）都在 questions.ts 里做，不在本文件做。

// 内容数组（同学名单 / 名词 / 小店商品）已迁到云端，运行时由 questions.ts
// 通过 contentFor('roster-shiliu' | 'nouns' | 'shiliu-shop', []) 读取。
// 本文件只保留运行时模板/常量（名字、场景、地点）。

export const PLAYER_NAME = '闫顺儿'
export const MATH_TEACHER_NAME = '朱老师'
export const CHINESE_TEACHER_NAME = '陈老师'

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

export const shopPlaces = ['文具店', '小卖部', '零食铺', '玩具摊', '班级义卖摊']
