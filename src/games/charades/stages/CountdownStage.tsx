import { useEffect, useState } from 'react'
import { OrientationGuard } from '../components/OrientationGuard'

interface CountdownStageProps {
  onComplete: () => void
}

const STEPS = ['3', '2', '1', '开始！']

export function CountdownStage({ onComplete }: CountdownStageProps) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step >= STEPS.length) {
      onComplete()
      return
    }
    const id = setTimeout(() => setStep((s) => s + 1), step === STEPS.length - 1 ? 600 : 800)
    return () => clearTimeout(id)
  }, [step, onComplete])

  const current = STEPS[Math.min(step, STEPS.length - 1)]

  return (
    <OrientationGuard>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-melon-500 text-white">
        <div
          key={step}
          className="font-display text-[40vmin] leading-none drop-shadow-lg motion-safe:animate-pulse"
        >
          {current}
        </div>
      </div>
    </OrientationGuard>
  )
}
