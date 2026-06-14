// 零依赖合成音效引擎：用 Web Audio 现场合成打击 / 技能 / 胜负音，不需要任何音频文件。
// - 懒初始化 AudioContext（首个用户手势后才创建，满足浏览器自动播放策略）。
// - 全局静音开关持久化到 localStorage('fg:muted')，两个引擎游戏（打老师 / 知识对战）共用。
// - 全部音色由振荡器 + 噪声 + 增益包络现场合成，零体积、零网络、零资源加载。
// - 升级：playSfx 现在优先播放真实 CC0 采样（见 ./sfx-samples），仅在缺采样时回落到合成。
//   循环依赖说明：sfx-samples 反向 import 本模块的 isMuted —— 两边都只在函数体内使用，
//   不在模块顶层求值，因此 ES Module 的循环引用是安全的。

import { playSample, preloadSamples } from './sfx-samples'

export type Sfx =
  | 'tap' // UI 点按
  | 'punch' // 普攻命中（闷拳）
  | 'hit' // 答对/普通命中（清脆）
  | 'crit' // 暴击（更亮更厚）
  | 'combo' // 连击上扬
  | 'skill' // 放技能（横扫 whoosh）
  | 'nova' // 大招爆发（厚重低频 + 拉升）
  | 'heal' // 回血（上行琶音）
  | 'jump' // 跳跃（快速上滑）
  | 'down' // 敌人倒下（下行）
  | 'win' // 通关（欢快号角琶音）
  | 'lose' // 失败（沮丧下行）
  | 'correct' // 答对叮咚
  | 'wrong' // 答错嗡鸣
  // —— 招式音（优先用 public/assets/battle-sfx 采样，缺采样回落下方合成）——
  | 'slap' // 大耳刮子 / 真理巴掌（脆响一巴掌）
  | 'kick' // 踹 / 回旋踢（重击）
  | 'spit' // 呸 / 唾沫（短促）
  | 'taunt' // 毒舌 / 嘲讽（挑衅 sting）

const STORAGE_KEY = 'fg:muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let muted = readMuted()

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** 取（或懒建）AudioContext。必须在用户手势链路里首次调用，否则浏览器会挂起。 */
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** 白噪声缓冲（合成「拳头/爆裂」用），按需生成一次后复用。 */
function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf
  const len = Math.floor(c.sampleRate * 0.4)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  // 用确定性伪随机（避免依赖 Math.random 的不可复现性，也够「噪」）
  let seed = 0x2545f491
  for (let i = 0; i < len; i++) {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    data[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1
  }
  noiseBuf = buf
  return buf
}

/** 一个带 ADSR 简化包络的振荡器音。 */
function tone(
  c: AudioContext,
  opts: {
    type: OscillatorType
    from: number // 起始频率
    to?: number // 滑到的频率（默认不滑）
    t0: number // 相对 now 的起始秒
    dur: number // 持续秒
    gain?: number // 峰值音量
    attack?: number // 起音秒
  },
): void {
  const { type, from, to = from, t0, dur, gain = 0.25, attack = 0.008 } = opts
  const now = c.currentTime + t0
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, now)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + dur)
  g.gain.setValueAtTime(0.0001, now)
  g.gain.exponentialRampToValueAtTime(gain, now + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  osc.connect(g)
  g.connect(master ?? c.destination)
  osc.start(now)
  osc.stop(now + dur + 0.02)
}

/** 一段噪声爆裂（拳头/打击体感），带低通让它「闷」一点。 */
function burst(
  c: AudioContext,
  opts: { t0: number; dur: number; gain?: number; cutoff?: number },
): void {
  const { t0, dur, gain = 0.4, cutoff = 1800 } = opts
  const now = c.currentTime + t0
  const src = c.createBufferSource()
  src.buffer = noise(c)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = cutoff
  const g = c.createGain()
  g.gain.setValueAtTime(gain, now)
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  src.connect(lp)
  lp.connect(g)
  g.connect(master ?? c.destination)
  src.start(now)
  src.stop(now + dur + 0.02)
}

/**
 * 播一个音效。
 * 优先用真实采样（playSample）；该名字没有可用采样（或尚未解码完成）时回落到下方合成。
 * 静音时静默返回；未解锁的 AudioContext 会在此尝试 resume。
 */
export function playSfx(name: Sfx): void {
  if (muted) return
  // 优先采样：命中即返回，未命中回落合成
  if (playSample(name)) return
  const c = ac()
  if (!c) return

  switch (name) {
    case 'tap':
      tone(c, { type: 'triangle', from: 660, to: 880, t0: 0, dur: 0.06, gain: 0.12 })
      break
    case 'punch':
      burst(c, { t0: 0, dur: 0.12, gain: 0.45, cutoff: 1200 })
      tone(c, { type: 'sine', from: 160, to: 60, t0: 0, dur: 0.14, gain: 0.3 })
      break
    case 'hit':
      tone(c, { type: 'square', from: 520, to: 660, t0: 0, dur: 0.09, gain: 0.18 })
      tone(c, { type: 'sine', from: 220, to: 120, t0: 0, dur: 0.1, gain: 0.2 })
      break
    case 'crit':
      burst(c, { t0: 0, dur: 0.16, gain: 0.5, cutoff: 3000 })
      tone(c, { type: 'sawtooth', from: 880, to: 220, t0: 0, dur: 0.22, gain: 0.28 })
      tone(c, { type: 'square', from: 660, to: 990, t0: 0.02, dur: 0.16, gain: 0.18 })
      break
    case 'combo':
      tone(c, { type: 'triangle', from: 700, to: 1320, t0: 0, dur: 0.12, gain: 0.2 })
      break
    case 'skill':
      // 横扫 whoosh：噪声扫频 + 上行音
      burst(c, { t0: 0, dur: 0.26, gain: 0.3, cutoff: 4000 })
      tone(c, { type: 'sawtooth', from: 300, to: 1200, t0: 0, dur: 0.26, gain: 0.2 })
      break
    case 'nova': {
      // 大招：厚重低频砸下 + 高频拉升 + 余响
      burst(c, { t0: 0, dur: 0.4, gain: 0.5, cutoff: 2600 })
      tone(c, { type: 'sawtooth', from: 90, to: 40, t0: 0, dur: 0.5, gain: 0.35 })
      tone(c, { type: 'square', from: 400, to: 1600, t0: 0.04, dur: 0.4, gain: 0.18 })
      tone(c, { type: 'sine', from: 1200, to: 2400, t0: 0.1, dur: 0.3, gain: 0.12 })
      break
    }
    case 'heal': {
      const notes = [392, 523, 659, 784] // G C E G 上行
      notes.forEach((f, i) => tone(c, { type: 'sine', from: f, t0: i * 0.07, dur: 0.18, gain: 0.16 }))
      break
    }
    case 'jump':
      tone(c, { type: 'square', from: 320, to: 720, t0: 0, dur: 0.14, gain: 0.16 })
      break
    case 'down':
      tone(c, { type: 'sawtooth', from: 440, to: 80, t0: 0, dur: 0.34, gain: 0.26 })
      burst(c, { t0: 0.02, dur: 0.18, gain: 0.22, cutoff: 900 })
      break
    case 'correct': {
      tone(c, { type: 'sine', from: 880, t0: 0, dur: 0.1, gain: 0.2 })
      tone(c, { type: 'sine', from: 1320, t0: 0.08, dur: 0.14, gain: 0.2 })
      break
    }
    case 'wrong':
      tone(c, { type: 'sawtooth', from: 200, to: 120, t0: 0, dur: 0.26, gain: 0.22 })
      tone(c, { type: 'square', from: 160, to: 90, t0: 0, dur: 0.26, gain: 0.16 })
      break
    case 'slap':
      // 大耳刮子：极短高频脆响 + 一点低频体感
      burst(c, { t0: 0, dur: 0.05, gain: 0.5, cutoff: 6000 })
      tone(c, { type: 'sine', from: 220, to: 90, t0: 0, dur: 0.07, gain: 0.22 })
      break
    case 'kick':
      // 踹：比 punch 更沉更狠
      burst(c, { t0: 0, dur: 0.16, gain: 0.5, cutoff: 900 })
      tone(c, { type: 'sine', from: 130, to: 45, t0: 0, dur: 0.2, gain: 0.36 })
      break
    case 'spit':
      // 呸：短促的高通噪声「噗」
      burst(c, { t0: 0, dur: 0.08, gain: 0.3, cutoff: 5000 })
      tone(c, { type: 'triangle', from: 480, to: 240, t0: 0, dur: 0.08, gain: 0.1 })
      break
    case 'taunt':
      // 嘲讽 sting：滑稽上挑的两声
      tone(c, { type: 'square', from: 300, to: 520, t0: 0, dur: 0.1, gain: 0.16 })
      tone(c, { type: 'square', from: 520, to: 360, t0: 0.1, dur: 0.14, gain: 0.16 })
      break
    case 'win': {
      const notes = [523, 659, 784, 1047, 1319] // C E G C E 号角
      notes.forEach((f, i) => tone(c, { type: 'triangle', from: f, t0: i * 0.12, dur: 0.3, gain: 0.22 }))
      break
    }
    case 'lose': {
      const notes = [523, 440, 349, 262] // C A F C 下行
      notes.forEach((f, i) => tone(c, { type: 'triangle', from: f, t0: i * 0.16, dur: 0.34, gain: 0.2 }))
      break
    }
  }
}

/** 在首个用户手势里调用，解锁/恢复音频上下文（iOS/Safari 必需）。 */
export function unlockAudio(): void {
  ac()
}

/**
 * 在首个用户手势里调用：解锁音频上下文并开始预加载真实采样。
 * 是 unlockAudio 的超集，调用方可二选一（推荐在打老师/知识对战的首次交互里调它）。
 * 幂等、可安全多次调用。
 */
export function initSfx(): void {
  ac()
  preloadSamples()
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(next: boolean): void {
  muted = next
  try {
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  } catch {
    /* 忽略持久化失败 */
  }
}

/** 切换静音，返回切换后的状态。 */
export function toggleMuted(): boolean {
  setMuted(!muted)
  return muted
}
