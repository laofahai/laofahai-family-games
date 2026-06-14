// 关卡编排：把名册（Boss 串 + 同学名单）摊成「关 → 小怪队列 + Boss」的步骤。
// 同学小怪：每关随机 2~3 个步骤，名字从 roster.mobs 取（同关内不重复，跨关循环复用），
// 表情随机用一组笑脸，遭遇方式随机选「近战群 / 社交遭遇 / 好玩题 / 损人嘴炮」，
// 近战群（melee）会一次出 1~5 个爆米花小怪（一拳一个），其余模式仍是单怪。
// 并在打 Boss 前固定塞一个「体测传感器挑战」热身。

import type { RosterDef } from '@/games/_battle/roster'
import type { LevelPlan, MobStep, MobMode } from './types'

const MOB_EMOJIS = ['🙂', '😀', '😎', '😜', '🤓', '😏', '🥳', '😺']

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** 近战群规模：1~5 任意个（爆米花，一拳一个，清得爽）。偏多个，单个少见，主打「一波怪」的爽感。 */
function pickWaveSize(): number {
  const r = Math.random()
  if (r < 0.14) return 1 // 14%
  if (r < 0.36) return 2 // 22%
  if (r < 0.62) return 3 // 26%
  if (r < 0.84) return 4 // 22%
  return 5 // 16%
}

/** 构造一个近战群步骤（front=members[0]，各 1 血爆米花）。size 省略则随机 1~5。 */
function meleeStep(roster: RosterDef, size?: number): MobStep {
  const members = buildWaveMembers(roster, size ?? pickWaveSize())
  return { kind: 'mob', name: members[0].name, emoji: members[0].emoji, hp: 1, mode: 'melee', members }
}

/** 给近战群凑 size 个成员：名字尽量从 roster.mobs 取不重复，不够就循环 + 加序号兜底；表情随机。 */
function buildWaveMembers(roster: RosterDef, size: number): { name: string; emoji: string }[] {
  const names = roster.mobs.length ? roster.mobs : ['同学']
  const used = new Set<string>()
  const members: { name: string; emoji: string }[] = []
  for (let i = 0; i < size; i++) {
    let name = names[i % names.length]
    if (used.has(name)) name = `${name}${i + 1}` // 名字不够 → 加序号兜底，本波内仍唯一
    used.add(name)
    members.push({ name, emoji: pick(MOB_EMOJIS) })
  }
  return members
}

/** 小怪互动：动作为【绝对主体】(melee 直接打成波)，只【偶尔】穿插知识题/社交/损人。Boss 必用知识。
 *  知识更多来自玩家主动放「学霸大招」(答对学科题)，所以题怪要稀，别一直弹题。 */
function pickMobMode(): MobMode {
  const r = Math.random()
  if (r < 0.74) return 'melee' // 动作为主：成波直接打（74%）
  if (r < 0.86) return 'question' // 偶尔穿插一道知识题（12%）
  if (r < 0.95) return 'encounter' // 偶尔社交/礼貌互动（9%）
  return 'diss' // 偶尔损人嘴炮（5%）
}

/** 为某一关生成 3~4 个同学小怪步骤 + 1 个 Boss 前的体测挑战。
 *  开局【固定】是一波近战群(3~5 个)，先打个痛快；其余步骤以近战为主、偶尔穿插题/社交/损人。 */
function buildMobs(roster: RosterDef, levelIndex: number): MobStep[] {
  const count = rand(3, 4)
  const names = roster.mobs.length ? roster.mobs : ['同学']
  const steps: MobStep[] = []
  const usedNames = new Set<string>()
  // 开局必是一波近战群（3~5 个），保证一上来就是动作爽感，不会一上来就弹题。
  steps.push(meleeStep(roster, rand(3, 5)))
  for (let i = 1; i < count; i++) {
    const mode = pickMobMode()
    if (mode === 'melee') {
      steps.push(meleeStep(roster)) // 近战群：1~5 个爆米花（偏多个）
      continue
    }
    // 非近战（题目/社交/损人）：单怪。关内不重复取名；名字不够时加序号兜底。
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
      mode,
    })
  }
  // 去掉了 Boss 前的「体测传感器」热身步（手机传感器交互在横版闯关里太突兀、易让人懵），
  // 直接进 Boss。体测玩法代码保留，暂不编排进关卡。
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
