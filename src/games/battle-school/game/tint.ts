// 同学小怪「按名字着色」：Kenney 卡通角色精灵款式有限（男 kidA–D / 女 kidE–G），
// 很多同名小怪长得一样。给每个名字派一个确定性的柔和色调（Phaser tint），
// 同名→同色（恒定），异名→尽量不同色（黄金角铺色相，相邻名字也拉得开）。
//
// 关键：Phaser 的 tint 是「正片叠底式相乘」，深色会把彩色精灵压黑发脏。
// 所以这里只取【高明度、低/中饱和】的浅色：HSL 里 S≈0.25–0.45、L≈0.72–0.82，
// 保证角色五官/轮廓仍清晰可辨，画面不变暗。也绝不返回纯白（等于没上色）。

/** 字符串稳定哈希（FNV-1a，纯函数、跨端一致）。同名恒得同值。 */
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0 // 转无符号 32 位
}

/** HSL → 0xRRGGBB 整数。h∈[0,360)，s/l∈[0,1]。 */
function hslToInt(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = l - c / 2
  const to255 = (v: number) => Math.round((v + m) * 255)
  return (to255(r) << 16) | (to255(g) << 8) | to255(b)
}

const GOLDEN_ANGLE = 137.508 // 黄金角：色相步进，让相邻哈希也均匀散开、不撞色

/**
 * 按名字算一个柔和、好看、可辨的 tint 色（Phaser 0xRRGGBB 整数）。
 * - 确定性：同名恒返回同色。
 * - 异名尽量散开：色相用「哈希 × 黄金角」铺满 0–360；
 *   饱和/明度也由哈希在窄高亮区间内小幅抖动（增辨识、仍保持浅亮）。
 */
export function tintForName(name: string): number {
  const h0 = hashStr(name)
  // 黄金角铺色相：把哈希当序号，相邻名字的色相相差 ~137.5°，肉眼一眼可分。
  const hue = (h0 * GOLDEN_ANGLE) % 360
  // 饱和/明度在浅亮区间内由哈希派生的两路位流小幅抖动（同名恒定）。
  const sat = 0.28 + ((h0 >>> 8) & 0xff) / 255 * 0.16 // ≈0.28–0.44
  const light = 0.74 + ((h0 >>> 16) & 0xff) / 255 * 0.08 // ≈0.74–0.82
  return hslToInt(hue, sat, light)
}
