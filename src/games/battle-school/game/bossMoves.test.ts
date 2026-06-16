import { describe, it, expect } from 'vitest'
import { movesForBoss, moveTotalMs, MOVE_POOL } from './bossMoves'
import type { TeacherMove } from './bossMoves'

// 注入一个确定性 pick（取第一个），让选招可复现、可断言。
const pickFirst = <T,>(arr: T[]): T => arr[0]

describe('MOVE_POOL — 设计铁律', () => {
  it('每招 telegraphMs ≥ 500（公平可躲的反应窗口）', () => {
    expect(MOVE_POOL.length).toBeGreaterThan(0)
    for (const m of MOVE_POOL) {
      expect(m.telegraphMs).toBeGreaterThanOrEqual(500)
    }
  })

  it('moveTotalMs = telegraph + active + recover', () => {
    for (const m of MOVE_POOL) {
      expect(moveTotalMs(m)).toBe(m.telegraphMs + m.activeMs + m.recoverMs)
    }
  })
})

describe('movesForBoss', () => {
  it('返回非空', () => {
    const lo = movesForBoss({ band: 'low', pick: pickFirst })
    const hi = movesForBoss({ band: 'high', pick: pickFirst })
    expect(lo.length).toBeGreaterThan(0)
    expect(hi.length).toBeGreaterThan(0)
  })

  it('选出的招互不重复（去重）', () => {
    const moves = movesForBoss({ band: 'high', subject: 'math', pick: pickFirst })
    const ids = new Set(moves.map((m) => m.id))
    expect(ids.size).toBe(moves.length)
  })

  it('low band 通用招少于等于 high band（low 更温和）', () => {
    // 用随机 pick 抹平专属招影响：只比通用招数量
    const rng = (() => {
      let s = 12345
      return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff
        return s / 0x7fffffff
      }
    })()
    const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]
    const genericIds = new Set(MOVE_POOL.filter((m) => !m.subject).map((m) => m.id))
    const countGeneric = (ms: TeacherMove[]) => ms.filter((m) => genericIds.has(m.id)).length
    const lo = countGeneric(movesForBoss({ band: 'low', pick }))
    const hi = countGeneric(movesForBoss({ band: 'high', pick }))
    expect(lo).toBe(2)
    expect(hi).toBe(3)
  })

  it('给定 subject 时补一个该科专属招', () => {
    const moves = movesForBoss({ band: 'low', subject: 'math', pick: pickFirst })
    const mathSpecials = MOVE_POOL.filter((m) => m.subject === 'math').map((m) => m.id)
    expect(moves.some((m) => mathSpecials.includes(m.id))).toBe(true)
  })

  it('subject 无专属招时不强加（仅通用招）', () => {
    // 'life' 没有专属招（专属招只覆盖 math/chinese/english/science/sports）
    const moves = movesForBoss({ band: 'high', subject: 'life', pick: pickFirst })
    expect(moves.every((m) => !m.subject)).toBe(true)
  })

  it('override 按 id 原样取出、保留顺序、过滤未知 id', () => {
    const moves = movesForBoss({
      band: 'high',
      override: ['chalk-throw', 'NOPE', 'desk-slam'],
      pick: pickFirst,
    })
    expect(moves.map((m) => m.id)).toEqual(['chalk-throw', 'desk-slam'])
  })
})
