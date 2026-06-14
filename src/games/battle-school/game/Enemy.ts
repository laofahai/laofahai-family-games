// 敌人：同学小怪 + 老师 BOSS，都是 Arcade Physics 精灵，带真 AI。
//   · 小怪：朝主角走，贴近就发起攻击（lunge + 冷却 ~1s）主动揍主角；被主角命中区打到→击退+闪红+扣血，死则倒地淡出。
//   · BOSS：teacher 精灵更大 + 皇冠 + 护盾光环；对普通近战免疫（学霸护盾，命中只弹开冒「免疫」），
//     只能靠答题（知识）扣血。BOSS 也会主动逼近并周期性攻击主角。
//   · 所有敌人头顶有名字牌 + 血条（Nameplate）。
//   · lunge 命中区在身体/地面高度，跳跃可越过（命中判定见 lungeHitsAt）。
// 本类只管单体行为与表演；波次/数值/答题闸在 ArenaScene。
// 美术沿用 Kenney「Toon Characters 1」：精灵 key=kidA–D / teacher，攻击帧名 attack2。
// TODO 性别区分待女版 Kenney 素材：现在不按性别换精灵。

import Phaser from 'phaser'
import { texKey, walkAnimKey } from './assets'
import { Nameplate } from './Nameplate'

const MOB_DISPLAY_H = 128
const BOSS_DISPLAY_H = 188
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
  readonly charKey: string
  hp: number
  maxHp: number
  facing: 1 | -1 = -1
  dead = false
  plate: Nameplate
  private speed: number
  private nextAttackAt = 0
  private lungeUntil = 0 // lunge 攻击命中窗口结束
  private hurtUntil = 0
  /** 本次 lunge 是否已经打到过主角（避免一次扑击连扣）。 */
  lungeHitDone = false
  crown?: Phaser.GameObjects.Text
  shield?: Phaser.GameObjects.Arc // BOSS 护盾光环
  /** BOSS 学霸护盾是否在线（true=免疫近战；答对题 breakShield 后短暂落下）。 */
  isShielded = false
  /** 护盾被打掉、可挨揍的窗口结束时刻（ms，scene.time.now 域）。窗口内 meleeHit 造成真伤害。 */
  shieldDownUntil = 0

  constructor(scene: Phaser.Scene, x: number, y: number, opts: EnemyOpts) {
    super(scene, x, y, texKey(opts.charKey, 'idle'))
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.isBoss = opts.isBoss
    this.enemyName = opts.name
    this.charKey = opts.charKey
    this.hp = opts.hp
    this.maxHp = opts.hp
    this.speed = opts.speed ?? (opts.isBoss ? BOSS_SPEED : MOB_SPEED)

    const displayH = opts.isBoss ? BOSS_DISPLAY_H : MOB_DISPLAY_H
    // 按【该纹理真实高】缩放到目标显示高（Kenney 帧高一致，行为与常量相同，更稳妥）。
    const scale = displayH / this.height
    this.setScale(scale)
    this.setOrigin(0.5, 1)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setCollideWorldBounds(true)
    const bw = this.displayWidth * 0.40
    const bh = this.displayHeight * 0.84
    body.setSize(bw / scale, bh / scale)
    body.setOffset((this.width - bw / scale) / 2, this.height - bh / scale)
    this.setDepth(opts.isBoss ? 45 : 40)
    this.setData('ref', this) // 便于从 overlap 的 GameObject 反查实例

    // 名牌：小怪暖橙、Boss 红 + 更宽更大字。
    this.plate = opts.isBoss
      ? new Nameplate(scene, opts.name, 0xff6b6b, 110, 18)
      : new Nameplate(scene, opts.name, 0xffb347, 48, 13)

    if (opts.isBoss) {
      this.crown = scene.add.text(x, y, '👑', { fontSize: '34px' }).setOrigin(0.5, 1).setDepth(47)
      this.shield = scene.add.circle(x, y - displayH * 0.5, displayH * 0.62, 0x7cc0ff, 0.14).setDepth(44)
      this.shield.setStrokeStyle(3, 0x9fd0ff, 0.5)
      this.isShielded = true // BOSS 出场即带学霸护盾（免疫近战，答对题才破）
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
    // 名牌跟随头顶。
    this.plate.update(this.x, this.y - this.displayHeight, this.hp / this.maxHp)
  }

  private startLunge(now: number): void {
    this.lungeUntil = now + LUNGE_MS
    this.nextAttackAt = now + (this.isBoss ? BOSS_ATTACK_CD : MOB_ATTACK_CD)
    this.lungeHitDone = false
    // 攻击姿势 + 前探一下（手感）。
    this.setTexture(texKey(this.charKey, 'attack2'))
    this.scene.tweens.add({ targets: this, scaleY: this.scaleY * 0.92, scaleX: this.scaleX * 1.08, duration: 90, yoyo: true })
  }

  private updateAnim(now: number, body: Phaser.Physics.Arcade.Body, inLunge: boolean): void {
    if (now < this.hurtUntil) {
      this.anims.stop()
      this.setTexture(texKey(this.charKey, 'hurt'))
      return
    }
    if (inLunge) {
      this.anims.stop()
      this.setTexture(texKey(this.charKey, 'attack2'))
      return
    }
    if (Math.abs(body.velocity.x) > 5) {
      const key = walkAnimKey(this.charKey)
      if (this.anims.currentAnim?.key !== key || !this.anims.isPlaying) this.anims.play(key, true)
    } else {
      this.anims.stop()
      this.setTexture(texKey(this.charKey, 'idle'))
    }
  }

  /** 当前 lunge 是否处于命中窗口（场景据此判接触伤害）。 */
  isLunging(now: number): boolean {
    return now < this.lungeUntil && !this.lungeHitDone
  }

  /**
   * lunge 攻击是否能打到处于 heroFootY 高度的主角：
   * 攻击在身体/地面高度，主角脚底高于敌人攻击线（即跳起来了）就躲过。
   * @param heroFootY 主角脚底 y（origin 在脚）
   */
  lungeHitsAt(heroFootY: number): boolean {
    // 敌人攻击线大致在它身体下半段；主角脚底比这条线还高出一截 = 跳过去了。
    const attackLine = this.y - this.displayHeight * 0.35
    return heroFootY >= attackLine
  }

  private syncProps(): void {
    if (!this.isBoss) return
    const topY = this.y - this.displayHeight
    if (this.crown) this.crown.setPosition(this.x, topY + 14)
    if (this.shield) this.shield.setPosition(this.x, this.y - this.displayHeight * 0.5)
  }

  /**
   * 受近战命中：
   *   · 小怪：扣血+击退+闪红。
   *   · BOSS：护盾在线时免疫（返回 'immune'，护盾闪一下）；
   *     破盾窗口内（shieldDownUntil 之前）造成真伤害（'hurt'/'dead'）。
   * 返回结果给场景做表演。
   */
  meleeHit(dmg: number, fromX: number): 'hurt' | 'dead' | 'immune' {
    if (this.dead) return 'dead'
    if (this.isBoss) {
      const now = this.scene.time.now
      const vulnerable = !this.isShielded && now < this.shieldDownUntil
      if (!vulnerable) {
        // 学霸护盾在线：普通攻击无效，护盾闪一下。
        if (this.shield) {
          this.scene.tweens.add({ targets: this.shield, alpha: 0.5, scale: 1.12, duration: 120, yoyo: true })
        }
        return 'immune'
      }
      // 破盾窗口内：真伤害。
      return this.applyDamage(dmg, fromX)
    }
    return this.applyDamage(dmg, fromX)
  }

  /**
   * 答对 BOSS 知识闸 → 打掉护盾，开 ms 毫秒的「可揍」窗口：
   *   护盾真的落下（isShielded=false），窗口内 meleeHit 造成真伤害；窗口结束 regenShield 复原。
   * 纯视觉：碎盾 + 「可揍」金色脉冲（不弹卡片、不留常驻文字，由场景负责具体特效）。
   */
  breakShield(ms: number): void {
    if (!this.isBoss || this.dead) return
    this.isShielded = false
    this.shieldDownUntil = this.scene.time.now + ms
    // 护盾视觉落下：淡出 + 收缩。
    if (this.shield) {
      this.scene.tweens.killTweensOf(this.shield)
      this.scene.tweens.add({ targets: this.shield, alpha: 0, scale: 0.6, duration: 220, ease: 'Quad.easeOut' })
    }
    // 窗口结束自动复原（die 后不再复原由 regenShield 内判 dead 兜底）。
    this.scene.time.delayedCall(ms, () => this.regenShield())
  }

  /** 护盾再生：窗口结束（且未答对再次延长、且未死）→ 护盾回来，重新免疫。 */
  private regenShield(): void {
    if (!this.isBoss || this.dead) return
    if (this.scene.time.now < this.shieldDownUntil) return // 被新的一次 breakShield 续期了
    this.isShielded = true
    if (this.shield) {
      this.scene.tweens.killTweensOf(this.shield)
      this.shield.setScale(1)
      this.scene.tweens.add({ targets: this.shield, alpha: 0.14, duration: 260, ease: 'Quad.easeOut' })
      // 再生时护盾涨一下（提示「又硬了」）。
      this.scene.tweens.add({ targets: this.shield, scale: 1.18, duration: 160, yoyo: true })
    }
  }

  /** 护盾当前是否落下（破盾窗口内、可被近战）。供场景门控答题闸/表演。 */
  isShieldDown(now: number): boolean {
    return this.isBoss && !this.isShielded && now < this.shieldDownUntil
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
    this.setTexture(texKey(this.charKey, 'hurt'))
    this.plate.setVisible(false)
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
  }

  private cleanup(): void {
    this.destroy()
  }

  /** 销毁时连同名牌/皇冠/护盾一起清理（避免换关/清场时残留装饰）。 */
  destroy(fromScene?: boolean): void {
    this.crown?.destroy()
    this.shield?.destroy()
    this.plate?.destroy()
    super.destroy(fromScene)
  }
}
