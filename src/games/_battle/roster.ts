// 战斗名册（打老师用，按年级）：老师=Boss、同学=小怪。
// 可升级：换年级 = 改这份；可日后搬进数据库（contentFor）。
// 只用相对/类型导入（叶子数据文件）。
//
// ⚠️ 内容 agent 会扩充 mobs 全名单、老师台词、hp 调优，但保持下面导出签名不变。

import type { Band } from './core'

export interface BossDef {
  id: string
  name: string
  subject: string // 这个老师出哪科的题
  emoji: string
  hp: number // Boss 比小怪血厚
  taunts: string[] // 出场/答错时的吐槽
  winLine: string // 被打败时的认输/鼓励话
}

export interface RosterDef {
  band: Band
  player: string // 主角名
  bosses: BossDef[]
  mobs: string[] // 同学名（小怪）
  finale: 'graduation' | 'normal' // 六年级='graduation'：通关后毕业场景
}

const LOW: RosterDef = {
  band: 'low',
  player: '闫顺儿',
  finale: 'normal',
  bosses: [
    { id: 'zhu', name: '朱老师', subject: 'math', emoji: '🧮', hp: 3, taunts: ['认真算哦～', '别数错啦'], winLine: '算得真准，厉害！' },
    { id: 'chen', name: '陈老师', subject: 'chinese', emoji: '📚', hp: 3, taunts: ['读清楚题目', '想一想再选'], winLine: '读得真棒！' },
  ],
  mobs: ['邸飞宇', '丁怡铭', '范晨宇'],
}

const HIGH: RosterDef = {
  band: 'high',
  player: '闫一依',
  finale: 'graduation',
  bosses: [
    { id: 'zheng', name: '郑老师', subject: 'math', emoji: '📐', hp: 4, taunts: ['细心一点', '步骤别跳'], winLine: '解得漂亮！' },
    { id: 'tai', name: '台老师', subject: 'chinese', emoji: '📖', hp: 4, taunts: ['再读一遍', '体会一下'], winLine: '理解到位！' },
    { id: 'zhang', name: '张超越', subject: 'english', emoji: '🔤', hp: 4, taunts: ['Think in English!', 'Try again~'], winLine: 'Great job!' },
    { id: 'sci', name: '科学老师', subject: 'science', emoji: '🔬', hp: 4, taunts: ['观察一下', '想想原理'], winLine: '很有科学精神！' },
  ],
  mobs: ['傅美晴', '李怡晓', '杨茗皓'],
}

export function rosterForBand(band: Band): RosterDef {
  return band === 'low' ? LOW : HIGH
}

/** 按玩家取名册：闫顺儿→低年级，其余(含闫一依/家长/管理员)→高年级。 */
export function rosterFor(player: string): RosterDef {
  return player === 'shuner' ? LOW : HIGH
}
