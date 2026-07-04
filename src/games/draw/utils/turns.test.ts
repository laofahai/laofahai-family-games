import { describe, expect, it } from 'vitest'
import { nextDrawerSeat, roundAfterWordSwap } from './turns'

describe('remote draw turn helpers', () => {
  it('keeps the same round when the host swaps the word', () => {
    expect(roundAfterWordSwap(3)).toBe(3)
  })

  it('chooses the seat after the current drawer instead of deriving from round count', () => {
    const members = [{ seat: 1 }, { seat: 2 }, { seat: 3 }]

    expect(nextDrawerSeat(members, 1)).toBe(2)
    expect(nextDrawerSeat(members, 2)).toBe(3)
    expect(nextDrawerSeat(members, 3)).toBe(1)
  })
})
