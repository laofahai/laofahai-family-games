import { supabase } from './supabase'
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
  const sb = supabase
  if (!sb) return { send: () => {}, leave: () => {} }

  const ch = sb.channel(`webrtc:${room}`, { config: { broadcast: { self: false } } })
  ch.on('broadcast', { event: 'signal' }, (e: { payload: unknown }) => {
    const msg = e.payload as WebRtcSignal
    if (canHandleSignal(msg, { room, peerId })) onMessage(msg)
  }).subscribe()

  return {
    send: (msg) => {
      void ch.send({ type: 'broadcast', event: 'signal', payload: msg })
    },
    leave: () => {
      void sb.removeChannel(ch)
    },
  }
}
