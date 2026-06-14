// 关卡编排：把名册（Boss 串 + 同学名单）摊成「关 → 小怪队列 + Boss」的步骤。
// 同学小怪：每关随机 2~3 个，名字从 roster.mobs 取（同关内不重复，跨关循环复用），
// 表情随机用一组笑脸，遭遇方式随机选「社交遭遇 / 好玩题 / 损人嘴炮」，
// 并在打 Boss 前固定塞一个「体测传感器挑战」热身。

import type { RosterDef } from '@/games/_battle/roster'
import type { LevelPlan, MobStep, MobMode } from './types'

const MOB_EMOJIS = ['🙂', '😀', '😎', '😜', '🤓', '😏', '🥳', '😺']
const FITNESS_NAMES = ['体育委员', '运动健将', '操场霸主', '跳绳大王']

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** 普通小怪的互动方式：社交遭遇 / 好玩题 / 损人嘴炮，按权重随机。 */
function pickMobMode(): MobMode {
  const r = Math.random()
  if (r < 0.42) return 'encounter'
  if (r < 0.72) return 'question'
  return 'diss'
}

/** 为某一关生成 2~3 个同学小怪 + 1 个 Boss 前的体测挑战。 */
function buildMobs(roster: RosterDef, levelIndex: number): MobStep[] {
  const count = rand(2, 3)
  const names = roster.mobs.length ? roster.mobs : ['同学']
  const steps: MobStep[] = []
  const usedNames = new Set<string>()
  for (let i = 0; i < count; i++) {
    // 关内不重复取名；名字不够时加序号兜底
    let name = names[(levelIndex + i) % names.length]
    let guard = 0
    while (usedNames.has(name) && guard < names.length) {
      name = names[(levelIndex + i + guard + 1) % names.length]
      guard++
    }
    if (usedNames.has(name)) name = `${name}${i + 1}`
    usedNames.add(name)

    steps.push({
      kind: 'mob',
      name,
      emoji: pick(MOB_EMOJIS),
      hp: rand(1, 2),
      mode: pickMobMode(),
    })
  }
  // Boss 前热身：一个体测传感器挑战小怪（达标直接放倒、过得爽）
  steps.push({
    kind: 'mob',
    name: pick(FITNESS_NAMES),
    emoji: '🏃',
    hp: 1,
    mode: 'fitness',
  })
  return steps
}

/** 把名册摊成全部关卡的步骤计划。每个 Boss 一关。 */
export function buildLevels(roster: RosterDef): LevelPlan[] {
  return roster.bosses.map((boss, levelIndex) => ({
    levelIndex,
    mobs: buildMobs(roster, levelIndex),
    boss: { kind: 'boss', boss },
  }))
}
