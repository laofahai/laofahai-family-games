// 主角：Arcade Physics 精灵。左右跑、跳（重力 + 起跳无敌帧）、近战「真理巴掌」（前方短命中区）。
// 动画：移动=走路循环、静止=idle、空中=jump 帧、攻击=attack2 姿势、受击=hurt 闪红。
// 朝向跟随移动翻转。挤压拉伸（squash-stretch）在起跳/落地由场景调用。
// 头顶名字牌 + 血条由 Nameplate 负责（场景每帧调 syncPlate）。
// 不含游戏规则（伤害数值、波次）——那些在 ArenaScene 里；本类只管「这一个角色怎么动怎么演」。
// 美术沿用 Kenney「Toon Characters 1」：精灵 key 恒为 hero、攻击帧名 attack2。
// TODO 性别区分待女版 Kenney 素材：现在不按性别换精灵，主角统一用 hero。

import Phaser from 'phaser'
import { HERO_KEY, texKey, walkAnimKey } from './assets'
import { Nameplate } from './Nameplate'

const DISPLAY_H = 138 // 主角显示高（px），脚底锚点
const RUN_SPEED = 300 // 跑速 px/s
const JUMP_V = 780 // 起跳初速度
export const HERO_MAX_HP = 6
const ATTACK_MS = 280 // 一次攻击动作时长
const HURT_MS = 280 // 受击硬直/闪红时长
const INVULN_MS = 600 // 受击后短暂无敌
const JUMP_IFRAME_MS = 360 // 起跳上升段无敌帧（用于跳跃躲攻击）

export class Hero extends Phaser.Physics.Arcade.Sprite {
  hp = HERO_MAX_HP
  maxHp = HERO_MAX_HP
  facing: 1 | -1 = 1
  readonly displayName: string
  plate: Nameplate
  private attacking = false
  private hurtUntil = 0 // 闪红/硬直结束时间戳
  invulnUntil = 0 // 无敌结束时间戳
  /** 攻击命中区（前方的不可见矩形，仅在攻击窗口内启用）。 */
  hitbox!: Phaser.GameObjects.Zone & { body: Phaser.Physics.Arcade.Body }
  /** 命中过的敌人（一次挥击只打一次同一个目标）。 */
  hitThisSwing = new Set<Phaser.GameObjects.GameObject>()
  /** 攻击命中窗口是否开启。 */
  swingActive = false
  /** 当前静态姿势纹理 key（idle/attack2/hurt/jump）；只在变化时换贴图，避免每帧 setTexture 闪烁。 */
  private poseKey = ''

  constructor(scene: Phaser.Scene, x: number, y: number, displayName: string) {
    super(scene, x, y, texKey(HERO_KEY, 'idle'))
    this.displayName = displayName
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // 按【该纹理真实高】缩放到统一显示高（Kenney 帧高一致，行为与常量相同，更稳妥）。
    const scale = DISPLAY_H / this.height
    this.setScale(scale)
    this.setOrigin(0.5, 1) // 脚底为锚点，落在地面上
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setCollideWorldBounds(true)
    // 物理体收窄到角色躯干（精灵有透明留白），避免「隔空挨打」。
    const bw = this.displayWidth * 0.40
    const bh = this.displayHeight * 0.84
    body.setSize(bw / scale, bh / scale)
    body.setOffset((this.width - bw / scale) / 2, this.height - bh / scale)
    this.setDepth(50)

    // 攻击命中区（Zone + Arcade body），平时禁用、攻击窗口才启用。
    // 高度收窄、贴身体中段：让跳跃能躲过地面攻击的同时巴掌仍好打。
    const zone = scene.add.zone(x, y, DISPLAY_H * 0.95, DISPLAY_H * 0.7)
    scene.physics.add.existing(zone)
    const zb = zone.body as Phaser.Physics.Arcade.Body
    zb.setAllowGravity(false)
    zb.enable = false
    this.hitbox = zone as Hero['hitbox']

    // 头顶名字牌 + 血条（主角名牌用淡蓝主色）。
    this.plate = new Nameplate(scene, displayName, 0x7cc0ff, 56)
  }

  /** 每帧由场景调用：根据移动意图驱动速度、动画、朝向，并同步名牌。 */
  drive(dir: -1 | 0 | 1, frozen: boolean): void {
    const body = this.body as Phaser.Physics.Arcade.Body
    const onGround = body.blocked.down || body.touching.down

    if (frozen) {
      body.setVelocityX(0)
    } else if (!this.attacking) {
      body.setVelocityX(dir * RUN_SPEED)
      if (dir !== 0) {
        this.facing = dir
      }
    } else {
      // 攻击时小幅向前冲（手感），但不接受新方向。
      body.setVelocityX(body.velocity.x * 0.8)
    }

    this.flipX = this.facing === -1

    // 攻击命中区贴在身体前方，跟随位置（窄高度、贴身体中段，让跳跃能躲过地面攻击的同时巴掌仍好打）。
    const hb = this.hitbox.body
    const ahead = this.facing * this.displayWidth * 0.55
    const cy = this.y - this.displayHeight * 0.5
    hb.reset(this.x + ahead - hb.halfWidth, cy - hb.halfHeight)

    this.updateAnim(dir, onGround)
    this.syncPlate()
  }

  /** 同步头顶名牌/血条到当前位置与血量。 */
  syncPlate(): void {
    this.plate.update(this.x, this.y - this.displayHeight, this.hp / this.maxHp)
  }

  private updateAnim(dir: -1 | 0 | 1, onGround: boolean): void {
    if (this.attacking) {
      this.setPose('attack2')
      return
    }
    if (this.scene.time.now < this.hurtUntil) {
      this.setPose('hurt')
      return
    }
    if (!onGround) {
      this.setPose('jump')
      return
    }
    if (dir !== 0) {
      const key = walkAnimKey(HERO_KEY)
      if (this.anims.currentAnim?.key !== key || !this.anims.isPlaying) this.anims.play(key, true)
      this.poseKey = '' // 走路时清空静态姿势记号，下次进入静止会重新贴图
    } else {
      this.setPose('idle')
    }
  }

  /** 切到一个静态姿势贴图：只在姿势变化时 stop+setTexture，避免每帧重置导致 1 帧空白闪烁。 */
  private setPose(frame: 'idle' | 'attack2' | 'hurt' | 'jump'): void {
    if (this.poseKey === frame) return
    this.poseKey = frame
    this.anims.stop()
    this.setTexture(texKey(HERO_KEY, frame))
  }

  canJump(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body
    return (body.blocked.down || body.touching.down) && !this.attacking
  }

  jump(): void {
    if (!this.canJump()) return
    ;(this.body as Phaser.Physics.Arcade.Body).setVelocityY(-JUMP_V)
    // 起跳给一段无敌帧：上升段可越过地面攻击（不覆盖更长的受击无敌）。
    this.invulnUntil = Math.max(this.invulnUntil, this.scene.time.now + JUMP_IFRAME_MS)
    // 起跳挤压拉伸（果冻感）。
    this.scene.tweens.add({ targets: this, scaleY: this.scaleY * 1.12, scaleX: this.scaleX * 0.9, duration: 90, yoyo: true })
  }

  /** 触发一次攻击（真理巴掌）：开启命中窗口（场景在 overlap 里判敌）。返回是否真的挥出。 */
  startAttack(): boolean {
    if (this.attacking || this.scene.time.now < this.hurtUntil) return false
    this.attacking = true
    this.hitThisSwing.clear()
    // 巴掌起手：精灵 scale-pop（更有挥击感）。
    this.scene.tweens.add({ targets: this, scaleX: this.scaleX * 1.12, scaleY: this.scaleY * 0.94, duration: 80, yoyo: true })
    // 命中窗口在动作中段开启（提前蓄、收招前关）。
    this.scene.time.delayedCall(70, () => {
      this.swingActive = true
      this.hitbox.body.enable = true
    })
    this.scene.time.delayedCall(70 + 140, () => {
      this.swingActive = false
      this.hitbox.body.enable = false
    })
    this.scene.time.delayedCall(ATTACK_MS, () => {
      this.attacking = false
    })
    // 挥拳前冲一点。
    ;(this.body as Phaser.Physics.Arcade.Body).setVelocityX(this.facing * RUN_SPEED * 0.55)
    return true
  }

  isAttacking(): boolean {
    return this.attacking
  }

  /** 受击：扣血、闪红、短无敌、击退。返回是否真的受伤（无敌期内不受）。 */
  takeHit(dmg: number, fromX: number): boolean {
    const now = this.scene.time.now
    if (now < this.invulnUntil) return false
    this.hp = Math.max(0, this.hp - dmg)
    this.hurtUntil = now + HURT_MS
    this.invulnUntil = now + INVULN_MS
    this.attacking = false
    this.swingActive = false
    this.hitbox.body.enable = false
    // 受击闪红 + 击退。
    this.setTint(0xff5a5a)
    this.scene.time.delayedCall(HURT_MS, () => this.clearTint())
    const dir = this.x < fromX ? -1 : 1
    ;(this.body as Phaser.Physics.Arcade.Body).setVelocity(dir * 280, -260)
    // 受击闪烁（无敌提示）。
    this.scene.tweens.add({ targets: this, alpha: 0.35, duration: 80, yoyo: true, repeat: 3, onComplete: () => this.setAlpha(1) })
    return true
  }

  heal(n: number): void {
    this.hp = Math.min(this.maxHp, this.hp + n)
    this.setTint(0x7CFFB0)
    this.scene.time.delayedCall(220, () => this.clearTint())
  }

  isDead(): boolean {
    return this.hp <= 0
  }

  destroy(fromScene?: boolean): void {
    this.plate?.destroy()
    super.destroy(fromScene)
  }
}
