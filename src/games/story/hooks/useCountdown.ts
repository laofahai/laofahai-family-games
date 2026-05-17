import { useEffect, useRef, useState } from 'react'

interface CountdownOptions {
  durationSec: number
  running: boolean
  onElapsed?: () => void
}

interface CountdownState {
  secondsLeft: number
  progress: number
}

export function useCountdown({ durationSec, running, onElapsed }: CountdownOptions): CountdownState {
  const [state, setState] = useState<CountdownState>({
    secondsLeft: durationSec,
    progress: 1,
  })
  const startedAt = useRef<number | null>(null)
  const elapsedBefore = useRef(0)
  const finishedRef = useRef(false)
  const onElapsedRef = useRef(onElapsed)

  useEffect(() => {
    onElapsedRef.current = onElapsed
  })

  useEffect(() => {
    if (!running) {
      if (startedAt.current !== null) {
        elapsedBefore.current += (performance.now() - startedAt.current) / 1000
        startedAt.current = null
      }
      return
    }

    if (finishedRef.current) return
    startedAt.current = performance.now()
    let raf = 0

    const tick = () => {
      if (!startedAt.current) return
      const elapsed = elapsedBefore.current + (performance.now() - startedAt.current) / 1000
      const remaining = Math.max(0, durationSec - elapsed)
      setState({
        secondsLeft: Math.ceil(remaining),
        progress: durationSec > 0 ? remaining / durationSec : 0,
      })
      if (remaining <= 0) {
        finishedRef.current = true
        startedAt.current = null
        onElapsedRef.current?.()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      if (startedAt.current !== null) {
        elapsedBefore.current += (performance.now() - startedAt.current) / 1000
        startedAt.current = null
      }
    }
  }, [running, durationSec])

  return state
}
