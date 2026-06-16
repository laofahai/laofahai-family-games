import { describe, it, expect } from 'vitest'
import {
  makeFighter,
  resolveAnswer,
  applyDamage,
  isDown,
  hpPct,
  DEFAULT_DAMAGE,
  subjectLabel,
  subjectEmoji,
} from './core'

describe('resolveAnswer — 作答结算', () => {
  const { base, critEvery, critMul } = DEFAULT_DAMAGE

  it('答对：target=enemy，非暴击时 base 伤害、crit=false', () => {
    // streakBefore=0 → newStreak=1，不是 critEvery 倍数
    const r = resolveAnswer(true, 0)
    expect(r.target).toBe('enemy')
    expect(r.crit).toBe(false)
    expect(r.damage).toBe(base)
  })

  it('答对：连对凑到 critEvery 倍数时 crit=true、damage=base*critMul', () => {
    // streakBefore=2 → newStreak=3，3 % 3 === 0 → crit
    const r = resolveAnswer(true, critEvery - 1)
    expect(r.target).toBe('enemy')
    expect(r.crit).toBe(true)
    expect(r.damage).toBe(base * critMul)
  })

  it('答对：critEvery 的整数倍连对点都触发暴击', () => {
    for (let k = 1; k <= 5; k++) {
      const streakBefore = critEvery * k - 1 // newStreak = critEvery*k
      const r = resolveAnswer(true, streakBefore)
      expect(r.crit).toBe(true)
      expect(r.damage).toBe(base * critMul)
    }
  })

  it('答对：非倍数连对点不暴击', () => {
    for (let newStreak = 1; newStreak <= 12; newStreak++) {
      if (newStreak % critEvery === 0) continue
      const r = resolveAnswer(true, newStreak - 1)
      expect(r.crit).toBe(false)
      expect(r.damage).toBe(base)
    }
  })

  it('答错：target=self、base 伤害、crit=false（与连对无关）', () => {
    for (const streak of [0, 2, 5, 8]) {
      const r = resolveAnswer(false, streak)
      expect(r.target).toBe('self')
      expect(r.crit).toBe(false)
      expect(r.damage).toBe(base)
    }
  })

  it('自定义 DamagePlan 生效', () => {
    const plan = { base: 10, critEvery: 2, critMul: 3 }
    const noCrit = resolveAnswer(true, 0, plan) // newStreak=1
    expect(noCrit).toEqual({ damage: 10, crit: false, target: 'enemy' })
    const crit = resolveAnswer(true, 1, plan) // newStreak=2
    expect(crit).toEqual({ damage: 30, crit: true, target: 'enemy' })
  })

  it('critEvery=0 时永不暴击（防御除零/取模异常）', () => {
    const plan = { base: 5, critEvery: 0, critMul: 9 }
    for (let s = 0; s < 10; s++) {
      const r = resolveAnswer(true, s, plan)
      expect(r.crit).toBe(false)
      expect(r.damage).toBe(5)
    }
  })
})

describe('applyDamage / isDown / hpPct', () => {
  it('applyDamage 不会让 hp < 0', () => {
    const f = makeFighter('t', '老师', '🧑‍🏫', 5)
    const after = applyDamage(f, 100)
    expect(after.hp).toBe(0)
    expect(after.hp).toBeGreaterThanOrEqual(0)
    expect(after.maxHp).toBe(5) // maxHp 不变
  })

  it('applyDamage 正常扣血、不改原对象（纯）', () => {
    const f = makeFighter('t', '老师', '🧑‍🏫', 10)
    const after = applyDamage(f, 3)
    expect(after.hp).toBe(7)
    expect(f.hp).toBe(10) // 原对象不被修改
  })

  it('isDown 在 hp<=0 为真，否则为假', () => {
    expect(isDown(makeFighter('a', 'A', '🙂', 0))).toBe(true)
    expect(isDown(applyDamage(makeFighter('a', 'A', '🙂', 3), 5))).toBe(true)
    expect(isDown(makeFighter('a', 'A', '🙂', 1))).toBe(false)
  })

  it('hpPct 边界：满血 100、空血 0、半血四舍五入', () => {
    expect(hpPct(makeFighter('a', 'A', '🙂', 50))).toBe(100) // 满血
    expect(hpPct(applyDamage(makeFighter('a', 'A', '🙂', 50), 50))).toBe(0) // 空血
    expect(hpPct(applyDamage(makeFighter('a', 'A', '🙂', 50), 25))).toBe(50) // 半血
    expect(hpPct(applyDamage(makeFighter('a', 'A', '🙂', 3), 1))).toBe(67) // 2/3 → 67
  })

  it('hpPct 在 maxHp=0 时安全返回 0（不 NaN）', () => {
    const f = makeFighter('a', 'A', '🙂', 0)
    expect(hpPct(f)).toBe(0)
  })
})

describe('subject 元信息', () => {
  it('已知 subject 返回中文标签与图标', () => {
    expect(subjectLabel('math')).toBe('数学')
    expect(subjectEmoji('math')).toBe('➗')
  })

  it('未知 subject 回退原值与默认图标', () => {
    expect(subjectLabel('unknown')).toBe('unknown')
    expect(subjectEmoji('unknown')).toBe('❓')
  })
})
