// 知识对战 · Phaser 可视化舞台：左(你) vs 右(对手) 两名出场角色面对面，
// 头顶各一条血条；答题驱动「冲上去 → 命中 → 弹回」的对轰动画（扇耳光/踹腿/挠痒痒/吐口痰），
// 暴击加屏幕抖+闪光，受击者抖动泛红。
//
// 严格只当舞台：不含任何答题/胜负逻辑、不读题库；全部由 React 通过 sceneRef 调方法驱动。
// 不加载任何外部图片/精灵图，纯 Graphics 画 + emoji 文本，避免资源加载问题。
// 参考 battle-school/scene.ts 的风格写的独立场景（不 import 它）。

import Phaser from 'phaser'
import { ATTACK_META, type AttackKind } from '../duelTypes'

export type DuelSide = 'left' | 'right'

interface SceneTheme {
  sky: number
  skyBottom: number
  ground: number
  groundLine: number
  deco: number
}
const THEMES: SceneTheme[] = [
  { sky: 0xbfe3ff, skyBottom: 0xeaf6ff, ground: 0xd7c4a3, groundLine: 0xb89b6e, deco: 0x9fd6a0 },
  { sky: 0xffe0b8, skyBottom: 0xfff3e0, ground: 0xc9b08a, groundLine: 0xa98a5e, deco: 0xf6c177 },
  { sky: 0xcdeede, skyBottom: 0xf0fbf5, ground: 0xcfc0a0, groundLine: 0xa99a78, deco: 0x88c9a1 },
  { sky: 0xd9d2ff, skyBottom: 0xf3f0ff, ground: 0xc7bda6, groundLine: 0xa3977c, deco: 0xb5a8f0 },
  { sky: 0xffd6e0, skyBottom: 0xfff0f4, ground: 0xd0bfa6, groundLine: 0xab9676, deco: 0xf2a7c0 },
]

interface FighterView {
  side: DuelSide
  baseX: number
  emoji: string
  name: string
  maxHp: number
  hp: number
  container: Phaser.GameObjects.Container
  emojiText: Phaser.GameObjects.Text
  nameText: Phaser.GameObjects.Text
  hpBg: Phaser.GameObjects.Graphics
  hpFill: Phaser.GameObjects.Graphics
}

/** React 调 spawn 时塞进来的双方初始设定。 */
export interface DuelSpawnSpec {
  emoji: string
  name: string
  maxHp: number
  hp: number
}

/** 播一次出招的参数。 */
export interface DuelHitSpec {
  attacker: DuelSide
  kind: AttackKind
  /** 答对 → 命中对方(enemy)；答错 → 自损(self)。 */
  target: 'enemy' | 'self'
  crit?: boolean
  damage?: number
  /** 命中后被打方的新血量（用于动画结束刷新血条）。 */
  victimHpAfter?: number
  victim: DuelSide
  /** 这一击是否击倒：命中后接着播该方倒地。 */
  downAfter?: DuelSide
}

const HP_W = 150
const HP_H = 12

export class DuelScene extends Phaser.Scene {
  private W = 800
  private H = 450
  private groundY = 360
  private bg!: Phaser.GameObjects.Graphics
  private decos: Phaser.GameObjects.GameObject[] = []
  private fighters: Record<DuelSide, FighterView | null> = { left: null, right: null }
  private busy = false

  constructor() {
    super('duel')
  }

  create() {
    this.W = this.scale.width
    this.H = this.scale.height
    this.groundY = Math.round(this.H * 0.74)

    this.bg = this.add.graphics()
    this.drawBackground(THEMES[Math.floor(Math.random() * THEMES.length)])

    this.fighters.left = this.makeFighter('left', Math.round(this.W * 0.24), '🦊', '玩家一')
    this.fighters.right = this.makeFighter('right', Math.round(this.W * 0.76), '🐯', '玩家二')

    // 待机轻浮动
    for (const f of [this.fighters.left, this.fighters.right]) {
      if (!f) continue
      this.tweens.add({
        targets: f.container,
        y: this.groundY - 6,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      })
    }

    // 重新建实例后（StrictMode/路由切换）丢失的状态由 React 在 onReady 后用 spawn 重置。
    this.game.events.emit('duel-scene-ready')
  }

  // ── 背景 ──────────────────────────────────────────────────────────
  private drawBackground(theme: SceneTheme) {
    this.bg.clear()
    for (const d of this.decos) d.destroy()
    this.decos = []

    const steps = 12
    for (let i = 0; i < steps; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(theme.sky),
        Phaser.Display.Color.IntegerToColor(theme.skyBottom),
        steps - 1,
        i
      )
      this.bg.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1)
      this.bg.fillRect(0, (this.groundY / steps) * i, this.W, this.groundY / steps + 1)
    }
    this.bg.fillStyle(theme.ground, 1)
    this.bg.fillRect(0, this.groundY, this.W, this.H - this.groundY)
    this.bg.lineStyle(4, theme.groundLine, 1)
    this.bg.lineBetween(0, this.groundY, this.W, this.groundY)

    for (let i = 0; i < 6; i++) {
      const x = (this.W / 6) * i + 30 + Math.random() * 40
      const h = 26 + Math.random() * 24
      const bush = this.add.graphics()
      bush.fillStyle(theme.deco, 1)
      bush.fillCircle(x, this.groundY - h * 0.4, h * 0.5)
      bush.fillTriangle(x - h * 0.5, this.groundY, x + h * 0.5, this.groundY, x, this.groundY - h)
      bush.setDepth(-1)
      this.decos.push(bush)
    }
    for (let i = 0; i < 3; i++) {
      const x = 80 + i * (this.W / 3) + Math.random() * 60
      const y = 40 + Math.random() * 60
      const cloud = this.add.text(x, y, '☁️', { fontSize: '34px' }).setOrigin(0.5).setAlpha(0.85).setDepth(-1)
      this.decos.push(cloud)
      this.tweens.add({
        targets: cloud,
        x: x + 30,
        duration: 6000 + i * 1500,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      })
    }
  }

  // ── 角色（容器：身体 Graphics + emoji 头 + 名字 + 血条）─────────────
  private makeFighter(side: DuelSide, baseX: number, emoji: string, name: string): FighterView {
    const body = this.add.graphics()
    this.drawStickman(body, side)
    const emojiText = this.add.text(0, -86, emoji, { fontSize: '40px' }).setOrigin(0.5)
    const nameText = this.add
      .text(0, 30, name, {
        fontSize: '15px',
        color: '#5b4632',
        fontStyle: 'bold',
        backgroundColor: '#ffffffcc',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
    const hpBg = this.add.graphics()
    const hpFill = this.add.graphics()
    const container = this.add.container(baseX, this.groundY, [body, emojiText, nameText, hpBg, hpFill])

    const f: FighterView = {
      side,
      baseX,
      emoji,
      name,
      maxHp: 6,
      hp: 6,
      container,
      emojiText,
      nameText,
      hpBg,
      hpFill,
    }
    this.drawHp(f)
    return f
  }

  private drawStickman(g: Phaser.GameObjects.Graphics, side: DuelSide) {
    g.clear()
    g.lineStyle(6, side === 'left' ? 0x2563eb : 0xdb2777, 1)
    g.strokeCircle(0, -58, 16)
    g.lineBetween(0, -42, 0, 2)
    g.lineBetween(0, -28, -22, -8)
    g.lineBetween(0, -28, 22, -8)
    g.lineBetween(0, 2, -16, 34)
    g.lineBetween(0, 2, 16, 34)
  }

  /** 头顶血条：背景灰 + 按比例的彩条（>50绿 >25黄 否则红）。 */
  private drawHp(f: FighterView) {
    const x = -HP_W / 2
    const y = -118
    f.hpBg.clear()
    f.hpBg.fillStyle(0x000000, 0.18)
    f.hpBg.fillRoundedRect(x - 2, y - 2, HP_W + 4, HP_H + 4, 5)
    f.hpBg.fillStyle(0xe5e0d8, 1)
    f.hpBg.fillRoundedRect(x, y, HP_W, HP_H, 4)

    const pct = f.maxHp > 0 ? Math.max(0, Math.min(1, f.hp / f.maxHp)) : 0
    const color = pct > 0.5 ? 0x10b981 : pct > 0.25 ? 0xf59e0b : 0xf43f5e
    f.hpFill.clear()
    if (pct > 0) {
      f.hpFill.fillStyle(color, 1)
      f.hpFill.fillRoundedRect(x, y, Math.max(4, HP_W * pct), HP_H, 4)
    }
  }

  // ── React 调用接口 ────────────────────────────────────────────────

  /** 设置/重置双方（开局、再来一局、在线进房）。同步刷新血条与朝向，不播过场。 */
  spawn(left: DuelSpawnSpec, right: DuelSpawnSpec) {
    const apply = (f: FighterView | null, spec: DuelSpawnSpec) => {
      if (!f) return
      f.emoji = spec.emoji
      f.name = spec.name
      f.maxHp = spec.maxHp
      f.hp = spec.hp
      f.emojiText.setText(spec.emoji).clearTint().setAngle(0)
      f.nameText.setText(spec.name)
      f.container.setAlpha(1).setScale(1).setAngle(0)
      f.container.x = f.baseX
      f.container.y = this.groundY
      this.drawHp(f)
    }
    apply(this.fighters.left, left)
    apply(this.fighters.right, right)
    this.busy = false
    if (Math.random() < 0.5) this.drawBackground(THEMES[Math.floor(Math.random() * THEMES.length)])
  }

  /** 直接设某一方当前血量并刷新血条（用于在线同步对端权威血量）。 */
  setHp(side: DuelSide, hp: number) {
    const f = this.fighters[side]
    if (!f) return
    f.hp = Math.max(0, Math.min(f.maxHp, hp))
    this.drawHp(f)
  }

  /** 播一次出招：attacker 冲向 victim，命中后弹回；victim 抖动泛红；飘招式 + 伤害字；暴击屏抖。 */
  playHit(spec: DuelHitSpec) {
    const atk = this.fighters[spec.attacker]
    const victim = this.fighters[spec.victim]
    if (!atk || !victim) return
    const meta = ATTACK_META[spec.kind]
    this.busy = true

    // self（答错自损）：原地懊恼一抖，不冲锋。
    if (spec.target === 'self') {
      this.tweens.add({
        targets: atk.container,
        angle: { from: -8, to: 8 },
        duration: 70,
        yoyo: true,
        repeat: 2,
        ease: 'sine.inOut',
        onComplete: () => {
          atk.container.setAngle(0)
          this.busy = false
        },
      })
      const oops = this.add.text(atk.container.x, atk.container.y - 110, '😣', { fontSize: '30px' }).setOrigin(0.5)
      this.tweens.add({ targets: oops, y: oops.y - 40, alpha: 0, duration: 650, onComplete: () => oops.destroy() })
      this.onImpact(victim, spec)
      if (spec.downAfter) this.time.delayedCall(260, () => this.playDown(spec.downAfter!))
      return
    }

    const dir = spec.attacker === 'left' ? 1 : -1
    const startX = atk.baseX
    const gap = Math.abs(this.fighters.right!.baseX - this.fighters.left!.baseX)
    const lungeX = startX + dir * (gap - 100)
    this.tweens.add({
      targets: atk.container,
      x: lungeX,
      duration: 180,
      ease: 'quad.in',
      onComplete: () => {
        this.onImpact(victim, spec, dir, meta.emoji)
        if (spec.downAfter) this.time.delayedCall(280, () => this.playDown(spec.downAfter!))
        this.tweens.add({
          targets: atk.container,
          x: startX,
          duration: 220,
          delay: 80,
          ease: 'quad.out',
          onComplete: () => {
            this.busy = false
          },
        })
      },
    })
  }

  private onImpact(victim: FighterView, spec: DuelHitSpec, dir = 0, fxEmoji?: string) {
    const tgt = victim.container
    const d = dir || (spec.victim === 'left' ? -1 : 1)

    // 抖动
    this.tweens.add({
      targets: tgt,
      x: tgt.x + d * 16,
      duration: 60,
      yoyo: true,
      repeat: 2,
      ease: 'sine.inOut',
      onComplete: () => {
        tgt.x = victim.baseX
      },
    })
    // 受击泛红（emoji 头支持 tint）
    victim.emojiText.setTint(0xff5a5a)
    this.time.delayedCall(200, () => victim.emojiText.clearTint())

    // 招式特效 emoji 飞向目标
    if (fxEmoji) {
      const fx = this.add.text(tgt.x - d * 40, tgt.y - 60, fxEmoji, { fontSize: '40px' }).setOrigin(0.5)
      this.tweens.add({
        targets: fx,
        x: tgt.x,
        y: tgt.y - 80,
        scale: { from: 0.6, to: 1.6 },
        angle: d * 40,
        alpha: { from: 1, to: 0 },
        duration: 420,
        ease: 'quad.out',
        onComplete: () => fx.destroy(),
      })
    }

    // 挠痒痒：目标冒笑
    if (spec.kind === 'tickle') {
      const laugh = this.add.text(tgt.x + 26, tgt.y - 70, '😆', { fontSize: '26px' }).setOrigin(0.5)
      this.tweens.add({ targets: laugh, y: tgt.y - 120, alpha: 0, duration: 700, onComplete: () => laugh.destroy() })
    }

    // 伤害字
    if (spec.damage && spec.damage > 0) {
      const dmgColor = spec.crit ? '#f43f5e' : '#3e2409'
      const dmgSize = spec.crit ? '38px' : '26px'
      const dmg = this.add
        .text(tgt.x, tgt.y - 100, `-${spec.damage}`, { fontSize: dmgSize, color: dmgColor, fontStyle: 'bold' })
        .setOrigin(0.5)
      this.tweens.add({
        targets: dmg,
        y: tgt.y - 160,
        alpha: { from: 1, to: 0 },
        duration: 800,
        ease: 'quad.out',
        onComplete: () => dmg.destroy(),
      })
    }

    // 暴击：屏抖 + 闪光 + “暴击!”
    if (spec.crit) {
      this.cameras.main.shake(220, 0.012)
      this.cameras.main.flash(160, 255, 230, 120)
      const crit = this.add
        .text(tgt.x, tgt.y - 130, '暴击!', { fontSize: '32px', color: '#f59e0b', fontStyle: 'bold' })
        .setOrigin(0.5)
      this.tweens.add({
        targets: crit,
        scale: { from: 0.5, to: 1.4 },
        alpha: { from: 1, to: 0 },
        duration: 700,
        ease: 'back.out',
        onComplete: () => crit.destroy(),
      })
    } else {
      this.cameras.main.shake(110, 0.006)
    }

    // 命中后刷新被打方血条
    if (typeof spec.victimHpAfter === 'number') {
      victim.hp = Math.max(0, Math.min(victim.maxHp, spec.victimHpAfter))
      this.drawHp(victim)
    }
  }

  /** 倒下：旋转倒地 + 冒星星 + 淡出。 */
  playDown(side: DuelSide) {
    const f = this.fighters[side]
    if (!f) return
    this.tweens.add({
      targets: f.container,
      angle: side === 'left' ? -90 : 90,
      y: this.groundY + 18,
      alpha: 0.25,
      duration: 520,
      ease: 'quad.in',
    })
    const star = this.add.text(f.container.x, f.container.y - 80, '💫', { fontSize: '34px' }).setOrigin(0.5)
    this.tweens.add({ targets: star, angle: 360, alpha: 0, duration: 700, onComplete: () => star.destroy() })
  }

  isBusy() {
    return this.busy
  }
}
