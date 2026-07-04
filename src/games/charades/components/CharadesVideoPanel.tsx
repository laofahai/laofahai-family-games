import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Radio, Video, VideoOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { mediaPermissionErrorMessage } from '@/platform/mediaError'
import { joinWebRtcSignalChannel, type WebRtcSignalChannel } from '@/platform/webrtcSignalChannel'
import {
  canPublishCharadesVideo,
  webRtcPeerId,
  type WebRtcSignalBody,
  type WebRtcSignal,
} from '@/platform/webrtcSignaling'

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

interface CharadesVideoPanelProps {
  code: string
  roomState: string
  mySeat: number | undefined
  guesserSeat: number | undefined
  myName: string
  topOverlay?: ReactNode
  children?: ReactNode
}

export function CharadesVideoPanel({
  code,
  roomState,
  mySeat,
  guesserSeat,
  myName,
  topOverlay,
  children,
}: CharadesVideoPanelProps) {
  const peerId = useMemo(() => webRtcPeerId(), [])
  const [isPublishing, setIsPublishing] = useState(false)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [presenterName, setPresenterName] = useState('')
  const [status, setStatus] = useState('等待有人开启视频表演')
  const [error, setError] = useState('')

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<WebRtcSignalChannel | null>(null)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const presenterRef = useRef<string | null>(null)
  const publishingRef = useRef(false)
  const canPublish = canPublishCharadesVideo({ roomState, mySeat, guesserSeat })
  const roomKey = `charades-video:${code}`

  const send = (msg: WebRtcSignalBody) => {
    channelRef.current?.send({ room: roomKey, from: peerId, ...msg } as WebRtcSignal)
  }

  const closePeer = (id: string) => {
    peersRef.current.get(id)?.close()
    peersRef.current.delete(id)
  }

  const clearRemote = () => {
    presenterRef.current = null
    remoteStreamRef.current = null
    setRemoteStream(null)
    setPresenterName('')
    setStatus('等待有人开启视频表演')
  }

  const stopLocalTracks = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    if (localVideoRef.current) localVideoRef.current.srcObject = null
  }

  const closeAllPeers = () => {
    peersRef.current.forEach((pc) => pc.close())
    peersRef.current.clear()
  }

  const makePeer = (remotePeer: string) => {
    closePeer(remotePeer)
    const pc = new RTCPeerConnection(RTC_CONFIG)
    peersRef.current.set(remotePeer, pc)

    localStreamRef.current?.getTracks().forEach((track) => {
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
      if (!stream) return
      remoteStreamRef.current = stream
      setRemoteStream(stream)
      setStatus('视频已连接')
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setStatus('视频连接不稳定，可以重新开启一次')
      }
    }

    return pc
  }

  const answerOffer = async (msg: Extract<WebRtcSignal, { t: 'offer' }>) => {
    presenterRef.current = msg.from
    const pc = makePeer(msg.from)
    await pc.setRemoteDescription(msg.sdp)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    send({ t: 'answer', to: msg.from, sdp: answer })
  }

  const createOffer = async (to: string) => {
    if (!publishingRef.current) return
    const pc = makePeer(to)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send({ t: 'offer', to, sdp: offer })
  }

  const handleSignal = async (msg: WebRtcSignal) => {
    try {
      if (msg.t === 'presenter') {
        if (publishingRef.current) return
        setPresenterName(msg.name)
        setStatus('正在连接视频...')
        if (presenterRef.current !== msg.from || !remoteStreamRef.current) {
          presenterRef.current = msg.from
          send({ t: 'watch', to: msg.from, name: myName || '玩家' })
        }
        return
      }

      if (msg.t === 'watch') {
        await createOffer(msg.from)
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
        return
      }

      if (msg.t === 'presenter-left' && presenterRef.current === msg.from) {
        closePeer(msg.from)
        clearRemote()
      }
    } catch {
      setStatus('视频连接失败，可以重新开启一次')
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
      stopLocalTracks()
      closeAllPeers()
    }
    // handleSignal intentionally reads live refs/state; reconnect only when room identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey, peerId])

  useEffect(() => {
    publishingRef.current = isPublishing
  }, [isPublishing])

  useEffect(() => {
    remoteStreamRef.current = remoteStream
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
  }, [remoteStream])

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current
  }, [isPublishing])

  useEffect(() => {
    if (!isPublishing) return
    const announce = () => send({ t: 'presenter', name: myName || '玩家' })
    announce()
    const timer = window.setInterval(announce, 2500)
    return () => window.clearInterval(timer)
    // send is intentionally bound to current channel; announcing tolerates one missed tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublishing, myName])

  useEffect(() => {
    if (!canPublish && isPublishing) {
      send({ t: 'presenter-left' })
      stopLocalTracks()
      closeAllPeers()
      setIsPublishing(false)
      setStatus('轮到你猜时会自动关闭摄像头')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPublish, isPublishing])

  const startPublishing = async () => {
    setError('')
    if (!canPublish) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('这个浏览器不支持摄像头或麦克风直连')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      })
      localStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      setIsPublishing(true)
      setStatus('你正在用摄像头和麦克风表演')
    } catch (e) {
      setError(mediaPermissionErrorMessage('cameraOrMicrophone', e))
    }
  }

  const stopPublishing = () => {
    send({ t: 'presenter-left' })
    stopLocalTracks()
    closeAllPeers()
    setIsPublishing(false)
    setStatus('已关闭视频')
  }

  if (roomState !== 'playing') return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink-950 text-white">
      {remoteStream ? (
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : isPublishing ? (
        <video ref={localVideoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-950 px-8 text-center text-white/75">
          <Video className="h-12 w-12 text-white/60" />
          <div className="text-base font-semibold">{status}</div>
          {presenterName && <div className="text-xs text-white/60">{presenterName} 正在连接</div>}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/75 via-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[46vh] bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

      <div className="relative z-10 flex h-[100dvh] min-h-0 flex-col gap-3 p-3 sm:p-5">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div className="inline-flex min-h-10 items-center gap-2 rounded-full bg-black/50 px-3 text-sm font-semibold text-white shadow-lg backdrop-blur">
            <Radio className="h-4 w-4 text-orange-300" />
            <span>{isPublishing ? '你正在表演' : '表演视频'}</span>
          </div>
          {canPublish && (
            <Button
              type="button"
              size="sm"
              variant={isPublishing ? 'outline' : 'default'}
              onClick={isPublishing ? stopPublishing : startPublishing}
              className={cn(
                'min-h-10 gap-1.5 whitespace-normal border-white/40 bg-black/50 text-xs leading-tight text-white shadow-lg backdrop-blur hover:bg-black/60 sm:text-sm',
                !isPublishing && 'bg-orange-500 text-white hover:bg-orange-600'
              )}
            >
              {isPublishing ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
              {isPublishing ? '关闭摄像头/麦克风' : '开启摄像头/麦克风'}
            </Button>
          )}
        </div>

        {error && (
          <p className="max-w-xl shrink-0 rounded-2xl bg-rose-950/80 px-3 py-2 text-sm text-rose-100 shadow-lg backdrop-blur">
            {error}
          </p>
        )}

        {topOverlay && <div className="mx-auto w-full max-w-2xl shrink-0">{topOverlay}</div>}

        <div className="min-h-3 flex-1" />
        <div className="mx-auto min-h-0 max-h-[58dvh] w-full max-w-5xl shrink overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {children}
        </div>
      </div>
    </div>
  )
}
