// 角色精灵资源（Kenney「Toon Characters 1」, CC0）。
//   · 主角 hero、老师 BOSS teacher、同学 kidA–kidD，各 8 帧 PNG（idle/walk0-3/attack2/hurt/jump，96×128）。
//   · 文件名形如 `<key>_<frame>.png`，Vite 把 public/ 当站点根 → URL `/assets/battle-school/xxx.png`。
//   · 出处与许可见 public/assets/battle-school/CREDITS.md。
// 本模块只负责：preload 加载帧、create 注册走路循环动画、按名字哈希挑同学款式。无任何游戏逻辑。

import Phaser from 'phaser'
import { genderOf, playerGenderOf } from '@/games/_battle/gender'

const SPRITE_BASE = '/assets/battle-school'
// 女版精灵（同一套 Kenney「Toon Characters 1」包，drop-in 兼容：同 8 帧名、同 96×128）。
const SPRITE_BASE_GIRLS = '/assets/battle-school-girls'

/** 8 帧姿势（与文件名后缀一致）。 */
export const FRAMES = ['idle', 'walk0', 'walk1', 'walk2', 'walk3', 'attack2', 'hurt', 'jump'] as const
export type FrameName = (typeof FRAMES)[number]

// ── 男版（既有）──────────────────────────────────────────────────────
export const HERO_KEY = 'hero'
export const TEACHER_KEY = 'teacher'
export const CLASSMATE_KEYS = ['kidA', 'kidB', 'kidC', 'kidD'] as const

// ── 女版（battle-school-girls）──────────────────────────────────────
export const HERO_KEY_F = 'herog'
export const TEACHER_KEY_F = 'teacherF'
export const CLASSMATE_KEYS_F = ['kidE', 'kidF', 'kidG'] as const

// 哪些 key 从女版目录加载（决定 preload 的 URL 前缀）。
const GIRL_KEYS = new Set<string>([HERO_KEY_F, TEACHER_KEY_F, ...CLASSMATE_KEYS_F])

const ALL_KEYS = [
  HERO_KEY, TEACHER_KEY, ...CLASSMATE_KEYS,
  HERO_KEY_F, TEACHER_KEY_F, ...CLASSMATE_KEYS_F,
] as const

/** 某 key 对应的素材目录（女版走 girls 目录，其余走男版目录）。 */
function baseFor(charKey: string): string {
  return GIRL_KEYS.has(charKey) ? SPRITE_BASE_GIRLS : SPRITE_BASE
}

/** 原始帧高（96×128），按目标显示高等比缩放。 */
export const SPRITE_SRC_H = 128

/** 纹理 key：`hero_idle` 等。 */
export function texKey(charKey: string, frame: FrameName): string {
  return `${charKey}_${frame}`
}

/** 走路循环动画 key：`hero_walk` 等。 */
export function walkAnimKey(charKey: string): string {
  return `${charKey}_walk`
}

/** preload 阶段：把所有角色（男+女）所有帧排进加载队列。 */
export function preloadSprites(load: Phaser.Loader.LoaderPlugin): void {
  for (const key of ALL_KEYS) {
    for (const frame of FRAMES) {
      load.image(texKey(key, frame), `${baseFor(key)}/${key}_${frame}.png`)
    }
  }
}

/** create 阶段：为每个角色注册走路循环动画（4 帧来回）。 */
export function registerAnims(anims: Phaser.Animations.AnimationManager): void {
  for (const key of ALL_KEYS) {
    const animKey = walkAnimKey(key)
    if (anims.exists(animKey)) continue
    anims.create({
      key: animKey,
      frames: [
        { key: texKey(key, 'walk0') },
        { key: texKey(key, 'walk1') },
        { key: texKey(key, 'walk2') },
        { key: texKey(key, 'walk3') },
      ],
      frameRate: 10,
      repeat: -1,
    })
  }
}

/** 字符串稳定哈希（把同学名映射到固定款式，保证「同名同学=同长相」）。 */
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/**
 * 按同学名挑一款精灵（按性别选男/女款），不同名字尽量不同长相、同名恒定。
 * 性别取自云端名册（_battle/gender），名册没有时该模块自带哈希兜底。
 */
export function pickClassmateKey(name: string): string {
  const pool = genderOf(name) === 'female' ? CLASSMATE_KEYS_F : CLASSMATE_KEYS
  return pool[hashStr(name) % pool.length]
}

/** 主角精灵 key：按玩家性别选 女=herog / 男=hero。 */
export function pickHeroKey(playerId: string, playerName?: string): string {
  return playerGenderOf(playerId, playerName) === 'female' ? HERO_KEY_F : HERO_KEY
}

/** 老师 BOSS 精灵 key：按老师名性别选 女=teacherF / 男=teacher。 */
export function pickTeacherKey(teacherName: string): string {
  return genderOf(teacherName) === 'female' ? TEACHER_KEY_F : TEACHER_KEY
}
