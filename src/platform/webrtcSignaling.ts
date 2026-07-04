const PEER_KEY = 'fg:rtc-peer'

export type WebRtcSignal =
  | { t: 'peer'; room: string; from: string; name: string }
  | { t: 'peer-left'; room: string; from: string }
  | { t: 'presenter'; room: string; from: string; name: string }
  | { t: 'watch'; room: string; from: string; to: string; name: string }
  | { t: 'offer'; room: string; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { t: 'answer'; room: string; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { t: 'candidate'; room: string; from: string; to: string; candidate: RTCIceCandidateInit }
  | { t: 'presenter-left'; room: string; from: string }

export type WebRtcSignalBody = WebRtcSignal extends infer T
  ? T extends WebRtcSignal
    ? Omit<T, 'room' | 'from'>
    : never
  : never

export function canHandleSignal(
  msg: WebRtcSignal,
  opts: { room: string; peerId: string }
): boolean {
  if (msg.room !== opts.room) return false
  if (msg.from === opts.peerId) return false
  return !('to' in msg) || msg.to === opts.peerId
}

export function canPublishCharadesVideo(opts: {
  roomState: string
  mySeat: number | undefined
  guesserSeat: number | undefined
}): boolean {
  return opts.roomState === 'playing' && opts.mySeat != null && opts.guesserSeat != null && opts.mySeat !== opts.guesserSeat
}

export function shouldCreateMeshOffer(localPeerId: string, remotePeerId: string): boolean {
  return localPeerId > remotePeerId
}

export function webRtcPeerId(): string {
  try {
    const existing = localStorage.getItem(PEER_KEY)
    if (existing) return existing
  } catch {
    /* ignore blocked storage */
  }

  const next =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `peer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`

  try {
    localStorage.setItem(PEER_KEY, next)
  } catch {
    /* session-only identity is still enough for one call */
  }
  return next
}
