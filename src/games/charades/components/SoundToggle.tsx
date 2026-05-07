import { Volume2, VolumeX, Vibrate, BellOff } from 'lucide-react'

interface SoundToggleProps {
  sound: boolean
  haptic: boolean
  onToggleSound: () => void
  onToggleHaptic: () => void
}

export function SoundToggle({ sound, haptic, onToggleSound, onToggleHaptic }: SoundToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleSound}
        aria-label={sound ? '静音' : '取消静音'}
        className="rounded-full bg-white/80 p-2 text-ink-700 shadow-sm transition hover:bg-white"
      >
        {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-ink-400" />}
      </button>
      <button
        type="button"
        onClick={onToggleHaptic}
        aria-label={haptic ? '关闭震动' : '开启震动'}
        className="rounded-full bg-white/80 p-2 text-ink-700 shadow-sm transition hover:bg-white"
      >
        {haptic ? <Vibrate className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-ink-400" />}
      </button>
    </div>
  )
}
