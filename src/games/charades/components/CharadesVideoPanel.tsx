import { useEffect, useMemo, useRef, useState } from 'react'
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
}

export function CharadesVideoPanel({
  code,
  roomState,
  mySeat,
  guesserSeat,
  myName,
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
      setError('这个浏览器不支持摄像头直连')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      localStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      setIsPublishing(true)
      setStatus('你正在视频表演')
    } catch (e) {
      setError(mediaPermissionErrorMessage('camera', e))
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
    <div className="space-y-3 rounded-3xl border border-orange-100 bg-orange-50/60 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-orange-800">
          <Radio className="h-4 w-4" />
          视频表演
        </div>
        {canPublish && (
          <Button
            type="button"
            size="sm"
            variant={isPublishing ? 'outline' : 'default'}
            onClick={isPublishing ? stopPublishing : startPublishing}
            className={cn('gap-1.5', !isPublishing && 'bg-orange-500 text-white hover:bg-orange-600')}
          >
            {isPublishing ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            {isPublishing ? '关闭视频' : '开启视频表演'}
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="relative min-h-[210px] overflow-hidden rounded-2xl bg-ink-950">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full min-h-[210px] w-full object-cover"
            />
          ) : (
            <div className="flex min-h-[210px] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-white/75">
              <Video className="h-8 w-8 text-white/60" />
              <span>{isPublishing ? '等其他人接入观看...' : status}</span>
              {presenterName && <span className="text-xs text-white/55">{presenterName} 正在连接</span>}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="overflow-hidden rounded-2xl border border-white/80 bg-white">
            {isPublishing ? (
              <video ref={localVideoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
            ) : (
              <div className="flex aspect-video items-center justify-center px-3 text-center text-xs text-ink-500">
                {canPublish ? '你可以开摄像头表演' : '轮到你猜，不能看到题词'}
              </div>
            )}
          </div>
          <p className="text-xs leading-relaxed text-orange-700">
            {canPublish ? '开视频后给猜的人比划，别说出词本身。' : '看别人比划，猜出来就大声说。'}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}
    </div>
  )
}
