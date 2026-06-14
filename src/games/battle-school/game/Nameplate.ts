// 头顶名牌 + 血条（所有角色共用：主角 / 小怪 / Boss）。
//   · 名字牌：小药丸（圆角底 + 描边文字），可读。
//   · 血条：名字下方一道细条，按 hp/maxHp 收缩，低血变橙/红。
// 由各实体每帧调 update(x, topY, ratio) 跟随到角色头顶。纯表演，不含逻辑。

import Phaser from 'phaser'

const NAME_FONT = 14
const BAR_W_DEFAULT = 56
const BAR_H = 5
const GAP = 4 // 名字与血条间距

export class Nameplate {
  private container: Phaser.GameObjects.Container
  private barFill: Phaser.GameObjects.Rectangle
  private readonly barW: number
  private readonly accent: number
  private lastRatio = -1

  constructor(scene: Phaser.Scene, name: string, accent: number, barWidth = BAR_W_DEFAULT, fontSize = NAME_FONT) {
    this.barW = barWidth
    this.accent = accent
    const c = scene.add.container(0, 0).setDepth(120)

    // 名字牌：描边文字（自带可读底）。
    const label = scene.add
      .text(0, 0, name, {
        fontSize: `${fontSize}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#10131f',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)

    // 血条（底 + 填充），位于名字下方。
    const barY = GAP
    const barBg = scene.add.rectangle(0, barY, barWidth, BAR_H, 0x10131f, 0.78).setOrigin(0.5, 0)
    barBg.setStrokeStyle(1, 0x000000, 0.5)
    const barFill = scene.add.rectangle(-barWidth / 2, barY, barWidth, BAR_H, accent, 1).setOrigin(0, 0)

    c.add([label, barBg, barFill])
    this.container = c
    this.barFill = barFill
  }

  /** 跟随到角色头顶。x=角色中心，topY=角色顶部 y（名牌悬在它上方一点）。 */
  update(x: number, topY: number, ratio: number): void {
    this.container.setPosition(Math.round(x), Math.round(topY - 14))
    if (ratio !== this.lastRatio) {
      this.lastRatio = ratio
      const r = Phaser.Math.Clamp(ratio, 0, 1)
      this.barFill.width = this.barW * r
      // 颜色随血量（每次从 accent 重算，回血也能恢复）：满→accent，中→橙，低→红。
      const color = r > 0.5 ? this.accent : r > 0.25 ? 0xffc043 : 0xff5a5a
      this.barFill.setFillStyle(color, 1)
    }
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v)
  }

  destroy(): void {
    this.container.destroy()
  }
}
