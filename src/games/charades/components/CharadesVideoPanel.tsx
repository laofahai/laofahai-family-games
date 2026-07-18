import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Play, Radio, Video, VideoOff } from 'lucide-react'
import type { LocalVideoTrack, RemoteParticipant, RemoteTrack, Room } from 'livekit-client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { liveKitTokenRpc } from '@/platform/cloud'
import { mediaPermissionErrorMessage } from '@/platform/mediaError'
import { deviceToken } from '@/platform/rooms'
import { canPublishCharadesVideo } from '@/platform/webrtcSignaling'

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
  const [isPublishing, setIsPublishing] = useState(false)
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false)
  const [presenterName, setPresenterName] = useState('')
  const [status, setStatus] = useState('等待有人开启视频表演')
  const [error, setError] = useState('')
  const [playbackBlocked, setPlaybackBlocked] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const roomRef = useRef<Room | null>(null)
  const localTrackRef = useRef<LocalVideoTrack | null>(null)
  const remoteTrackRef = useRef<RemoteTrack | null>(null)
  const remoteParticipantRef = useRef<string | null>(null)
  const canPublish = canPublishCharadesVideo({ roomState, mySeat, guesserSeat })

  const playRemoteVideo = useCallback(async () => {
    const video = remoteVideoRef.current
    if (!video) return
    try {
      await video.play()
      setPlaybackBlocked(false)
    } catch {
      setPlaybackBlocked(true)
    }
  }, [])

  const detachRemoteVideo = useCallback(() => {
    const video = remoteVideoRef.current
    if (remoteTrackRef.current && video) remoteTrackRef.current.detach(video)
    remoteTrackRef.current = null
    remoteParticipantRef.current = null
    setHasRemoteVideo(false)
    setPresenterName('')
    setStatus('等待有人开启视频表演')
  }, [])

  const attachRemoteVideo = useCallback((track: RemoteTrack, participant: RemoteParticipant) => {
    if (track.kind !== 'video') return
    const video = remoteVideoRef.current
    if (!video) return
    if (remoteTrackRef.current && remoteTrackRef.current !== track) {
      remoteTrackRef.current.detach(video)
    }
    remoteTrackRef.current = track
    remoteParticipantRef.current = participant.identity
    track.attach(video)
    setHasRemoteVideo(true)
    setPresenterName(participant.name || '家人')
    setStatus('视频已连接')
    setPlaybackBlocked(false)
    void playRemoteVideo()
  }, [playRemoteVideo])

  const disconnect = useCallback(() => {
    if (localTrackRef.current && localVideoRef.current) localTrackRef.current.detach(localVideoRef.current)
    localTrackRef.current = null
    detachRemoteVideo()
    roomRef.current?.disconnect()
    roomRef.current = null
    setIsPublishing(false)
  }, [detachRemoteVideo])

  useEffect(() => {
    if (roomState !== 'playing') return
    let canceled = false
    const connect = async () => {
      setError('')
      setStatus('正在连接视频房...')
      try {
        const join = await liveKitTokenRpc(code, deviceToken(), 'charades')
        if (!join?.ok || !join.url || !join.token) {
          setStatus('视频服务还没连上')
          return
        }
        const { Room, RoomEvent } = await import('livekit-client')
        if (canceled) return
        const room = new Room({ adaptiveStream: true, dynacast: true })
        roomRef.current = room
        room
          .on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
            attachRemoteVideo(track, participant)
          })
          .on(RoomEvent.TrackUnsubscribed, (track) => {
            if (remoteTrackRef.current === track) detachRemoteVideo()
          })
          .on(RoomEvent.ParticipantDisconnected, (participant) => {
            if (participant.identity === remoteParticipantRef.current) detachRemoteVideo()
          })
          .on(RoomEvent.Disconnected, () => {
            roomRef.current = null
            detachRemoteVideo()
            setIsPublishing(false)
          })
        await room.connect(join.url, join.token)
        try {
          await room.localParticipant.setName(myName || '玩家')
        } catch {
          // Token 里已有名字；没有权限更新时忽略。
        }
        setStatus('等待有人开启视频表演')
      } catch {
        if (!canceled) setStatus('视频连接失败，可以退出后重进')
      }
    }
    void connect()
    return () => {
      canceled = true
      disconnect()
    }
  }, [attachRemoteVideo, code, detachRemoteVideo, disconnect, myName, roomState])

  useEffect(() => {
    if (!canPublish && isPublishing) {
      void stopPublishing()
      setStatus('轮到你猜时会自动关闭摄像头')
    }
  }, [canPublish, isPublishing])

  const startPublishing = async () => {
    setError('')
    if (!canPublish) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('这个浏览器不支持摄像头')
      return
    }
    try {
      const room = roomRef.current
      if (!room) {
        setError('视频房还没连上，稍后再试')
        return
      }
      const publication = await room.localParticipant.setCameraEnabled(true)
      const track = publication?.videoTrack
      if (track && localVideoRef.current) {
        localTrackRef.current = track
        track.attach(localVideoRef.current)
      }
      setIsPublishing(true)
      setStatus('你正在用摄像头表演')
    } catch (e) {
      setError(mediaPermissionErrorMessage('camera', e))
    }
  }

  const stopPublishing = async () => {
    try {
      await roomRef.current?.localParticipant.setCameraEnabled(false)
    } finally {
      if (localTrackRef.current && localVideoRef.current) localTrackRef.current.detach(localVideoRef.current)
      localTrackRef.current = null
      setIsPublishing(false)
      setStatus('已关闭视频')
    }
  }

  if (roomState !== 'playing') return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink-950 text-white">
      <video
        ref={remoteVideoRef}
        autoPlay
        muted
        playsInline
        onLoadedMetadata={() => void playRemoteVideo()}
        className={cn('absolute inset-0 h-full w-full object-cover', !hasRemoteVideo && 'hidden')}
      />
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className={cn('absolute inset-0 h-full w-full object-cover', (hasRemoteVideo || !isPublishing) && 'hidden')}
      />
      {!hasRemoteVideo && !isPublishing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-950 px-8 text-center text-white/75">
          <Video className="h-12 w-12 text-white/60" />
          <div className="text-base font-semibold">{status}</div>
          {presenterName && <div className="text-xs text-white/60">{presenterName} 正在连接</div>}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 via-black/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/65 to-transparent" />

      <div className="relative z-10 flex h-[100dvh] min-h-0 flex-col p-3 sm:p-5">
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
              onClick={isPublishing ? () => void stopPublishing() : () => void startPublishing()}
              className={cn(
                'min-h-10 gap-1.5 whitespace-normal border-white/40 bg-black/50 text-xs leading-tight text-white shadow-lg backdrop-blur hover:bg-black/60 sm:text-sm',
                !isPublishing && 'bg-orange-500 text-white hover:bg-orange-600'
              )}
            >
              {isPublishing ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
              {isPublishing ? '关闭摄像头' : '开启摄像头'}
            </Button>
          )}
        </div>

        {error && (
          <p className="max-w-xl shrink-0 rounded-2xl bg-rose-950/80 px-3 py-2 text-sm text-rose-100 shadow-lg backdrop-blur">
            {error}
          </p>
        )}

        {playbackBlocked && hasRemoteVideo && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-6">
            <Button
              type="button"
              onClick={() => void playRemoteVideo()}
              className="min-h-14 gap-2 rounded-full bg-white px-5 text-base font-semibold text-ink-900 shadow-2xl hover:bg-white/90"
            >
              <Play className="h-5 w-5" />
              播放视频
            </Button>
          </div>
        )}

        {topOverlay && <div className="pointer-events-none mx-auto mt-3 w-full max-w-xl shrink-0">{topOverlay}</div>}

        <div className="flex-1" />
        <div className="mx-auto w-full max-w-5xl shrink pb-[calc(env(safe-area-inset-bottom)+0.25rem)]">
          {children}
        </div>
      </div>
    </div>
  )
}
