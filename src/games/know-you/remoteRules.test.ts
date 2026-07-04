import { describe, expect, it } from 'vitest'

import { remoteKnowYouPromptKey } from './remoteRules'

describe('know-you remote rules', () => {
  it('changes the prompt key when the next question arrives', () => {
    expect(remoteKnowYouPromptKey(1, '爸爸最爱吃什么？')).not.toBe(
      remoteKnowYouPromptKey(2, '妈妈最怕什么？'),
    )
  })
})
