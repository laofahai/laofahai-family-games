// 社交遭遇（同学小怪用）：遇到同学不一定是答题，更多是社交互动——
// 损两句 / 忽悠 / 撒娇 / 套近乎(好朋友) / 给点小零食 / 唠生活小事……
// 选一个回应，同学有不同反应：win=搞定他(让路/成同伴) fail=没搞定(被挡) funny=搞笑。
// 战斗里：win 给敌人造成伤害/直接过；fail 自己受点挫；funny 轻松过场。
//
// 内容**只在数据库**：运行时经 contentFor 读 game_content 的 'battle-encounters'，
// 首次联网拉取后缓存到 localStorage（之后离线走缓存）。**不打包兜底**——遭遇内容只在 DB，
// 由调用方在抽空时兜底（reducer 有 fallbackEncounter）。保持下面导出签名不变。

import type { Band } from './core'
import { contentFor } from '@/platform/content'

export type Outcome = 'win' | 'fail' | 'funny'

export interface EncounterOption {
  id: string
  text: string // 玩家的回应，如「我们是好朋友嘛~」「分你点小零食🍬」
  outcome: Outcome
  reply: string // 同学的反应，如「哈哈行吧，你过吧」
}

export interface Encounter {
  id: string
  band: Band
  prompt: string // 情景，如「同学叉着腰挡在路中间」
  options: EncounterOption[] // 2~4 个回应，至少一个 win
}

/** 遭遇库（扁平数组）：只读数据库（contentFor 经 localStorage 缓存）。未拉到则为空。绝不在模块顶层取。 */
function bank(): Encounter[] {
  return contentFor<Encounter>('battle-encounters', [])
}

function shuffle<T>(a: readonly T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

/** 抽 count 个社交遭遇（同学小怪用）。按年龄段筛。抽空由调用方兜底。 */
export function drawEncounters(band: Band, count: number): Encounter[] {
  return shuffle(bank().filter((e) => e.band === band)).slice(0, count)
}
