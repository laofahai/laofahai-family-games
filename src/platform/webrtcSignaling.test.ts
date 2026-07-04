import { describe, expect, it } from 'vitest'

import {
  canHandleSignal,
  canPublishCharadesVideo,
  shouldCreateMeshOffer,
  type WebRtcSignal,
} from './webrtcSignaling'

describe('webrtcSignaling', () => {
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
})
