import { describe, expect, it } from 'vitest'

import { gameSections } from './catalog'

describe('gameSections', () => {
  it('only exposes games that can create a room code', () => {
    const sections = gameSections()
    const allIds = [...sections.main, ...sections.more].map((game) => game.id)

    expect(sections.main.map((game) => game.id)).toEqual([
      'charades',
      'draw',
      'undercover',
      'knowYou',
      'price',
    ])
    expect(sections.main.every((game) => game.supportsRoom)).toBe(true)
    expect(allIds).not.toContain('truthLie')
    expect(allIds).not.toContain('story')
    expect(allIds).not.toContain('dice')
    expect(allIds).not.toContain('sound')
    expect(allIds).not.toContain('memory')
    expect(allIds).not.toContain('shiliuTown')
    expect(allIds).not.toContain('yiyiBureau')
    expect(allIds).not.toContain('knowledgeDuel')
    expect(allIds).not.toContain('battleSchool')
    expect(sections.more).toEqual([])
  })
})
