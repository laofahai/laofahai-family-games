// 战斗名册（打老师用，按年级）：老师=Boss、同学=小怪。
// 真源在云端名册（cloudRoster：DB 唯一真源，App 启动拉缓存）；云端为空时回退到下面硬编码的
// LOW/HIGH（离线 / 未配置后端也能玩）。DB 行不带台词，台词/认输话按科目用默认补齐。
// 只用相对/类型导入 + 平台 cloudRoster。
//
// ⚠️ 保持导出签名稳定：rosterFor / rosterForBand / RosterDef / BossDef。

import type { Band } from './core'
import { rosterRows, rosterIn, rosterById, type RosterRow } from '@/platform/cloudRoster'

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

// ── 离线兜底（云端名册为空时用）────────────────────────────────────────
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

// ── 云端行 → BossDef 用的默认补齐（DB 不带台词/图标）──────────────────
const SUBJECT_EMOJI: Record<string, string> = {
  math: '📐', chinese: '📖', english: '🔤', science: '🔬',
  sports: '🏃', life: '🧩', social: '🤝', interest: '⭐', funny: '😂',
}
const SUBJECT_TAUNTS: Record<string, string[]> = {
  math: ['细心一点', '步骤别跳', '别数错啦'],
  chinese: ['再读一遍', '想清楚再选', '体会一下'],
  english: ['Think in English!', 'Try again~', 'Read it again!'],
  science: ['观察一下', '想想原理', '动动脑筋'],
}
const DEFAULT_TAUNTS = ['再想想哦', '别急，慢慢来', '认真一点～']
const SUBJECT_WINLINE: Record<string, string> = {
  math: '解得漂亮！',
  chinese: '理解到位！',
  english: 'Great job!',
  science: '很有科学精神！',
}
const DEFAULT_WINLINE = '答得真棒！'
const DEFAULT_BOSS_HP = 4

function bossFromRow(row: RosterRow): BossDef {
  const subject = row.meta?.subject ?? 'math'
  return {
    id: row.id,
    name: row.name,
    subject,
    emoji: row.meta?.emoji ?? SUBJECT_EMOJI[subject] ?? '🧑‍🏫',
    hp: row.meta?.hp ?? DEFAULT_BOSS_HP,
    taunts: SUBJECT_TAUNTS[subject] ?? DEFAULT_TAUNTS,
    winLine: SUBJECT_WINLINE[subject] ?? DEFAULT_WINLINE,
  }
}

/** 从云端名册按班级拼一份 RosterDef；缺料（没老师/没同学/没玩家名）则返回 null 让上游回退。 */
function rosterFromCloud(player: string): RosterDef | null {
  if (rosterRows().length === 0) return null
  const me = rosterById(player)
  const classId = me?.class_id
  if (!classId) return null
  const bosses = rosterIn(classId, 'teacher').map(bossFromRow)
  const mobs = rosterIn(classId, 'classmate').map((r) => r.name)
  if (bosses.length === 0 || mobs.length === 0) return null
  const band: Band = classId === 'shuner-class' ? 'low' : 'high'
  return {
    band,
    player: me?.name ?? player,
    bosses,
    mobs,
    finale: band === 'high' ? 'graduation' : 'normal',
  }
}

export function rosterForBand(band: Band): RosterDef {
  return band === 'low' ? LOW : HIGH
}

/** 按玩家取名册：优先云端名册（按 TA 的 class_id 拼）；缺料则回退硬编码
 *  （闫顺儿→低年级，其余含闫一依/家长/管理员→高年级）。 */
export function rosterFor(player: string): RosterDef {
  const cloud = rosterFromCloud(player)
  if (cloud) return cloud
  return player === 'shuner' ? LOW : HIGH
}
