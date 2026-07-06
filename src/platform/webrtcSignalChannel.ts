import { joinRecordChannel } from './pocketbase'
import { canHandleSignal, type WebRtcSignal } from './webrtcSignaling'

export interface WebRtcSignalChannel {
  send: (msg: WebRtcSignal) => void
  leave: () => void
}

export function joinWebRtcSignalChannel(
  room: string,
  peerId: string,
  onMessage: (msg: WebRtcSignal) => void
): WebRtcSignalChannel {
  return joinRecordChannel({
    kind: 'webrtc',
    room,
    event: 'signal',
    sender: peerId,
    ttlSeconds: 120,
    onMessage: (payload) => {
      const msg = payload as WebRtcSignal
      if (canHandleSignal(msg, { room, peerId })) onMessage(msg)
    },
  })
}
