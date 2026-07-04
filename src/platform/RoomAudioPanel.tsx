import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { joinWebRtcSignalChannel, type WebRtcSignalChannel } from './webrtcSignalChannel'
import { shouldCreateMeshOffer, webRtcPeerId, type WebRtcSignal, type WebRtcSignalBody } from './webrtcSignaling'

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

interface RemoteAudioPeer {
  id: string
  name: string
  stream: MediaStream
}

interface RoomAudioPanelProps {
  code: string
  roomState: string
  myName: string
}

export function RoomAudioPanel({ code, roomState, myName }: RoomAudioPanelProps) {
  const peerId = useMemo(() => webRtcPeerId(), [])
  const [joined, setJoined] = useState(false)
  const [muted, setMuted] = useState(false)
  const [status, setStatus] = useState('语音未开启')
  const [error, setError] = useState('')
  const [remotePeers, setRemotePeers] = useState<RemoteAudioPeer[]>([])

  const channelRef = useRef<WebRtcSignalChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const namesRef = useRef<Map<string, string>>(new Map())
  const joinedRef = useRef(false)
  const roomKey = `audio:${code}`

  const send = (msg: WebRtcSignalBody) => {
    channelRef.current?.send({ room: roomKey, from: peerId, ...msg } as WebRtcSignal)
  }

  const replaceRemotePeer = (id: string, stream: MediaStream) => {
    setRemotePeers((prev) => {
      const name = namesRef.current.get(id) ?? '家人'
      const existing = prev.find((peer) => peer.id === id)
      if (existing?.stream === stream && existing.name === name) return prev
      return [...prev.filter((peer) => peer.id !== id), { id, name, stream }]
    })
  }

  const removeRemotePeer = (id: string) => {
    setRemotePeers((prev) => prev.filter((peer) => peer.id !== id))
  }

  const closePeer = (id: string) => {
    peersRef.current.get(id)?.close()
    peersRef.current.delete(id)
    removeRemotePeer(id)
  }

  const closeAllPeers = () => {
    peersRef.current.forEach((pc) => pc.close())
    peersRef.current.clear()
    setRemotePeers([])
  }

  const makePeer = (remotePeer: string) => {
    const existing = peersRef.current.get(remotePeer)
    if (existing) return existing

    const pc = new RTCPeerConnection(RTC_CONFIG)
    peersRef.current.set(remotePeer, pc)

    localStreamRef.current?.getAudioTracks().forEach((track) => {
      const stream = localStreamRef.current
      if (stream) pc.addTrack(track, stream)
    })

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        send({ t: 'candidate', to: remotePeer, candidate: event.candidate.toJSON() })
      }
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams
      if (stream) replaceRemotePeer(remotePeer, stream)
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setStatus('语音连接不稳定，可退出后重进')
      }
      if (pc.connectionState === 'connected') setStatus('语音已连接')
    }

    return pc
  }

  const createOffer = async (to: string) => {
    if (!joinedRef.current) return
    const pc = makePeer(to)
    if (pc.signalingState !== 'stable') return
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send({ t: 'offer', to, sdp: offer })
  }

  const answerOffer = async (msg: Extract<WebRtcSignal, { t: 'offer' }>) => {
    if (!joinedRef.current) return
    const pc = makePeer(msg.from)
    await pc.setRemoteDescription(msg.sdp)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    send({ t: 'answer', to: msg.from, sdp: answer })
  }

  const handleSignal = async (msg: WebRtcSignal) => {
    try {
      if (msg.t === 'peer') {
        namesRef.current.set(msg.from, msg.name)
        setRemotePeers((prev) =>
          prev.map((peer) => (peer.id === msg.from ? { ...peer, name: msg.name } : peer))
        )
        if (joinedRef.current && shouldCreateMeshOffer(peerId, msg.from)) await createOffer(msg.from)
        return
      }

      if (msg.t === 'peer-left') {
        closePeer(msg.from)
        namesRef.current.delete(msg.from)
        return
      }

      if (msg.t === 'offer') {
        await answerOffer(msg)
        return
      }

      if (msg.t === 'answer') {
        await peersRef.current.get(msg.from)?.setRemoteDescription(msg.sdp)
        return
      }

      if (msg.t === 'candidate') {
        await peersRef.current.get(msg.from)?.addIceCandidate(msg.candidate)
      }
    } catch {
      setStatus('语音连接失败，可退出后重进')
    }
  }

  useEffect(() => {
    const ch = joinWebRtcSignalChannel(roomKey, peerId, (msg) => {
      void handleSignal(msg)
    })
    channelRef.current = ch
    return () => {
      ch.leave()
      channelRef.current = null
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
      closeAllPeers()
    }
    // handleSignal intentionally reads live refs/state; reconnect only when room identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey, peerId])

  useEffect(() => {
    joinedRef.current = joined
  }, [joined])

  useEffect(() => {
    if (!joined) return
    const announce = () => send({ t: 'peer', name: myName || '玩家' })
    announce()
    const timer = window.setInterval(announce, 2500)
    return () => window.clearInterval(timer)
    // send is intentionally bound to current channel; announcing tolerates one missed tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, myName])

  const joinAudio = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('这个浏览器不支持语音直连')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !muted
      })
      setJoined(true)
      setStatus('语音已开启，正在连接其他人')
    } catch {
      setError('麦克风没有授权')
    }
  }

  const leaveAudio = () => {
    send({ t: 'peer-left' })
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    closeAllPeers()
    setJoined(false)
    setMuted(false)
    setStatus('语音已退出')
  }

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next
    })
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Volume2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold">房间语音</div>
            <div className="text-xs leading-relaxed text-emerald-700">
              {roomState === 'lobby' ? '人到齐前可以先连语音。' : status}
              {joined && remotePeers.length > 0 && ` 已听到 ${remotePeers.length} 人。`}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {joined ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={toggleMute} className="gap-1.5">
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {muted ? '取消静音' : '静音'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={leaveAudio} className="gap-1.5 text-emerald-800">
                <PhoneOff className="h-4 w-4" />
                退出语音
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" onClick={joinAudio} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
              <Phone className="h-4 w-4" />
              加入语音
            </Button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="sr-only" aria-live="polite">
        {status}
      </div>
      {remotePeers.map((peer) => (
        <RemoteAudio key={peer.id} stream={peer.stream} />
      ))}
    </div>
  )
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])

  return (
    <audio ref={ref} autoPlay playsInline>
      <track kind="captions" />
    </audio>
  )
}
