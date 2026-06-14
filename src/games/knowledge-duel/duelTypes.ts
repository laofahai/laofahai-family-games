// 知识对战 · 搞笑招式定义（Phaser 舞台与 React 飘字共用）。
// 独立于 battle-school 的同名表，避免跨游戏 import（本游戏自包含）。

export type AttackKind = 'slap' | 'kick' | 'tickle' | 'spit' | 'pillow' | 'book'
export const ATTACK_KINDS: AttackKind[] = ['slap', 'kick', 'tickle', 'spit', 'pillow', 'book']

export const ATTACK_META: Record<AttackKind, { emoji: string; label: string }> = {
  slap: { emoji: '👋', label: '扇大耳刮子' },
  kick: { emoji: '🦵', label: '踹一脚' },
  tickle: { emoji: '🤣', label: '挠痒痒' },
  spit: { emoji: '💦', label: '吐口痰' },
  pillow: { emoji: '🛏️', label: '抡枕头' },
  book: { emoji: '📚', label: '砸课本' },
}

export function randomAttackKind(): AttackKind {
  return ATTACK_KINDS[Math.floor(Math.random() * ATTACK_KINDS.length)]
}
