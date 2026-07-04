import { describe, expect, it } from 'vitest'

import { canStartPriceRemote, parsePositivePriceGuess, remotePricePromptKey } from './remoteRules'

describe('price remote rules', () => {
  it('requires at least three members because the host does not guess', () => {
    expect(canStartPriceRemote(2)).toBe(false)
    expect(canStartPriceRemote(3)).toBe(true)
  })

  it('only accepts price guesses greater than 0', () => {
    expect(parsePositivePriceGuess('0')).toBeNull()
    expect(parsePositivePriceGuess('-1')).toBeNull()
    expect(parsePositivePriceGuess('19.9')).toBe(19.9)
  })

  it('changes the prompt key when the next item arrives', () => {
    expect(remotePricePromptKey(1, '牛奶')).not.toBe(remotePricePromptKey(2, '面包'))
  })
})
