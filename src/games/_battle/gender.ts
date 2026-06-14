// 性别契约：从云端名册（数据库 profiles，见 platform/cloudRoster）读取——是「数据」，
// 不再是代码里硬编码的判断表/启发式。名册里没有该名字时（如临时访客）才用名字哈希兜底，
// 保证同名恒定、整班男女混合。导出签名保持稳定，游戏侧（精灵/名牌）直接调。

import { rosterByName, rosterById } from '@/platform/cloudRoster'

export type Gender = 'male' | 'female'

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/** 按名字取性别：优先读数据库名册，没有则名字哈希兜底（同名恒定）。 */
export function genderOf(name: string): Gender {
  const g = rosterByName(name)?.gender
  if (g === 'male' || g === 'female') return g
  return hashStr(name) % 2 === 0 ? 'female' : 'male'
}

/** 按玩家 id 取性别（主角形象用）：优先读数据库名册（按 id 或名字），否则按名字判定。 */
export function playerGenderOf(playerId: string, playerName?: string): Gender {
  const g = rosterById(playerId)?.gender ?? (playerName ? rosterByName(playerName)?.gender : undefined)
  if (g === 'male' || g === 'female') return g
  return playerName ? genderOf(playerName) : 'male'
}
