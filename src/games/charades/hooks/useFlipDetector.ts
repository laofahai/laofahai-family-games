import { useEffect, useRef } from 'react'

interface FlipDetectorOptions {
  enabled: boolean
  onCorrect: () => void
  onPass: () => void
  triggerThreshold?: number
  neutralThreshold?: number
  cooldownMs?: number
}

type Phase = 'NEUTRAL' | 'FIRED'

export function useFlipDetector({
  enabled,
  onCorrect,
  onPass,
  triggerThreshold = 6,
  neutralThreshold = 4,
  cooldownMs = 600,
}: FlipDetectorOptions) {
  const correctRef = useRef(onCorrect)
  const passRef = useRef(onPass)

  useEffect(() => {
    correctRef.current = onCorrect
    passRef.current = onPass
  })

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    if (typeof window.DeviceMotionEvent === 'undefined') return

    let phase: Phase = 'NEUTRAL'
    let lastFired = 0
    let lastSampleAt = 0

    const handler = (event: DeviceMotionEvent) => {
      const now = performance.now()
      if (now - lastSampleAt < 50) return
      lastSampleAt = now

      const z = event.accelerationIncludingGravity?.z
      if (typeof z !== 'number' || Number.isNaN(z)) return

      if (phase === 'NEUTRAL') {
        if (z < -triggerThreshold) {
          phase = 'FIRED'
          lastFired = now
          correctRef.current()
        } else if (z > triggerThreshold) {
          phase = 'FIRED'
          lastFired = now
          passRef.current()
        }
        return
      }

      // phase === 'FIRED'
      const cooledDown = now - lastFired >= cooldownMs
      const inNeutral = Math.abs(z) < neutralThreshold
      if (cooledDown && inNeutral) {
        phase = 'NEUTRAL'
      }
    }

    window.addEventListener('devicemotion', handler)
    return () => window.removeEventListener('devicemotion', handler)
  }, [enabled, triggerThreshold, neutralThreshold, cooldownMs])
}
