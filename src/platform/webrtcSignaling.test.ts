import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  canHandleSignal,
  canPublishCharadesVideo,
  shouldCreateMeshOffer,
  webRtcPeerId,
  type WebRtcSignal,
} from './webrtcSignaling'

describe('webrtcSignaling', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage())
    vi.stubGlobal('sessionStorage', makeStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ignores signals for another room, from self, or addressed to someone else', () => {
    const base: WebRtcSignal = { room: '1234', from: 'peer-a', t: 'peer', name: 'A' }
    const offer: WebRtcSignal = {
      room: '1234',
      from: 'peer-a',
      to: 'peer-b',
      t: 'offer',
      sdp: { type: 'offer', sdp: 'v=0' },
    }

    expect(canHandleSignal(base, { room: '1234', peerId: 'peer-b' })).toBe(true)
    expect(canHandleSignal({ ...base, room: '9999' }, { room: '1234', peerId: 'peer-b' })).toBe(false)
    expect(canHandleSignal(base, { room: '1234', peerId: 'peer-a' })).toBe(false)
    expect(canHandleSignal({ ...offer, to: 'peer-c' }, { room: '1234', peerId: 'peer-b' })).toBe(false)
    expect(canHandleSignal(offer, { room: '1234', peerId: 'peer-b' })).toBe(true)
  })

  it('only lets non-guessers publish video during an active charades round', () => {
    expect(canPublishCharadesVideo({ roomState: 'playing', mySeat: 2, guesserSeat: 1 })).toBe(true)
    expect(canPublishCharadesVideo({ roomState: 'playing', mySeat: 1, guesserSeat: 1 })).toBe(false)
    expect(canPublishCharadesVideo({ roomState: 'lobby', mySeat: 2, guesserSeat: 1 })).toBe(false)
    expect(canPublishCharadesVideo({ roomState: 'playing', mySeat: undefined, guesserSeat: 1 })).toBe(false)
    expect(canPublishCharadesVideo({ roomState: 'playing', mySeat: 2, guesserSeat: undefined })).toBe(false)
  })

  it('uses a deterministic peer order for mesh audio offers', () => {
    expect(shouldCreateMeshOffer('peer-b', 'peer-a')).toBe(true)
    expect(shouldCreateMeshOffer('peer-a', 'peer-b')).toBe(false)
    expect(shouldCreateMeshOffer('peer-a', 'peer-a')).toBe(false)
  })

  it('does not reuse the old localStorage peer id shared by every tab', () => {
    localStorage.setItem('fg:rtc-peer', 'shared-between-tabs')
    sessionStorage.removeItem('fg:rtc-peer')

    expect(webRtcPeerId()).not.toBe('shared-between-tabs')
  })
})

function makeStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}
