// 轻量飘浮快题（Phaser 原生，不进 React 卡片）：学霸大招/快速答题用。
//   · 悬在主角头顶附近，一行题干 + 2–4 个小选项 chip。
//   · 不卡屏：点选/超时即「飘起来 + 淡出」自动消失（auto-collapsing），绝不常驻。
//   · 限时进度条贴在卡片底部；超时按答错（null）回调。
// 纯表演 + 收集一次答案；判定/扣血/放招在 ArenaScene。

import Phaser from 'phaser'
import type { BattleQuestion } from '@/games/_battle/core'

const CARD_DEPTH = 130
const PAD = 12
const CHIP_H = 34
const CHIP_GAP = 6
const MAX_W = 360

export class FloatingQuiz {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private timerBar: Phaser.GameObjects.Rectangle
  private timerW: number
  private resolved = false
  private onAnswer: (choiceId: string | null) => void
  private timeoutEv?: Phaser.Time.TimerEvent
  private tickEv?: Phaser.Time.TimerEvent
  private elapsed = 0
  private readonly durationMs: number
  /** 当前题 id（场景换题/重开时比对，避免回调串）。 */
  readonly questionId: string

  constructor(
    scene: Phaser.Scene,
    q: BattleQuestion,
    opts: { x: number; y: number; subjectLabel: string; accent: number; seconds: number },
    onAnswer: (choiceId: string | null) => void,
  ) {
    this.scene = scene
    this.onAnswer = onAnswer
    this.questionId = q.id
    this.durationMs = opts.seconds * 1000

    const c = scene.add.container(opts.x, opts.y).setDepth(CARD_DEPTH).setScrollFactor(1)

    // 题干（自动换行）。
    const prompt = scene.add
      .text(0, 0, q.prompt, {
        fontSize: '16px',
        color: '#10131f',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: MAX_W - PAD * 2 },
      })
      .setOrigin(0.5, 0)

    // 学科标签小药丸。
    const tag = scene.add
      .text(0, 0, `⚡ ${opts.subjectLabel}`, {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#00000055',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5, 0)

    // 选项 chips（横排，过宽则两两换行）。
    const chips: Phaser.GameObjects.Container[] = []
    for (const choice of q.choices) {
      chips.push(this.makeChip(choice.id, choice.text))
    }

    // 布局：tag → prompt → chips（多行）。
    const tagH = 22
    const promptY = tagH + 6
    tag.setPosition(0, 0)
    prompt.setPosition(0, promptY)
    const promptH = prompt.height
    let cy = promptY + promptH + 10

    // chips 排版：尽量一行放下，超出 MAX_W 就换行。
    const rows: Phaser.GameObjects.Container[][] = [[]]
    let rowW = 0
    for (const chip of chips) {
      const w = (chip.getData('w') as number) + CHIP_GAP
      if (rowW + w > MAX_W && rows[rows.length - 1].length > 0) {
        rows.push([])
        rowW = 0
      }
      rows[rows.length - 1].push(chip)
      rowW += w
    }
    for (const row of rows) {
      const totalW = row.reduce((s, ch) => s + (ch.getData('w') as number) + CHIP_GAP, 0) - CHIP_GAP
      let x = -totalW / 2
      for (const chip of row) {
        const w = chip.getData('w') as number
        chip.setPosition(x + w / 2, cy + CHIP_H / 2)
        x += w + CHIP_GAP
      }
      cy += CHIP_H + CHIP_GAP
    }
    const contentBottom = cy + 4

    // 背板（半透明白圆角）。
    const halfW = MAX_W / 2
    const bg = scene.add.graphics()
    bg.fillStyle(0xffffff, 0.96)
    bg.fillRoundedRect(-halfW, -PAD, MAX_W, contentBottom + PAD * 2, 16)
    bg.lineStyle(3, opts.accent, 0.9)
    bg.strokeRoundedRect(-halfW, -PAD, MAX_W, contentBottom + PAD * 2, 16)

    // 限时条（卡片底部）。
    this.timerW = MAX_W - PAD * 2
    const barY = contentBottom + PAD - 2
    const barBg = scene.add.rectangle(0, barY, this.timerW, 4, 0x000000, 0.12).setOrigin(0.5, 0)
    this.timerBar = scene.add.rectangle(-this.timerW / 2, barY, this.timerW, 4, opts.accent, 1).setOrigin(0, 0)

    c.add([bg, barBg, this.timerBar, tag, prompt, ...chips])
    this.container = c

    // 弹入动画。
    c.setScale(0.7).setAlpha(0)
    scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' })

    // 限时：tick 更新进度条，到时按超时。
    this.tickEv = scene.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        this.elapsed += 50
        const r = Phaser.Math.Clamp(1 - this.elapsed / this.durationMs, 0, 1)
        this.timerBar.width = this.timerW * r
        if (r < 0.34) this.timerBar.setFillStyle(0xff5a5a, 1)
      },
    })
    this.timeoutEv = scene.time.delayedCall(this.durationMs, () => this.resolve(null))
  }

  private makeChip(id: string, text: string): Phaser.GameObjects.Container {
    const label = this.scene.add
      .text(0, 0, text, { fontSize: '14px', color: '#10131f', fontStyle: 'bold' })
      .setOrigin(0.5)
    const w = Math.max(54, label.width + 24)
    const bg = this.scene.add.graphics()
    bg.fillStyle(0xeef2f9, 1)
    bg.fillRoundedRect(-w / 2, -CHIP_H / 2, w, CHIP_H, 10)
    bg.lineStyle(2, 0xc7d2e0, 1)
    bg.strokeRoundedRect(-w / 2, -CHIP_H / 2, w, CHIP_H, 10)
    const chip = this.scene.add.container(0, 0, [bg, label])
    chip.setData('w', w)
    // 命中区 = chip 矩形。
    chip.setSize(w, CHIP_H)
    chip.setInteractive({ useHandCursor: true })
    chip.on('pointerdown', () => {
      if (this.resolved) return
      bg.clear()
      bg.fillStyle(0xffd23f, 1)
      bg.fillRoundedRect(-w / 2, -CHIP_H / 2, w, CHIP_H, 10)
      this.resolve(id)
    })
    return chip
  }

  private resolve(choiceId: string | null): void {
    if (this.resolved) return
    this.resolved = true
    this.timeoutEv?.remove()
    this.tickEv?.remove()
    const cb = this.onAnswer
    // 飘起来 + 淡出后销毁（auto-collapsing）。
    this.scene.tweens.add({
      targets: this.container,
      y: this.container.y - 40,
      alpha: 0,
      scale: 0.85,
      duration: 240,
      ease: 'Quad.easeIn',
      onComplete: () => this.container.destroy(),
    })
    cb(choiceId)
  }

  /** 跟随主角头顶（场景每帧调，让卡片飘在主角附近）。 */
  follow(x: number, y: number): void {
    if (this.resolved) return
    this.container.x = Phaser.Math.Linear(this.container.x, x, 0.2)
    this.container.y = Phaser.Math.Linear(this.container.y, y, 0.2)
  }

  /** 强制收起（场景重开/胜负时）。 */
  dismiss(): void {
    if (this.resolved) {
      this.container.destroy()
      return
    }
    this.resolved = true
    this.timeoutEv?.remove()
    this.tickEv?.remove()
    this.container.destroy()
  }

  get isResolved(): boolean {
    return this.resolved
  }
}
