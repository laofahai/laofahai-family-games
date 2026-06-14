// 真实采样音效播放器（CC0 素材，优先于合成）。
// - 采样来自 Kenney 的 CC0 音效包（Impact Sounds / Interface Sounds / RPG Audio），
//   逐一裁选并以 `<name>.ogg` 命名暂存于 public/assets/battle-sfx/（出处与许可见同目录 MANIFEST.md）。
// - 用 Web Audio 解码成 AudioBuffer 后即时播放（可叠播、低延迟、可控音量），
//   不依赖 <audio> 元素串行播放的限制。
// - 与 sound.ts 共用同一套静音状态：通过 isMuted() 查询，避免两处状态漂移。
// - 设计为「优先采样、缺采样回落合成」：playSample 返回 false 表示该名字没有可用采样，
//   调用方（sound.ts）据此回落到原有合成音。

import { isMuted } from './sound'

/** 拥有采样文件的音效名（与 public/assets/battle-sfx/<name>.ogg 一一对应）。 */
const SAMPLE_NAMES = [
  'tap',
  'punch',
  'hit',
  'crit',
  'combo',
  'skill',
  'nova',
  'heal',
  'jump',
  'down',
  'win',
  'lose',
  'correct',
  'wrong',
  'slap',
  'kick',
  'spit',
  'taunt',
] as const

export type SampleName = (typeof SAMPLE_NAMES)[number]

/** 每个采样的相对响度微调（素材本身响度不一，统一拉到大致一致的体感）。1 = 原样。 */
const GAIN: Partial<Record<SampleName, number>> = {
  tap: 0.7,
  punch: 1.0,
  hit: 0.9,
  crit: 1.0,
  combo: 0.8,
  skill: 0.9,
  nova: 0.85, // 重铃尾音长，略压
  heal: 0.8,
  jump: 0.8,
  down: 1.0,
  win: 0.9,
  lose: 0.9,
  correct: 0.85,
  wrong: 0.9,
  slap: 1.0,
  kick: 1.0,
  spit: 0.95,
  taunt: 0.85,
}

const DEFAULT_GAIN = 0.6 // 总线音量，与 sound.ts 的 master(0.5) 量级相当，略高一点让采样更「实」

/** 资源 URL 前缀：尊重 Vite 的 base（部署到子路径也能正确取到）。 */
function assetBase(): string {
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
  return `${base.replace(/\/$/, '')}/assets/battle-sfx`
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
const buffers = new Map<SampleName, AudioBuffer>()
const missing = new Set<SampleName>() // 加载失败/不存在的名字，记下来不再重试，直接回落合成
let preloadStarted = false

/** 取（或懒建）AudioContext。需在用户手势链路内首次调用。与 sound.ts 各持一个 ctx，互不干扰。 */
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = DEFAULT_GAIN
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

async function loadOne(c: AudioContext, name: SampleName): Promise<void> {
  if (buffers.has(name) || missing.has(name)) return
  try {
    const res = await fetch(`${assetBase()}/${name}.ogg`)
    if (!res.ok) {
      missing.add(name)
      return
    }
    const arr = await res.arrayBuffer()
    const buf = await c.decodeAudioData(arr)
    buffers.set(name, buf)
  } catch {
    // 取不到 / 解不开 → 标记缺失，回落合成
    missing.add(name)
  }
}

/**
 * 预加载全部采样。建议在首个用户手势里（与 unlockAudio 一起）触发一次。
 * 幂等：重复调用只会补加尚未加载的项。静音不影响预加载（解除静音后立即可用）。
 */
export function preloadSamples(): void {
  const c = ac()
  if (!c) return
  preloadStarted = true
  for (const name of SAMPLE_NAMES) {
    if (!buffers.has(name) && !missing.has(name)) void loadOne(c, name)
  }
}

/**
 * 播放一个采样。
 * 返回 true 表示已用采样播放（或正在按需加载、本次先静默由合成兜底也算 false）；
 * 返回 false 表示该名字没有可用采样，调用方应回落到合成音。
 *
 * 行为：
 *  - 静音时返回 true 并静默（视作「采样负责了这次播放」，避免合成又响一遍）。
 *  - 已知缺失的名字直接返回 false。
 *  - buffer 已就绪 → 立即播放并返回 true。
 *  - buffer 尚未就绪（首次、还在解码）→ 触发加载，本次返回 false 让合成兜底（不卡声音）。
 */
export function playSample(name: string): boolean {
  if (!(SAMPLE_NAMES as readonly string[]).includes(name)) return false
  const key = name as SampleName
  if (missing.has(key)) return false

  const c = ac()
  if (!c) return false

  // 尚未开始预加载时，借这次调用顺手把整批排上（首个手势可能就是一次点击音）
  if (!preloadStarted) preloadSamples()

  const buf = buffers.get(key)
  if (!buf) {
    // 还没解好：触发单个加载，本次让合成兜底
    void loadOne(c, key)
    return false
  }

  // 已静音：视作采样已「处理」本次播放，静默返回 true，防止合成重复出声
  if (isMuted()) return true

  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  g.gain.value = GAIN[key] ?? 1
  src.connect(g)
  g.connect(master ?? c.destination)
  src.start()
  return true
}

/** 是否已有任意采样就绪（调试/自测用）。 */
export function hasAnySample(): boolean {
  return buffers.size > 0
}
