import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from 'lucide-react'
import type { Room, RemoteParticipant, RemoteTrack } from 'livekit-client'

import { Button } from '@/components/ui/button'
import { liveKitTokenRpc } from './cloud'
import { mediaPermissionErrorMessage } from './mediaError'
import { roomAudioStatusText } from './roomAudioStatus'
import { deviceToken } from './rooms'

interface RemoteAudioTrack {
  id: string
  name: string
  track: RemoteTrack
}

interface RoomAudioPanelProps {
  code: string
  roomState: string
  myName: string
  autoJoin?: boolean
}

export function RoomAudioPanel({ code, roomState, myName, autoJoin = false }: RoomAudioPanelProps) {
  const [joined, setJoined] = useState(false)
  const [muted, setMuted] = useState(false)
  const [status, setStatus] = useState('语音未开启')
  const [error, setError] = useState('')
  const [remoteTracks, setRemoteTracks] = useState<RemoteAudioTrack[]>([])
  const [playbackBlocked, setPlaybackBlocked] = useState(false)
  const [resumeSignal, setResumeSignal] = useState(0)

  const roomRef = useRef<Room | null>(null)
  const joiningRef = useRef(false)
  const joinedRef = useRef(false)
  const handlePlaybackBlocked = useCallback(() => setPlaybackBlocked(true), [])

  const upsertRemoteTrack = useCallback((track: RemoteTrack, participant: RemoteParticipant) => {
    if (track.kind !== 'audio') return
    const id = `${participant.identity}:${track.sid ?? track.mediaStreamTrack.id}`
    setRemoteTracks((prev) => [
      ...prev.filter((item) => item.id !== id),
      { id, name: participant.name || '家人', track },
    ])
    setStatus('语音已连接')
  }, [])

  const removeRemoteTrack = useCallback((track: RemoteTrack, participant: RemoteParticipant) => {
    const prefix = `${participant.identity}:`
    setRemoteTracks((prev) =>
      prev.filter((item) => !(item.track === track || item.id.startsWith(prefix) && item.track.sid === track.sid))
    )
  }, [])

  const disconnect = useCallback(() => {
    roomRef.current?.disconnect()
    roomRef.current = null
    joiningRef.current = false
    joinedRef.current = false
    setJoined(false)
    setMuted(false)
    setRemoteTracks([])
  }, [])

  const joinAudio = useCallback(async () => {
    if (joiningRef.current || joinedRef.current) return
    joiningRef.current = true
    setError('')
    setPlaybackBlocked(false)
    setStatus('正在加入语音...')

    try {
      const join = await liveKitTokenRpc(code, deviceToken(), 'audio')
      if (!join?.ok || !join.url || !join.token) {
        setError('语音服务还没连上，稍后再试')
        setStatus('语音加入失败')
        return
      }

      const { Room, RoomEvent } = await import('livekit-client')
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      })
      roomRef.current = room

      room
        .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          upsertRemoteTrack(track, participant)
          if (publication.kind === 'audio') setPlaybackBlocked(false)
        })
        .on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
          removeRemoteTrack(track, participant)
        })
        .on(RoomEvent.ParticipantDisconnected, (participant) => {
          setRemoteTracks((prev) => prev.filter((item) => !item.id.startsWith(`${participant.identity}:`)))
        })
        .on(RoomEvent.Disconnected, () => {
          roomRef.current = null
          joinedRef.current = false
          setJoined(false)
          setMuted(false)
          setRemoteTracks([])
          setStatus('语音已断开')
        })

      await room.connect(join.url, join.token)
      try {
        await room.localParticipant.setName(myName || '玩家')
      } catch {
        // Token 里已经有名字；没有权限更新时忽略。
      }
      await room.localParticipant.setMicrophoneEnabled(true)
      joinedRef.current = true
      setJoined(true)
      setStatus('语音已开启')
    } catch (e) {
      disconnect()
      setError(mediaPermissionErrorMessage('microphone', e))
      setStatus('语音加入失败')
    } finally {
      joiningRef.current = false
    }
  }, [code, disconnect, myName, removeRemoteTrack, upsertRemoteTrack])

  const leaveAudio = () => {
    disconnect()
    setStatus('语音已退出')
  }

  const toggleMute = async () => {
    const next = !muted
    setMuted(next)
    try {
      await roomRef.current?.localParticipant.setMicrophoneEnabled(!next)
      setStatus(next ? '已静音' : '语音已开启')
    } catch {
      setError('静音切换失败，请重试')
      setMuted(!next)
    }
  }

  useEffect(() => {
    if (autoJoin) void joinAudio()
  }, [autoJoin, joinAudio])

  useEffect(() => disconnect, [disconnect])

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Volume2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold">小组语音</div>
            <div className="text-xs leading-relaxed text-emerald-700">
              {roomAudioStatusText({ joined, remoteCount: remoteTracks.length, roomState, status })}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {joined ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => void toggleMute()} className="gap-1.5">
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {muted ? '取消静音' : '静音'}
              </Button>
              {playbackBlocked && remoteTracks.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setPlaybackBlocked(false)
                    setResumeSignal((n) => n + 1)
                  }}
                  className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  播放声音
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={leaveAudio} className="gap-1.5 text-emerald-800">
                <PhoneOff className="h-4 w-4" />
                退出语音
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" onClick={() => void joinAudio()} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
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
      {remoteTracks.map((item) => (
        <RemoteAudio
          key={item.id}
          track={item.track}
          resumeSignal={resumeSignal}
          onPlaybackBlocked={handlePlaybackBlocked}
        />
      ))}
    </div>
  )
}

function RemoteAudio({
  track,
  resumeSignal,
  onPlaybackBlocked,
}: {
  track: RemoteTrack
  resumeSignal: number
  onPlaybackBlocked: () => void
}) {
  const ref = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = ref.current
    if (!audio) return
    track.attach(audio)
    void audio.play().catch(onPlaybackBlocked)
    return () => {
      track.detach(audio)
    }
  }, [track, resumeSignal, onPlaybackBlocked])

  return (
    <audio ref={ref} autoPlay playsInline>
      <track kind="captions" />
    </audio>
  )
}
