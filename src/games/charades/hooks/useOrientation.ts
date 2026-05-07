import { useEffect, useState } from 'react'

export type Orientation = 'landscape' | 'portrait'

function read(): Orientation {
  if (typeof window === 'undefined') return 'landscape'
  return window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait'
}

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(read)

  useEffect(() => {
    const handle = () => setOrientation(read())
    window.addEventListener('resize', handle)
    window.addEventListener('orientationchange', handle)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('orientationchange', handle)
    }
  }, [])

  return orientation
}
