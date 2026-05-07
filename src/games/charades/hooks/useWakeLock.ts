import { useEffect } from 'react'

interface WakeLockSentinelLike {
  release: () => Promise<void>
  released?: boolean
}

interface WakeLockApi {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>
}

function getWakeLock(): WakeLockApi | null {
  if (typeof navigator === 'undefined') return null
  const lock = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock
  return lock ?? null
}

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const api = getWakeLock()
    if (!api) return

    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const next = await api.request('screen')
        if (cancelled) {
          next.release().catch(() => {})
          return
        }
        sentinel = next
      } catch {
        // 不可用 / 用户拒绝：静默失败
      }
    }

    void acquire()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && (sentinel === null || sentinel.released)) {
        void acquire()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      if (sentinel) {
        sentinel.release().catch(() => {})
        sentinel = null
      }
    }
  }, [active])
}
