import { RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useOrientation } from '../hooks/useOrientation'

interface OrientationGuardProps {
  children: ReactNode
}

export function OrientationGuard({ children }: OrientationGuardProps) {
  const orientation = useOrientation()
  if (orientation === 'landscape') return <>{children}</>

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink-900/95 px-8 text-center text-white">
      <RotateCcw className="h-12 w-12 animate-pulse text-melon-300" />
      <div className="font-display text-3xl">请把手机横过来</div>
      <div className="text-sm text-ink-100/80">这局横屏举到额头玩~</div>
    </div>
  )
}
