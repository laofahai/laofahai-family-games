import { useEffect, useRef, useState } from 'react'
import { OrientationGuard } from '../components/OrientationGuard'
import { WordCard } from '../components/WordCard'
import { FeedbackOverlay } from '../components/FeedbackOverlay'
import { SoundToggle } from '../components/SoundToggle'
import { useCountdown } from '../hooks/useCountdown'
import { useFlipDetector } from '../hooks/useFlipDetector'
import { useWakeLock } from '../hooks/useWakeLock'
import type { MotionPermission } from '../hooks/useMotionPermission'
import type { Outcome, WordEntry } from '../types'
import { playSound, vibrate } from '../utils/sounds'

interface PlayingStageProps {
  word: WordEntry
  durationSec: number
  motionStatus: MotionPermission
  sound: boolean
  haptic: boolean
  onToggleSound: () => void
  onToggleHaptic: () => void
  onCorrect: () => void
  onPass: () => void
  onTimeUp: () => void
}

export function PlayingStage({
  word,
  durationSec,
  motionStatus,
  sound,
  haptic,
  onToggleSound,
  onToggleHaptic,
  onCorrect,
  onPass,
  onTimeUp,
}: PlayingStageProps) {
  const [overlay, setOverlay] = useState<Outcome | null>(null)
  const [overlayKey, setOverlayKey] = useState(0)
  const lastTickSecondRef = useRef<number | null>(null)

  const { secondsLeft, progress } = useCountdown({
    durationSec,
    running: true,
    onElapsed: onTimeUp,
  })

  useWakeLock(true)

  // 滴答音效（最后 10 秒，每秒一次）
  useEffect(() => {
    if (!sound) return
    if (secondsLeft > 10 || secondsLeft <= 0) return
    if (lastTickSecondRef.current === secondsLeft) return
    lastTickSecondRef.current = secondsLeft
    playSound('tick')
  }, [secondsLeft, sound])

  function fire(outcome: Outcome) {
    setOverlay(outcome)
    setOverlayKey((k) => k + 1)
    setTimeout(() => setOverlay(null), 380)
    if (sound) playSound(outcome)
    if (haptic) vibrate(outcome === 'correct' ? 80 : [40, 40, 40])
    if (outcome === 'correct') onCorrect()
    else onPass()
  }

  const useFlip = motionStatus === 'granted'
  useFlipDetector({
    enabled: useFlip,
    onCorrect: () => fire('correct'),
    onPass: () => fire('pass'),
  })

  // 点按降级：左半屏 = 对，右半屏 = 过
  function handleTap(event: React.MouseEvent<HTMLDivElement>) {
    if (useFlip) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    fire(x < rect.width / 2 ? 'correct' : 'pass')
  }

  const last10 = secondsLeft <= 10

  return (
    <OrientationGuard>
      <div
        className="fixed inset-0 z-40 select-none overflow-hidden bg-ink-50"
        onClick={handleTap}
      >
        {/* 顶部进度条 */}
        <div className="absolute inset-x-0 top-0 z-10 h-2 bg-ink-100">
          <div
            className={
              'h-full transition-[width] duration-100 ease-linear ' +
              (last10 ? 'bg-rose-500' : 'bg-melon-500')
            }
            style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
          />
        </div>

        {/* 顶部信息条 */}
        <div className="absolute inset-x-0 top-3 z-10 flex items-start justify-between px-4">
          <div
            className={
              'rounded-full px-3 py-1 text-sm font-semibold shadow ' +
              (last10 ? 'bg-rose-500 text-white' : 'bg-white/85 text-ink-800')
            }
          >
            {secondsLeft}s
          </div>
          <SoundToggle
            sound={sound}
            haptic={haptic}
            onToggleSound={onToggleSound}
            onToggleHaptic={onToggleHaptic}
          />
        </div>

        {/* 词卡 */}
        <WordCard text={word.text} />

        {/* 底部提示 */}
        <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center text-xs text-ink-500">
          {useFlip ? (
            <span>
              <span className="text-emerald-600">前翻=对</span>
              {' · '}
              <span className="text-rose-600">后翻=过</span>
            </span>
          ) : (
            <span>
              <span className="text-emerald-600">点左屏=对</span>
              {' · '}
              <span className="text-rose-600">点右屏=过</span>
            </span>
          )}
        </div>

        <FeedbackOverlay outcome={overlay} trigger={overlayKey} />
      </div>
    </OrientationGuard>
  )
}
