import { useState } from 'react'

export type MotionPermission = 'unknown' | 'granted' | 'denied' | 'unavailable'

interface IOSMotionEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

function getRequester(): IOSMotionEvent['requestPermission'] | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.DeviceMotionEvent as unknown as IOSMotionEvent | undefined
  if (!Ctor || typeof Ctor.requestPermission !== 'function') return null
  return Ctor.requestPermission.bind(Ctor)
}

const STORAGE_KEY = 'charades.motionPermission'

function readStored(): MotionPermission | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === 'granted' || raw === 'denied' || raw === 'unavailable') return raw
  return null
}

function writeStored(value: MotionPermission) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, value)
}

export function useMotionPermission() {
  const [status, setStatus] = useState<MotionPermission>(() => {
    const stored = readStored()
    if (stored) return stored
    if (typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') {
      return 'unavailable'
    }
    return 'unknown'
  })

  const request = async (): Promise<MotionPermission> => {
    if (typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') {
      const next: MotionPermission = 'unavailable'
      writeStored(next)
      setStatus(next)
      return next
    }
    const requester = getRequester()
    if (!requester) {
      // 非 iOS：默认认为可用
      const next: MotionPermission = 'granted'
      writeStored(next)
      setStatus(next)
      return next
    }
    try {
      const result = await requester()
      const next: MotionPermission = result === 'granted' ? 'granted' : 'denied'
      writeStored(next)
      setStatus(next)
      return next
    } catch {
      const next: MotionPermission = 'denied'
      writeStored(next)
      setStatus(next)
      return next
    }
  }

  return { status, request }
}
