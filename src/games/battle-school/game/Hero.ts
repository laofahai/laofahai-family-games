// 主角：Arcade Physics 精灵。左右跑、跳（重力 + 起跳无敌帧）、近战「真理巴掌」（前方短命中区）。
// 动画：移动=走路循环、静止=idle、空中=jump 帧、攻击=attack2 姿势、受击=hurt 闪红。
// 朝向跟随移动翻转。挤压拉伸（squash-stretch）在起跳/落地由场景调用。
// 头顶名字牌 + 血条由 Nameplate 负责（场景每帧调 syncPlate）。
// 不含游戏规则（伤害数值、波次）——那些在 ArenaScene 里；本类只管「这一个角色怎么动怎么演」。
// 美术沿用 Kenney「Toon Characters 1」：攻击帧名 attack2。
// 精灵 key 按性别由场景传入（女=herog / 男=hero），本类只认这个 key 取帧/动画。

import Phaser from 'phaser'
import { HERO_KEY, texKey, walkAnimKey } from './assets'
import { Nameplate } from './Nameplate'

const DISPLAY_H = 138 // 主角显示高（px），脚底锚点
const RUN_SPEED = 300 // 跑速 px/s
const JUMP_V = 780 // 起跳初速度
export const HERO_MAX_HP = 6
const HURT_MS = 280 // 受击硬直/闪红时长
const INVULN_MS = 600 // 受击后短暂无敌
const JUMP_IFRAME_MS = 360 // 起跳上升段无敌帧（用于跳跃躲攻击）
const COMBO_RESET_MS = 800 // 停手 ~0.8s 后连招归零（#21）

/** 普攻三连招式：每招手感（动作时长/前冲/挤压/命中区前探/出招音/打击表演）各不同，肉眼可辨。 */
export interface MoveSpec {
  name: string // 飘字招式名（巴掌!/踹!/呸!）
  labelColor: string // 招式名飘字颜色（每招一色）
  attackMs: number // 这一招动作时长
  lungeMul: number // 前冲倍率（相对跑速）
  squashX: number // 出招挤压：横向缩放系数
  squashY: number // 出招挤压：纵向缩放系数
  hitboxAhead: number // 命中区前探（相对 displayWidth 的系数，越大打得越远）
  hitWindowDelay: number // 命中窗口开启延时（蓄招）
  hitWindowMs: number // 命中窗口时长
  sfx: 'slap' | 'kick' | 'spit' // 出招音
  vfxColor: number // 命中特效配色（火花/冲击）
  vfxShape: 'star' | 'ring' | 'wave' // 命中特效形状（巴掌=星 / 踹=冲击环 / 呸=喷溅波）
  knockback: number // 命中击退力度（呸/踹更强、带上挑）
  launch: number // 命中把敌人上挑的力度（第 3 招最强）
}

/** 大耳刮子 → 踹一脚 → 喝啐/毒舌（呸）。第 3 招更慢更狠、击退/上挑最强。 */
export const COMBO_MOVES: readonly MoveSpec[] = [
  { name: '巴掌!', labelColor: '#ffffff', attackMs: 260, lungeMul: 0.55, squashX: 1.14, squashY: 0.92, hitboxAhead: 0.55, hitWindowDelay: 60, hitWindowMs: 130, sfx: 'slap', vfxColor: 0xffffff, vfxShape: 'star', knockback: 280, launch: 60 },
  { name: '踹!', labelColor: '#ffb020', attackMs: 300, lungeMul: 0.85, squashX: 1.22, squashY: 0.86, hitboxAhead: 0.68, hitWindowDelay: 80, hitWindowMs: 140, sfx: 'kick', vfxColor: 0xffb020, vfxShape: 'ring', knockback: 430, launch: 120 },
  { name: '呸!', labelColor: '#7CFFB0', attackMs: 360, lungeMul: 0.30, squashX: 0.90, squashY: 1.16, hitboxAhead: 0.80, hitWindowDelay: 100, hitWindowMs: 160, sfx: 'spit', vfxColor: 0x7CFFB0, vfxShape: 'wave', knockback: 360, launch: 300 },
] as const

export class Hero extends Phaser.Physics.Arcade.Sprite {
  hp = HERO_MAX_HP
  maxHp = HERO_MAX_HP
  facing: 1 | -1 = 1
  readonly displayName: string
  /** 精灵款式 key（hero=男 / herog=女），按性别由场景传入。 */
  readonly charKey: string
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
  /** 当前连招步（0/1/2，对应 COMBO_MOVES）。停手 ~0.8s 自动归零。 */
  comboStep = 0
  private lastSwingAt = 0 // 上次出招时刻（判连招归零）
  private currentMove: MoveSpec = COMBO_MOVES[0] // 本次挥击用的招式（命中区前探随它）
  private baseScaleX = 1 // 原始缩放（squash/jump 以此为基准，避免 yoyo 叠加漂移）
  private baseScaleY = 1

  constructor(scene: Phaser.Scene, x: number, y: number, displayName: string, charKey: string = HERO_KEY) {
    super(scene, x, y, texKey(charKey, 'idle'))
    this.displayName = displayName
    this.charKey = charKey
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // 按【该纹理真实高】缩放到统一显示高（Kenney 帧高一致，行为与常量相同，更稳妥）。
    const scale = DISPLAY_H / this.height
    this.setScale(scale)
    this.baseScaleX = scale
    this.baseScaleY = scale
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
    // 前探距离随当前招式变化（踹/呸打得更远），让每招命中位置肉眼可辨（#21）。
    const hb = this.hitbox.body
    const ahead = this.facing * this.displayWidth * this.currentMove.hitboxAhead
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
      this.anims.stop()
      this.setTexture(texKey(this.charKey, 'attack2'))
      return
    }
    if (this.scene.time.now < this.hurtUntil) {
      this.anims.stop()
      this.setTexture(texKey(this.charKey, 'hurt'))
      return
    }
    if (!onGround) {
      this.anims.stop()
      this.setTexture(texKey(this.charKey, 'jump'))
      return
    }
    if (dir !== 0) {
      const key = walkAnimKey(this.charKey)
      if (this.anims.currentAnim?.key !== key || !this.anims.isPlaying) this.anims.play(key, true)
    } else {
      this.anims.stop()
      this.setTexture(texKey(this.charKey, 'idle'))
    }
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
    // 起跳挤压拉伸（果冻感）。以 base 缩放为基准，避免与出招 squash 叠加漂移。
    this.scene.tweens.add({ targets: this, scaleY: this.baseScaleY * 1.12, scaleX: this.baseScaleX * 0.9, duration: 90, yoyo: true })
  }

  /**
   * 触发一次普攻：三连招式（巴掌→踹→呸）逐步推进，停手 ~0.8s 归零。
   * 每招手感各异（动作时长/前冲方向与力度/挤压拉伸/命中区前探/出招音）。
   * 开启命中窗口（场景在 overlap 里判敌）。返回本次招式索引（0/1/2）；没挥出返回 -1。
   */
  startAttack(): number {
    if (this.attacking || this.scene.time.now < this.hurtUntil) return -1
    const now = this.scene.time.now
    // 停手太久 → 连招归零，从第一招重开。
    if (now - this.lastSwingAt > COMBO_RESET_MS) this.comboStep = 0
    const step = this.comboStep % COMBO_MOVES.length
    const move = COMBO_MOVES[step]
    this.currentMove = move
    this.lastSwingAt = now

    this.attacking = true
    this.hitThisSwing.clear()
    // 出招挤压：每招的 squash 不同 → 动作姿态肉眼可辨。
    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScaleX * move.squashX,
      scaleY: this.baseScaleY * move.squashY,
      duration: 90, yoyo: true,
    })
    // 命中窗口（蓄招延时 + 开窗时长随招式）。
    this.scene.time.delayedCall(move.hitWindowDelay, () => {
      if (!this.attacking) return
      this.swingActive = true
      this.hitbox.body.enable = true
    })
    this.scene.time.delayedCall(move.hitWindowDelay + move.hitWindowMs, () => {
      this.swingActive = false
      this.hitbox.body.enable = false
    })
    this.scene.time.delayedCall(move.attackMs, () => {
      this.attacking = false
    })
    // 前冲：巴掌/踹向前冲（踹更猛），呸是「定身嘴遁」几乎不前冲（手感差异）。
    ;(this.body as Phaser.Physics.Arcade.Body).setVelocityX(this.facing * RUN_SPEED * move.lungeMul)

    // 推进连招步（下一次取下一招）。
    this.comboStep = (step + 1) % COMBO_MOVES.length
    return step
  }

  isAttacking(): boolean {
    return this.attacking
  }

  /** 当前正在挥击的招式（场景按它做命中表演/击退）。 */
  get activeMove(): MoveSpec {
    return this.currentMove
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
