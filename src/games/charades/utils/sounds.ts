type SoundKind = 'correct' | 'pass' | 'tick'

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  return ctx
}

interface ToneOpts {
  freq: number
  durationMs: number
  type?: OscillatorType
  gain?: number
}

function playTone({ freq, durationMs, type = 'sine', gain = 0.18 }: ToneOpts) {
  const audio = getCtx()
  if (!audio) return
  const now = audio.currentTime
  const osc = audio.createOscillator()
  const g = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(gain, now + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000)
  osc.connect(g).connect(audio.destination)
  osc.start(now)
  osc.stop(now + durationMs / 1000 + 0.02)
}

export function unlockAudio() {
  const audio = getCtx()
  if (audio && audio.state === 'suspended') {
    audio.resume().catch(() => {})
  }
}

export function playSound(kind: SoundKind) {
  switch (kind) {
    case 'correct':
      playTone({ freq: 880, durationMs: 180, type: 'triangle', gain: 0.22 })
      setTimeout(() => playTone({ freq: 1320, durationMs: 220, type: 'triangle', gain: 0.22 }), 80)
      return
    case 'pass':
      playTone({ freq: 220, durationMs: 260, type: 'sawtooth', gain: 0.15 })
      return
    case 'tick':
      playTone({ freq: 660, durationMs: 60, type: 'square', gain: 0.08 })
      return
  }
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator === 'undefined') return
  if (typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(pattern)
  } catch {
    // ignore
  }
}
