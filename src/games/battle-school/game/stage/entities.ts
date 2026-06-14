// 关卡实体的运行期辅助（entities）：把 ResolvedStage 的纯数据，变成场景里能用的
//   碰撞体 / 触发器 / 判定函数。这里只做"地形物件的行为"，不含波次/答题/数值（那些在 ArenaScene）。
//
//   · buildPlatform / buildPipe / buildQBlock：建静态碰撞体（主角与敌人都能站/挡）。
//   · Pit：真坑——主角脚底掉到坑底线以下且水平落在坑内 → 触发 onFall（扣血+回到最近安全点，非死）。
//   · QBlockState：?块被顶（从下往上撞）→ onPop 一次性发奖励（金币/能量），随后变成已用块。
//   · TrapState：伪装陷阱——主角踩到这段地面 → checkTrigger 触发一次（扣血/击退，非死）。
//   · stompResult：踩怪判定——主角下落、脚底压在敌人头顶上方一带 → 踩杀/弹起。

import Phaser from 'phaser'
import type {
  ResolvedPlatform,
  ResolvedPipe,
  ResolvedQBlock,
  ResolvedPit,
  ResolvedTrap,
} from './StageDef'

const PLATFORM_THICK = 26
const PIPE_W = 84
const QBLOCK_SIZE = 40

/** 在 worldY = groundY - h 处建一块浮空平台静态碰撞体（不可见命中体 + 一块可见外观）。 */
export function buildPlatform(
  scene: Phaser.Scene,
  group: Phaser.Physics.Arcade.StaticGroup,
  p: ResolvedPlatform,
  groundY: number,
  color: number,
  edgeColor: number,
): void {
  const topY = groundY - p.h
  const cy = topY + PLATFORM_THICK / 2
  // 可见外观（砖块感：填充 + 上沿亮线）。
  const g = scene.add.graphics().setDepth(4)
  g.fillStyle(color, 1)
  g.fillRoundedRect(p.x - p.w / 2, topY, p.w, PLATFORM_THICK, 6)
  g.lineStyle(3, edgeColor, 1)
  g.strokeRoundedRect(p.x - p.w / 2, topY, p.w, PLATFORM_THICK, 6)
  // 碰撞体（不可见矩形）。
  const rect = scene.add.rectangle(p.x, cy, p.w, PLATFORM_THICK, 0x000000, 0)
  group.add(rect)
  const body = rect.body as Phaser.Physics.Arcade.StaticBody
  body.updateFromGameObject()
}

/** 建一根管道（露出地面 h 高的实心障碍：可踩顶、挡路）。 */
export function buildPipe(
  scene: Phaser.Scene,
  group: Phaser.Physics.Arcade.StaticGroup,
  p: ResolvedPipe,
  groundY: number,
): void {
  const topY = groundY - p.h
  const g = scene.add.graphics().setDepth(4)
  // 管身。
  g.fillStyle(0x2e8b57, 1)
  g.fillRect(p.x - PIPE_W / 2, topY + 14, PIPE_W, p.h - 14)
  g.lineStyle(3, 0x14532d, 1)
  g.strokeRect(p.x - PIPE_W / 2, topY + 14, PIPE_W, p.h - 14)
  // 管口（更宽一圈）。
  g.fillStyle(0x3cb371, 1)
  g.fillRoundedRect(p.x - PIPE_W / 2 - 8, topY, PIPE_W + 16, 18, 5)
  g.lineStyle(3, 0x14532d, 1)
  g.strokeRoundedRect(p.x - PIPE_W / 2 - 8, topY, PIPE_W + 16, 18, 5)
  // 碰撞体（整根，含口）。
  const rect = scene.add.rectangle(p.x, groundY - p.h / 2, PIPE_W, p.h, 0x000000, 0)
  group.add(rect)
  ;(rect.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject()
}

/** ?块运行期状态：建一个可顶的方块；顶过一次后变灰、不再发奖励。 */
export class QBlockState {
  readonly x: number
  readonly h: number
  readonly reward: 'coin' | 'energy'
  popped = false
  private readonly body: Phaser.Physics.Arcade.StaticBody
  private readonly rect: Phaser.GameObjects.Rectangle
  private readonly label: Phaser.GameObjects.Text

  constructor(
    scene: Phaser.Scene,
    group: Phaser.Physics.Arcade.StaticGroup,
    q: ResolvedQBlock,
    groundY: number,
  ) {
    this.x = q.x
    this.h = q.h
    this.reward = q.reward
    const cy = groundY - q.h - QBLOCK_SIZE / 2
    this.rect = scene.add.rectangle(q.x, cy, QBLOCK_SIZE, QBLOCK_SIZE, 0xf2a23c, 1).setDepth(5)
    this.rect.setStrokeStyle(3, 0x8a5a14, 1)
    this.label = scene.add.text(q.x, cy, '?', {
      fontSize: '24px', color: '#ffffff', fontStyle: 'bold', stroke: '#8a5a14', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(6)
    group.add(this.rect)
    this.body = this.rect.body as Phaser.Physics.Arcade.StaticBody
    this.body.updateFromGameObject()
  }

  /** 顶出奖励（一次性）。返回 true=本次真的发了奖励。 */
  pop(): boolean {
    if (this.popped) return false
    this.popped = true
    this.label.setText('').setVisible(false)
    this.rect.setFillStyle(0x8a8f99, 1)
    this.rect.setStrokeStyle(3, 0x5a5f69, 1)
    // 撞块弹一下。
    this.rect.scene.tweens.add({ targets: [this.rect], y: this.rect.y - 8, duration: 90, yoyo: true })
    return true
  }
}

/** 真坑运行期状态：判断主角是否掉进坑里（水平落在坑内 + 脚底低于坑沿线）。 */
export class Pit {
  readonly x: number
  readonly w: number
  readonly real: boolean

  constructor(scene: Phaser.Scene, p: ResolvedPit, groundY: number) {
    this.x = p.x
    this.w = p.w
    this.real = p.real
    // 可见：在坑这段把地面挖空（画一个比地面深一点的暗色缺口 + 边沿）。
    const g = scene.add.graphics().setDepth(3)
    g.fillStyle(0x10131a, 1)
    g.fillRect(p.x, groundY + 2, p.w, 120)
    g.lineStyle(3, 0x000000, 0.5)
    g.lineBetween(p.x, groundY, p.x, groundY + 60)
    g.lineBetween(p.x + p.w, groundY, p.x + p.w, groundY + 60)
  }

  /** 主角脚底 (heroX, heroFootY) 是否落进了这个坑（水平在坑内、脚底已过坑沿）。 */
  contains(heroX: number, heroFootY: number, groundY: number): boolean {
    return heroX > this.x && heroX < this.x + this.w && heroFootY > groundY + 12
  }
}

/** 伪装陷阱运行期状态：踩到这段地面触发一次（非死）。 */
export class TrapState {
  readonly x: number
  readonly w: number
  triggered = false
  private readonly mark: Phaser.GameObjects.Rectangle

  constructor(scene: Phaser.Scene, t: ResolvedTrap, groundY: number) {
    this.x = t.x
    this.w = t.w
    // 伪装：和地面几乎同色的一小块（细看有一道裂缝），踩中才显形。
    this.mark = scene.add.rectangle(t.x + t.w / 2, groundY + 6, t.w, 8, 0x000000, 0.18).setDepth(3)
  }

  /** 主角脚底在地面、且水平踩在陷阱段内 → 触发一次。 */
  checkTrigger(heroX: number, heroFootY: number, groundY: number): boolean {
    if (this.triggered) return false
    const onGround = Math.abs(heroFootY - groundY) < 14
    if (!onGround) return false
    if (heroX < this.x || heroX > this.x + this.w) return false
    this.triggered = true
    // 显形：红色尖刺感。
    this.mark.setFillStyle(0xc0392b, 0.85)
    this.mark.scene.tweens.add({ targets: this.mark, scaleY: 2.4, y: this.mark.y - 6, duration: 120, yoyo: true })
    return true
  }
}

/** 踩怪判定结果：'kill'=踩死，'bounce'=踩到但只弹起（如 Boss/护盾），'none'=没踩到。 */
export type StompResult = 'kill' | 'bounce' | 'none'

/**
 * 踩怪判定：主角是否从上方踩在敌人头顶。
 * @param heroFootY 主角脚底 y
 * @param heroVY 主角竖直速度（>0 在下落）
 * @param enemyTopY 敌人头顶 y
 * @param enemyX / heroX 水平位置（需大致对齐）
 * @param enemyHalfW 敌人半宽（水平重叠容差）
 * @param killable 该敌人是否能被踩死（Boss/护盾中→false 只弹）
 */
export function stompResult(
  heroFootY: number,
  heroVY: number,
  enemyTopY: number,
  heroX: number,
  enemyX: number,
  enemyHalfW: number,
  killable: boolean,
): StompResult {
  if (heroVY <= 60) return 'none' // 必须在下落中
  if (Math.abs(heroX - enemyX) > enemyHalfW + 28) return 'none' // 水平要大致压在头上
  // 脚底落在敌人头顶上方一带（容差），算踩中。
  if (heroFootY > enemyTopY + 46 || heroFootY < enemyTopY - 40) return 'none'
  return killable ? 'kill' : 'bounce'
}
