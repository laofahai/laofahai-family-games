// 敌人：同学小怪 + 老师 BOSS，都是 Arcade Physics 精灵，带真 AI。
//   · 小怪：朝主角走，贴近就发起攻击（lunge + 冷却 ~1s）主动揍主角；被主角命中区打到→击退+闪红+扣血，死则倒地淡出。
//   · BOSS：teacher 精灵更大 + 教鞭/眼镜道具 + 皇冠；对普通近战免疫（学霸护盾，命中只弹开冒「免疫」），
//     只能靠答题（知识）扣血。BOSS 也会主动逼近并周期性攻击主角。
// 本类只管单体行为与表演；波次/数值/答题闸在 ArenaScene。

import Phaser from 'phaser'
import { texKey, walkAnimKey, SPRITE_SRC_H } from './assets'

const MOB_DISPLAY_H = 122
const BOSS_DISPLAY_H = 186
const MOB_SPEED = 90 // 小怪基础移动速度（每个体略随机）
const BOSS_SPEED = 70
const ATTACK_RANGE = 96 // 进入该距离就尝试攻击主角
const MOB_ATTACK_CD = 1300 // 小怪攻击冷却（ms，留出反击窗口）
const BOSS_ATTACK_CD = 2400
const LUNGE_MS = 360 // lunge 动作时长（前冲并造成接触伤害）

export interface EnemyOpts {
  charKey: string // 精灵款式 key（kidA… / teacher）
  name: string
  isBoss: boolean
  hp: number
  speed?: number
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly isBoss: boolean
  readonly enemyName: string
  hp: number
  maxHp: number
  facing: 1 | -1 = -1
  dead = false
  private speed: number
  private nextAttackAt = 0
  private lungeUntil = 0 // lunge 攻击命中窗口结束
  private hurtUntil = 0
  /** 本次 lunge 是否已经打到过主角（避免一次扑击连扣）。 */
  lungeHitDone = false
  /** BOSS 专属道具（眼镜+教鞭），跟随翻转/位置。 */
  prop?: Phaser.GameObjects.Graphics
  crown?: Phaser.GameObjects.Text
  shield?: Phaser.GameObjects.Arc // BOSS 护盾光环

  constructor(scene: Phaser.Scene, x: number, y: number, opts: EnemyOpts) {
    super(scene, x, y, texKey(opts.charKey, 'idle'))
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.isBoss = opts.isBoss
    this.enemyName = opts.name
    this.hp = opts.hp
    this.maxHp = opts.hp
    this.speed = opts.speed ?? (opts.isBoss ? BOSS_SPEED : MOB_SPEED)

    const displayH = opts.isBoss ? BOSS_DISPLAY_H : MOB_DISPLAY_H
    const scale = displayH / SPRITE_SRC_H
    this.setScale(scale)
    this.setOrigin(0.5, 1)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setCollideWorldBounds(true)
    const bw = this.displayWidth * 0.42
    const bh = this.displayHeight * 0.82
    body.setSize(bw / scale, bh / scale)
    body.setOffset((this.width - bw / scale) / 2, this.height - bh / scale)
    this.setDepth(opts.isBoss ? 45 : 40)
    this.setData('ref', this) // 便于从 overlap 的 GameObject 反查实例

    if (opts.isBoss) {
      this.prop = scene.add.graphics().setDepth(46)
      this.crown = scene.add.text(x, y, '👑', { fontSize: '34px' }).setOrigin(0.5, 1).setDepth(47)
      this.shield = scene.add.circle(x, y - displayH * 0.5, displayH * 0.62, 0x7cc0ff, 0.14).setDepth(44)
      this.shield.setStrokeStyle(3, 0x9fd0ff, 0.5)
    }
  }

  /**
   * 每帧 AI：朝主角走，贴近就发动攻击（lunge）。
   * @param mayAttack 本帧是否允许发起新 lunge（场景限制「同时围攻人数」，避免一拥而上秒杀）。
   * @param frozen 被全局冻结（hitstop/答题）时只停住。
   */
  think(heroX: number, now: number, frozen: boolean, mayAttack: boolean): void {
    if (this.dead) return
    const body = this.body as Phaser.Physics.Arcade.Body
    const dx = heroX - this.x
    const dist = Math.abs(dx)
    this.facing = dx >= 0 ? 1 : -1
    this.flipX = this.facing === 1 // 精灵默认朝右；面朝左侧主角时不翻

    const inLunge = now < this.lungeUntil
    if (frozen) {
      body.setVelocityX(0)
    } else if (inLunge) {
      // lunge：朝主角猛冲（接触伤害在场景 overlap 里结算）。
      body.setVelocityX(this.facing * this.speed * 3.2)
    } else if (dist > ATTACK_RANGE) {
      body.setVelocityX(this.facing * this.speed)
    } else if (now >= this.nextAttackAt && mayAttack) {
      // 到攻击距离、冷却好了、且本帧拿到「攻击名额」→ 发动一次 lunge。
      body.setVelocityX(0)
      this.startLunge(now)
    } else {
      // 在攻击距离内但还不能打：保持一点站位间距（围而不上），不贴脸堆叠。
      const standoff = ATTACK_RANGE * 0.78
      if (dist < standoff) body.setVelocityX(-this.facing * this.speed * 0.6)
      else body.setVelocityX(0)
    }

    this.updateAnim(now, body, inLunge)
    this.syncProps()
  }

  private startLunge(now: number): void {
    this.lungeUntil = now + LUNGE_MS
    this.nextAttackAt = now + (this.isBoss ? BOSS_ATTACK_CD : MOB_ATTACK_CD)
    this.lungeHitDone = false
    // 攻击姿势 + 前探一下（手感）。
    this.setTexture(texKey(this.texKeyBase(), 'attack2'))
    this.scene.tweens.add({ targets: this, scaleY: this.scaleY * 0.92, scaleX: this.scaleX * 1.08, duration: 90, yoyo: true })
  }

  private updateAnim(now: number, body: Phaser.Physics.Arcade.Body, inLunge: boolean): void {
    if (now < this.hurtUntil) {
      this.anims.stop()
      this.setTexture(texKey(this.texKeyBase(), 'hurt'))
      return
    }
    if (inLunge) {
      this.anims.stop()
      this.setTexture(texKey(this.texKeyBase(), 'attack2'))
      return
    }
    if (Math.abs(body.velocity.x) > 5) {
      const key = walkAnimKey(this.texKeyBase())
      if (this.anims.currentAnim?.key !== key || !this.anims.isPlaying) this.anims.play(key, true)
    } else {
      this.anims.stop()
      this.setTexture(texKey(this.texKeyBase(), 'idle'))
    }
  }

  /** 当前 lunge 是否处于命中窗口（场景据此判接触伤害）。 */
  isLunging(now: number): boolean {
    return now < this.lungeUntil && !this.lungeHitDone
  }

  /** 从纹理 key 还原角色款式前缀（hero_idle → hero）。 */
  private texKeyBase(): string {
    // 构造时 setTexture 用的是 `${charKey}_idle`，这里反推 charKey。
    const k = this.texture.key
    const us = k.lastIndexOf('_')
    return us > 0 ? k.slice(0, us) : k
  }

  private syncProps(): void {
    if (!this.isBoss) return
    const topY = this.y - this.displayHeight
    if (this.crown) this.crown.setPosition(this.x, topY + 14)
    if (this.shield) this.shield.setPosition(this.x, this.y - this.displayHeight * 0.5)
    if (this.prop) {
      // 重画教鞭+眼镜，跟随朝向。
      const g = this.prop
      g.clear()
      const cx = this.x
      const eyeY = this.y - this.displayHeight * 0.72
      const dir = this.facing
      // 眼镜
      g.lineStyle(3, 0x222222, 1)
      g.strokeCircle(cx - 11 * dir, eyeY, 9)
      g.strokeCircle(cx + 11 * dir, eyeY, 9)
      g.lineBetween(cx - 2 * dir, eyeY, cx + 2 * dir, eyeY)
      // 教鞭（手里斜指）
      const handX = cx + dir * this.displayWidth * 0.28
      const handY = this.y - this.displayHeight * 0.42
      g.lineStyle(5, 0x8a5a2b, 1)
      g.lineBetween(handX, handY, handX + dir * 56, handY - 40)
      g.fillStyle(0xffe08a, 1)
      g.fillCircle(handX + dir * 56, handY - 40, 5)
    }
  }

  /** 受近战命中：小怪扣血+击退+闪红；BOSS 免疫（返回 'immune'）。返回结果给场景做表演。 */
  meleeHit(dmg: number, fromX: number): 'hurt' | 'dead' | 'immune' {
    if (this.dead) return 'dead'
    if (this.isBoss) {
      // 学霸护盾：普通攻击无效，护盾闪一下。
      if (this.shield) {
        this.scene.tweens.add({ targets: this.shield, alpha: 0.5, scale: 1.12, duration: 120, yoyo: true })
      }
      return 'immune'
    }
    return this.applyDamage(dmg, fromX)
  }

  /** 知识伤害（答题打 BOSS / AoE 打小怪）：无视护盾。 */
  knowledgeHit(dmg: number, fromX: number): 'hurt' | 'dead' {
    return this.applyDamage(dmg, fromX)
  }

  private applyDamage(dmg: number, fromX: number): 'hurt' | 'dead' {
    this.hp = Math.max(0, this.hp - dmg)
    const now = this.scene.time.now
    this.hurtUntil = now + 240
    this.lungeUntil = 0 // 打断它的攻击
    this.setTint(0xff5a5a)
    this.scene.time.delayedCall(220, () => { if (!this.dead) this.clearTint() })
    // 击退（BOSS 较沉）。
    const dir = this.x < fromX ? -1 : 1
    const kb = this.isBoss ? 120 : 320
    ;(this.body as Phaser.Physics.Arcade.Body).setVelocity(dir * kb, -180)
    if (this.hp <= 0) {
      this.die()
      return 'dead'
    }
    return 'hurt'
  }

  /** 倒地：旋转+淡出，随后销毁（连同道具）。 */
  die(): void {
    if (this.dead) return
    this.dead = true
    const body = this.body as Phaser.Physics.Arcade.Body
    body.enable = false
    this.setTexture(texKey(this.texKeyBase(), 'hurt'))
    this.scene.tweens.add({
      targets: this,
      angle: this.facing === 1 ? -90 : 90,
      alpha: 0,
      y: this.y + 6,
      duration: 460,
      ease: 'Quad.easeIn',
      onComplete: () => this.cleanup(),
    })
    if (this.crown) this.scene.tweens.add({ targets: this.crown, alpha: 0, y: this.crown.y - 30, duration: 460 })
    if (this.shield) this.scene.tweens.add({ targets: this.shield, alpha: 0, duration: 300 })
    if (this.prop) this.scene.tweens.add({ targets: this.prop, alpha: 0, duration: 300 })
  }

  private cleanup(): void {
    this.crown?.destroy()
    this.shield?.destroy()
    this.prop?.destroy()
    this.destroy()
  }
}
