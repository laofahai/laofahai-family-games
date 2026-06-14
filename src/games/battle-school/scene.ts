// Phaser 可视化舞台：横版背景(随机) + 主角火柴人(Graphics 程序化) + 敌人(emoji+名字)。
// 不含任何游戏逻辑、不读题库；由 React 通过 sceneRef 调方法驱动动画。
// 不加载任何外部图片/精灵图，全部用 Graphics 画 + emoji 文本，避免资源加载问题。

import Phaser from 'phaser'
import type { AttackKind } from './types'
import { ATTACK_META } from './types'

export type Side = 'hero' | 'enemy'

// 几套随机横版场景配色（天空、地面、远景装饰），程序化画。
interface SceneTheme {
  sky: number
  skyBottom: number
  ground: number
  groundLine: number
  deco: number
  name: string
}
const THEMES: SceneTheme[] = [
  { sky: 0xbfe3ff, skyBottom: 0xeaf6ff, ground: 0xd7c4a3, groundLine: 0xb89b6e, deco: 0x9fd6a0, name: '操场' },
  { sky: 0xffe0b8, skyBottom: 0xfff3e0, ground: 0xc9b08a, groundLine: 0xa98a5e, deco: 0xf6c177, name: '黄昏走廊' },
  { sky: 0xcdeede, skyBottom: 0xf0fbf5, ground: 0xcfc0a0, groundLine: 0xa99a78, deco: 0x88c9a1, name: '小花园' },
  { sky: 0xd9d2ff, skyBottom: 0xf3f0ff, ground: 0xc7bda6, groundLine: 0xa3977c, deco: 0xb5a8f0, name: '教学楼前' },
  { sky: 0xffd6e0, skyBottom: 0xfff0f4, ground: 0xd0bfa6, groundLine: 0xab9676, deco: 0xf2a7c0, name: '课间空地' },
]

export class BattleScene extends Phaser.Scene {
  private W = 800
  private H = 450
  private groundY = 360

  private hero!: Phaser.GameObjects.Container
  private heroGfx!: Phaser.GameObjects.Graphics
  private enemy!: Phaser.GameObjects.Container
  private enemyEmojiText!: Phaser.GameObjects.Text
  private enemyCrown!: Phaser.GameObjects.Text
  private enemyNameText!: Phaser.GameObjects.Text
  private bg!: Phaser.GameObjects.Graphics
  private decos: Phaser.GameObjects.GameObject[] = []

  private heroBaseX = 180
  private enemyBaseX = 600
  private busy = false

  constructor() {
    super('battle')
  }

  create() {
    this.W = this.scale.width
    this.H = this.scale.height
    this.groundY = Math.round(this.H * 0.78)
    this.heroBaseX = Math.round(this.W * 0.24)
    this.enemyBaseX = Math.round(this.W * 0.74)

    this.bg = this.add.graphics()
    this.drawBackground(THEMES[Math.floor(Math.random() * THEMES.length)])

    // 主角火柴人
    this.heroGfx = this.add.graphics()
    this.drawStickman(this.heroGfx)
    this.hero = this.add.container(this.heroBaseX, this.groundY, [this.heroGfx])
    // 主角名牌 + 表情
    const heroFace = this.add.text(0, -86, '🧒', { fontSize: '30px' }).setOrigin(0.5)
    this.hero.add(heroFace)

    // 敌人（emoji + 名字）；Boss 多一顶皇冠、形象更大，跟同学小怪明显区分
    this.enemyEmojiText = this.add.text(0, -58, '🙂', { fontSize: '54px' }).setOrigin(0.5)
    this.enemyCrown = this.add.text(0, -104, '👑', { fontSize: '30px' }).setOrigin(0.5).setVisible(false)
    this.enemyNameText = this.add
      .text(0, 8, '', {
        fontSize: '18px',
        color: '#5b4632',
        fontStyle: 'bold',
        backgroundColor: '#ffffffcc',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5)
    this.enemy = this.add.container(this.enemyBaseX, this.groundY, [
      this.enemyEmojiText,
      this.enemyCrown,
      this.enemyNameText,
    ])

    // 主角待机轻浮动
    this.tweens.add({
      targets: this.hero,
      y: this.groundY - 6,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    })
  }

  // ── 背景：随机横版场景（纯 Graphics）────────────────────────────────
  private drawBackground(theme: SceneTheme) {
    this.bg.clear()
    for (const d of this.decos) d.destroy()
    this.decos = []

    // 天空渐变（分层矩形近似）
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
    // 地面
    this.bg.fillStyle(theme.ground, 1)
    this.bg.fillRect(0, this.groundY, this.W, this.H - this.groundY)
    this.bg.lineStyle(4, theme.groundLine, 1)
    this.bg.lineBetween(0, this.groundY, this.W, this.groundY)

    // 远景装饰：几丛草/小树（三角+圆）
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
    // 云朵
    for (let i = 0; i < 3; i++) {
      const x = 80 + i * (this.W / 3) + Math.random() * 60
      const y = 40 + Math.random() * 60
      const cloud = this.add.text(x, y, '☁️', { fontSize: '34px' }).setOrigin(0.5).setAlpha(0.85).setDepth(-1)
      this.decos.push(cloud)
      this.tweens.add({ targets: cloud, x: x + 30, duration: 6000 + i * 1500, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    }
  }

  // ── 火柴人：简单线条小人 ──────────────────────────────────────────
  private drawStickman(g: Phaser.GameObjects.Graphics) {
    g.clear()
    g.lineStyle(6, 0x3e2409, 1)
    // 头（圆）
    g.strokeCircle(0, -58, 16)
    // 身体
    g.lineBetween(0, -42, 0, 2)
    // 手臂
    g.lineBetween(0, -28, -22, -8)
    g.lineBetween(0, -28, 22, -8)
    // 腿
    g.lineBetween(0, 2, -16, 34)
    g.lineBetween(0, 2, 16, 34)
  }

  // ── React 调用的接口方法 ─────────────────────────────────────────

  /** 新敌人登场：换 emoji/名字，从右侧淡入弹跳。Boss 更大 + 皇冠 + 红牌；同学小怪更小。 */
  spawnEnemy(emoji: string, name: string, isBoss = false) {
    this.enemyEmojiText.setText(emoji)
    this.enemyEmojiText.setFontSize(isBoss ? 76 : 46)
    this.enemyCrown.setVisible(isBoss)
    this.enemyNameText.setText(name)
    this.enemyNameText.setStyle({
      fontSize: isBoss ? '20px' : '15px',
      color: isBoss ? '#9f1239' : '#5b4632',
      fontStyle: 'bold',
      backgroundColor: isBoss ? '#ffe4e6ee' : '#ffffffcc',
      padding: { x: 8, y: 3 },
    })
    this.enemy.setAlpha(0)
    this.enemy.setScale(0.6)
    this.enemy.x = this.enemyBaseX + 80
    this.enemy.y = this.groundY
    this.enemyEmojiText.setAngle(0)
    this.tweens.add({
      targets: this.enemy,
      x: this.enemyBaseX,
      alpha: 1,
      scale: 1,
      duration: 420,
      ease: 'back.out',
    })
    // 偶尔换个背景，增加新鲜感
    if (Math.random() < 0.34) this.drawBackground(THEMES[Math.floor(Math.random() * THEMES.length)])
  }

  /** 播放一次攻击/受击：attacker 冲向 target，命中后弹回；target 抖动；飘招式特效。 */
  playHit(attacker: Side, kind: AttackKind, opts?: { crit?: boolean; damage?: number }) {
    const atkObj = attacker === 'hero' ? this.hero : this.enemy
    const tgtObj = attacker === 'hero' ? this.enemy : this.hero
    const dir = attacker === 'hero' ? 1 : -1
    const startX = attacker === 'hero' ? this.heroBaseX : this.enemyBaseX
    const meta = ATTACK_META[kind]

    this.busy = true
    const lungeX = startX + dir * (Math.abs(this.enemyBaseX - this.heroBaseX) - 90)
    // 冲上去 → 命中 → 弹回（两段 tween，命中时机最可控）
    this.tweens.add({
      targets: atkObj,
      x: lungeX,
      duration: 180,
      ease: 'quad.in',
      onComplete: () => {
        this.onImpact(tgtObj, dir, meta.emoji, kind, opts)
        this.tweens.add({
          targets: atkObj,
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

  private onImpact(
    tgtObj: Phaser.GameObjects.Container,
    dir: number,
    fxEmoji: string,
    kind: AttackKind,
    opts?: { crit?: boolean; damage?: number }
  ) {
    // 目标抖动
    this.tweens.add({
      targets: tgtObj,
      x: tgtObj.x + dir * 18,
      duration: 60,
      yoyo: true,
      repeat: 2,
      ease: 'sine.inOut',
    })
    // 受击泛红闪一下：Text(敌人 emoji) 支持 tint；Graphics(火柴人) 不支持 tint，用闪烁代替
    if (tgtObj === this.enemy) {
      this.enemyEmojiText.setTint(0xff5a5a)
      this.time.delayedCall(180, () => this.enemyEmojiText.clearTint())
    } else {
      this.tweens.add({ targets: this.heroGfx, alpha: 0.3, duration: 70, yoyo: true, repeat: 1 })
    }

    // 招式特效 emoji 从攻击者飞到目标
    const fx = this.add.text(tgtObj.x - dir * 40, tgtObj.y - 50, fxEmoji, { fontSize: '40px' }).setOrigin(0.5)
    this.tweens.add({
      targets: fx,
      x: tgtObj.x,
      y: tgtObj.y - 70,
      scale: { from: 0.6, to: 1.6 },
      angle: dir * 40,
      alpha: { from: 1, to: 0 },
      duration: 420,
      ease: 'quad.out',
      onComplete: () => fx.destroy(),
    })

    // 飘伤害字
    if (opts?.damage && opts.damage > 0) {
      const dmgColor = opts.crit ? '#f43f5e' : '#3e2409'
      const dmgSize = opts.crit ? '40px' : '28px'
      const dmg = this.add
        .text(tgtObj.x, tgtObj.y - 90, `-${opts.damage}`, {
          fontSize: dmgSize,
          color: dmgColor,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
      this.tweens.add({
        targets: dmg,
        y: tgtObj.y - 150,
        alpha: { from: 1, to: 0 },
        duration: 800,
        ease: 'quad.out',
        onComplete: () => dmg.destroy(),
      })
    }

    // 暴击：屏幕抖 + 闪光环 + “暴击!”
    if (opts?.crit) {
      this.cameras.main.shake(220, 0.012)
      this.cameras.main.flash(160, 255, 230, 120)
      const crit = this.add
        .text(tgtObj.x, tgtObj.y - 120, '暴击!', { fontSize: '34px', color: '#f59e0b', fontStyle: 'bold' })
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
      this.cameras.main.shake(120, 0.006)
    }

    // 挠痒痒：目标额外抖一下并冒笑
    if (kind === 'tickle') {
      const laugh = this.add.text(tgtObj.x + 30, tgtObj.y - 60, '😆', { fontSize: '26px' }).setOrigin(0.5)
      this.tweens.add({ targets: laugh, y: tgtObj.y - 110, alpha: 0, duration: 700, onComplete: () => laugh.destroy() })
    }
  }

  /**
   * 损人嘴炮特效：那句话砸成大字、屏幕猛抖、一堆嘲讽 emoji 朝敌人爆发出去。
   * 「侮辱性极强」的演出（低伤害的视觉补偿）。
   */
  playDiss(text: string, damage?: number) {
    // 敌人脸红 + 抖
    this.enemyEmojiText.setTint(0xff5a5a)
    this.time.delayedCall(300, () => this.enemyEmojiText.clearTint())
    this.tweens.add({ targets: this.enemy, x: this.enemy.x + 14, duration: 55, yoyo: true, repeat: 4, ease: 'sine.inOut' })

    // 屏幕猛抖 + 一闪
    this.cameras.main.shake(360, 0.018)
    this.cameras.main.flash(120, 255, 120, 120)

    // 大字（那句话）从中间砸出来，带轻微抖动后淡出
    const big = this.add
      .text(this.W / 2, this.H * 0.36, text, {
        fontSize: '40px',
        color: '#e11d48',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: this.W * 0.86 },
        stroke: '#ffffff',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(50)
    this.tweens.add({
      targets: big,
      scale: { from: 0.4, to: 1.15 },
      angle: { from: -4, to: 4 },
      duration: 180,
      ease: 'back.out',
      yoyo: true,
      hold: 700,
      onComplete: () => {
        this.tweens.add({ targets: big, alpha: 0, scale: 1.4, duration: 320, onComplete: () => big.destroy() })
      },
    })

    // 嘲讽 emoji 爆发：从主角朝敌人飞一串
    const burst = ['💢', '😤', '🤣', '👎', '🗯️', '💩', '😝']
    for (let i = 0; i < 9; i++) {
      const em = burst[Math.floor(Math.random() * burst.length)]
      const t = this.add.text(this.heroBaseX, this.groundY - 50, em, { fontSize: '30px' }).setOrigin(0.5).setDepth(45)
      this.tweens.add({
        targets: t,
        x: this.enemyBaseX + (Math.random() * 80 - 40),
        y: this.groundY - 40 - Math.random() * 120,
        angle: Math.random() * 360,
        scale: { from: 0.6, to: 1.4 },
        alpha: { from: 1, to: 0 },
        duration: 600 + Math.random() * 300,
        delay: i * 40,
        ease: 'quad.out',
        onComplete: () => t.destroy(),
      })
    }

    // 飘伤害字
    if (damage && damage > 0) {
      const dmg = this.add
        .text(this.enemy.x, this.enemy.y - 90, `-${damage}`, { fontSize: '28px', color: '#e11d48', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setDepth(46)
      this.tweens.add({ targets: dmg, y: this.enemy.y - 150, alpha: 0, duration: 800, onComplete: () => dmg.destroy() })
    }
  }

  /**
   * 队友（多人共斗）打出的命中：从天而降一记拳头砸在敌人头上，标出是谁打的。
   * 跟本地 hero 攻击区分开（不动主角），让所有端都看到「队友也在打同一个 Boss」。
   */
  playPeerHit(byName: string, damage?: number, crit?: boolean) {
    const tx = this.enemy.x
    const ty = this.enemy.y
    // 天降拳头
    const fist = this.add.text(tx, ty - 220, '👊', { fontSize: '46px' }).setOrigin(0.5).setDepth(48).setAlpha(0)
    this.tweens.add({
      targets: fist,
      y: ty - 60,
      alpha: { from: 1, to: 1 },
      duration: 240,
      ease: 'quad.in',
      onComplete: () => {
        this.cameras.main.shake(crit ? 200 : 120, crit ? 0.012 : 0.006)
        this.enemyEmojiText.setTint(0x7dd3fc)
        this.time.delayedCall(160, () => this.enemyEmojiText.clearTint())
        this.tweens.add({ targets: fist, alpha: 0, y: ty - 90, duration: 220, onComplete: () => fist.destroy() })
      },
    })
    // 队友名牌
    const tag = this.add
      .text(tx, ty - 130, `队友 ${byName}!`, {
        fontSize: '18px',
        color: '#0284c7',
        fontStyle: 'bold',
        backgroundColor: '#e0f2feee',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(49)
    this.tweens.add({ targets: tag, y: ty - 170, alpha: { from: 1, to: 0 }, duration: 900, delay: 200, onComplete: () => tag.destroy() })
    if (damage && damage > 0) {
      const dmg = this.add
        .text(tx + 20, ty - 90, `-${damage}`, { fontSize: crit ? '32px' : '24px', color: '#0284c7', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setDepth(49)
      this.tweens.add({ targets: dmg, y: ty - 150, alpha: 0, duration: 800, delay: 240, onComplete: () => dmg.destroy() })
    }
  }

  /** 敌人倒下：旋转倒地 + 淡出。 */
  playDown(side: Side) {
    const obj = side === 'enemy' ? this.enemy : this.hero
    this.tweens.add({
      targets: obj,
      angle: side === 'enemy' ? 90 : -90,
      y: this.groundY + 20,
      alpha: 0.2,
      duration: 520,
      ease: 'quad.in',
    })
    const star = this.add.text(obj.x, obj.y - 70, '💫', { fontSize: '34px' }).setOrigin(0.5)
    this.tweens.add({ targets: star, angle: 360, alpha: 0, duration: 700, onComplete: () => star.destroy() })
  }

  isBusy() {
    return this.busy
  }
}
