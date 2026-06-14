// 性别契约：游戏按性别选男/女精灵、配名字用。两路 agent 共用——
//   · G(游戏) 只 import，不改本文件。
//   · P(平台) 可改本实现（比如把性别真值接到 profiles/people），但**保持下面两个导出的签名不变**。
// 现策略：家人/老师显式表 + 中文名用字启发式 + 名字哈希兜底。保证「同名稳定 + 整班男女混合」。

export type Gender = 'male' | 'female'

/** 显式覆盖（启发式难判或须确定的）：家人 + 已知老师。 */
const OVERRIDE_BY_NAME: Record<string, Gender> = {
  闫一依: 'female', 闫顺儿: 'female', 妈妈: 'female', 爸爸: 'male',
  张超越: 'male', 郑老师: 'female', 台老师: 'female', 朱老师: 'female', 陈老师: 'female', 科学老师: 'male',
}

/** 按玩家 id 的显式性别（决定主角用男/女精灵）。 */
const OVERRIDE_BY_ID: Record<string, Gender> = {
  yiyi: 'female', shuner: 'female', mom: 'female', dad: 'male',
}

// 偏女 / 偏男 的常见用字（取强信号字，模糊的留给哈希）。
const FEMALE_CHARS = new Set(
  '美晴怡语欣宣潼月淇韵蓉若悦清澄菲静茹依彤馨瑾萱桐雯凤妍颖玥婷雅琳娜蕊媛钰丽娟瑶璐茜薇可'.split(''),
)
const MALE_CHARS = new Set(
  '皓凯越凡轩昊聪辰骏哲浩坤睿洋博柏旋杰锋鹏豪航铭润强伟磊勇刚帆翔泽栋'.split(''),
)

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/** 按名字判性别：显式表 → 用字启发式 → 哈希兜底（同名恒定，整班混合）。 */
export function genderOf(name: string): Gender {
  const o = OVERRIDE_BY_NAME[name]
  if (o) return o
  let f = 0
  let m = 0
  for (const ch of name) {
    if (FEMALE_CHARS.has(ch)) f++
    if (MALE_CHARS.has(ch)) m++
  }
  if (f !== m) return f > m ? 'female' : 'male'
  return hashStr(name) % 2 === 0 ? 'female' : 'male'
}

/** 按玩家 id 判性别（主角精灵用）：显式表优先，未知按名字/哈希。 */
export function playerGenderOf(playerId: string, playerName?: string): Gender {
  return OVERRIDE_BY_ID[playerId] ?? (playerName ? genderOf(playerName) : 'male')
}
