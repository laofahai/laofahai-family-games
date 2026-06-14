// Mario 元素的 Arcade 物理实体工厂/类：?-砖、水管、坑触发区、伪装陷阱，外加「踩头判定」纯函数。
// 风格对齐 Enemy/Hero：每个实体 (scene, ...pos) 自给自足，自己建图形 + 物理体、暴露碰撞目标
// 与效果回调，绝不反向去碰 ArenaScene 内部（伤害/重生/数值都通过回调交还场景）。
//
// ── 集成接口（ArenaScene 拿这些怎么连）─────────────────────────────────────
// 约定：worldY = groundY - heightAboveGround（schema 里的 y/h 都是「距地面线高度」，见 StageDef）。
//
//  · QBlock(scene, x, worldY, content, onPop?)
//      .body 是 STATIC 实体——既当「头顶可顶」的砖，也是可站立的实心块。
//      碰撞：scene.physics.add.collider(hero, qblock)（与平台同组即可一起 collider）。
//      顶出：主角从下方顶到砖 → 调 qblock.tryPop()（场景在 collide 回调里、或自己判 hero 在砖正下方且向上）
//            → 触发一次 onPop(content)，场景据 content 发 coin/energy/buff（加金币/涨能量/给 buff）。
//      也可把所有静态实体（platforms/pipes/qblocks）加进一个 StaticGroup 统一 collider。
//
//  · Pipe(scene, x, groundY, h, w, teleportTo?)
//      .body STATIC 实心障碍（站立面在管口）。碰撞同上。teleportTo 暂为桩，场景可读取后自行处理。
//
//  · Pit(scene, x, groundY, w, onFall)
//      .zone 是一个「落坑触发区」(Arcade Zone, 无重力)。
//      碰撞：scene.physics.add.overlap(hero, pit.zone, () => pit.checkFall(hero))，
//            或场景每帧调 pit.checkFall(hero)。主角脚底掉到地面线以下且在坑范围内 → 调一次 onFall()
//            （场景据此扣血 + 把主角重生到坑前安全点；不是秒死）。pit.reset() 在重生后清防抖。
//      注意：真坑处场景应「不铺地面碰撞体」，让主角能掉下去。
//
//  · DisguisedTrap(scene, x, groundY, w, kind, armed, triggerX, onTrigger)
//      看着是普通地面的一段。主角踩到 triggerX 附近且 armed=true → 调一次 onTrigger(kind)
//      （collapse=塌陷掉落，建议场景按「掉坑」处理；spike=扎伤，按受击处理）。armed=false 则永不触发。
//      .zone 暴露给 overlap，或场景每帧 trap.checkTrigger(hero)。
//
//  · stompResult(hero.body, enemy.body) → 'stomp' | 'none'
//      纯函数：判断主角是否「从上方踩到」敌人头顶（Mario 踩怪）。'stomp'=踩中（场景做击杀+弹起），
//      'none'=不算踩（侧面/下方接触，按普通接触伤害走）。

import Phaser from 'phaser'

// ── 配色（程序化绘制，无专用美术素材）──────────────────────────────────────
const COLOR_QBLOCK = 0xf2b134
const COLOR_QBLOCK_SPENT = 0x9a8252
const COLOR_QBLOCK_EDGE = 0x8a5a12
const COLOR_PIPE = 0x3fae5a
const COLOR_PIPE_DARK = 0x2c7d40
const COLOR_SPIKE = 0xcfd6df
const COLOR_TRAP_HINT = 0x000000 // 伪装陷阱平时与地面同色（不画），armed 触发才显形

const QBLOCK_SIZE = 56 // ?-砖边长（px）
const DEPTH_BLOCK = 30 // 在背景(3)之上、角色(40+)之下

/** ?-砖弹出的内容（与 StageDef.QBlockContent 同义；此处独立声明避免跨目录耦合）。 */
export type QBlockContent = 'coin' | 'energy' | 'buff'
export type TrapKind = 'collapse' | 'spike'

/** 一个带静态 Arcade body 的图形容器基类工具：把容器塞进物理世界并设为静态。 */
function makeStaticBody(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.GameObject & { x: number; y: number },
  w: number,
  h: number,
): Phaser.Physics.Arcade.StaticBody {
  scene.physics.add.existing(obj, true) // true = static
  const body = obj.body as Phaser.Physics.Arcade.StaticBody
  body.setSize(w, h)
  body.updateFromGameObject()
  return body
}

// ── ?-砖 ────────────────────────────────────────────────────────────────────
/**
 * ?-砖：从下方顶 → 弹出一次内容（onPop），之后变「已用」灰块（仍是实心可站）。
 * 锚点：传入的 (x, worldY) 是砖的【中心】。
 */
export class QBlock extends Phaser.GameObjects.Container {
  readonly content: QBlockContent
  private spent = false
  private readonly onPop?: (content: QBlockContent) => void
  private face!: Phaser.GameObjects.Rectangle
  private mark!: Phaser.GameObjects.Text
  declare body: Phaser.Physics.Arcade.StaticBody

  constructor(
    scene: Phaser.Scene,
    x: number,
    worldY: number,
    content: QBlockContent,
    onPop?: (content: QBlockContent) => void,
  ) {
    super(scene, x, worldY)
    this.content = content
    this.onPop = onPop
    scene.add.existing(this)
    this.setDepth(DEPTH_BLOCK)

    this.face = scene.add.rectangle(0, 0, QBLOCK_SIZE, QBLOCK_SIZE, COLOR_QBLOCK)
    this.face.setStrokeStyle(3, COLOR_QBLOCK_EDGE)
    this.mark = scene.add
      .text(0, 0, '?', { fontSize: '34px', color: '#5a3a06', fontStyle: 'bold' })
      .setOrigin(0.5)
    this.add([this.face, this.mark])

    makeStaticBody(scene, this, QBLOCK_SIZE, QBLOCK_SIZE)
    this.setData('ref', this)
  }

  /** 是否还能顶出内容。 */
  get canPop(): boolean {
    return !this.spent
  }

  /**
   * 尝试顶砖：未用过则弹一次内容（触发 onPop）并变灰，返回 true；已用过返回 false。
   * 场景在「主角从下方顶到砖」时调用（如 collide 回调里判 hero 在砖正下方且 body.velocity.y<0）。
   */
  tryPop(): boolean {
    if (this.spent) return false
    this.spent = true
    this.face.setFillStyle(COLOR_QBLOCK_SPENT)
    this.mark.setText('')
    // 顶起回弹的小动效（手感）。
    this.scene.tweens.add({ targets: this, y: this.y - 8, duration: 80, yoyo: true })
    this.onPop?.(this.content)
    return true
  }
}

// ── 水管 ────────────────────────────────────────────────────────────────────
/**
 * 水管：实心障碍（站立面在管口）。锚点：(x, groundY) 是管子【底部中心】，向上长 h。
 * teleportTo 为可选传送目标世界 x（先留桩，场景读取后自行实现传送）。
 */
export class Pipe extends Phaser.GameObjects.Container {
  readonly teleportTo?: number
  /** 管宽（px）。容器自带 width/height 语义保持一致，这里另存一份方便读。 */
  readonly pipeWidth: number
  /** 管高（px）。 */
  readonly pipeHeight: number
  declare body: Phaser.Physics.Arcade.StaticBody

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    h: number,
    w = 64,
    teleportTo?: number,
  ) {
    // 容器锚在管子几何中心，便于物理体对齐。
    super(scene, x, groundY - h / 2)
    this.teleportTo = teleportTo
    this.pipeWidth = w
    this.pipeHeight = h
    scene.add.existing(this)
    this.setSize(w, h) // 让容器自带的 width/height 也反映真实尺寸
    this.setDepth(DEPTH_BLOCK)

    const g = scene.add.graphics()
    // 管身。
    g.fillStyle(COLOR_PIPE, 1)
    g.fillRect(-w / 2, -h / 2, w, h)
    // 管口（更宽一圈，深色描边）。
    const lipW = w + 16
    const lipH = 22
    g.fillStyle(COLOR_PIPE, 1)
    g.fillRect(-lipW / 2, -h / 2, lipW, lipH)
    g.lineStyle(3, COLOR_PIPE_DARK, 1)
    g.strokeRect(-lipW / 2, -h / 2, lipW, lipH)
    g.strokeRect(-w / 2, -h / 2 + lipH, w, h - lipH)
    this.add(g)

    makeStaticBody(scene, this, this.pipeWidth, this.pipeHeight)
    this.setData('ref', this)
  }
}

// ── 坑（落坑触发区）──────────────────────────────────────────────────────────
/**
 * 坑：一个落坑触发区（不可见 Zone，无重力）。主角脚底掉到地面线以下且在坑横向范围内 → onFall() 一次。
 * 不做秒死：场景在 onFall 里扣血 + 重生主角，然后调 pit.reset() 解除防抖。
 * 锚点：(x, groundY) 是坑【左边缘 + 地面线】；坑向右宽 w、向下延伸到检测区。
 */
export class Pit {
  readonly x: number
  readonly w: number
  readonly groundY: number
  readonly zone: Phaser.GameObjects.Zone & { body: Phaser.Physics.Arcade.Body }
  private fired = false
  private readonly onFall: () => void
  /** 触发深度：脚底超过地面线这么多 px 即判定落坑。 */
  private static readonly FALL_DEPTH = 24
  /** 检测区高度（从地面线往下铺一段，覆盖下落轨迹）。 */
  private static readonly ZONE_H = 600

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    w: number,
    onFall: () => void,
  ) {
    this.x = x
    this.w = w
    this.groundY = groundY
    this.onFall = onFall
    const zone = scene.add.zone(x + w / 2, groundY + Pit.ZONE_H / 2, w, Pit.ZONE_H)
    scene.physics.add.existing(zone)
    const zb = zone.body as Phaser.Physics.Arcade.Body
    zb.setAllowGravity(false)
    zb.moves = false
    this.zone = zone as Pit['zone']
    this.zone.setData('ref', this)
  }

  /**
   * 判定主角是否落坑：脚底（heroBody.bottom）越过地面线一定深度且横向在坑内 → 触发一次 onFall。
   * 可在 overlap(hero, pit.zone) 回调里调，或每帧主动调。返回是否本次触发。
   */
  checkFall(hero: Phaser.GameObjects.GameObject & { body: Phaser.Physics.Arcade.Body | null }): boolean {
    if (this.fired) return false
    const body = hero.body as Phaser.Physics.Arcade.Body | null
    if (!body) return false
    const footY = body.bottom
    const cx = body.center.x
    const inX = cx >= this.x && cx <= this.x + this.w
    if (inX && footY >= this.groundY + Pit.FALL_DEPTH) {
      this.fired = true
      this.onFall()
      return true
    }
    return false
  }

  /** 重生后调用，解除防抖以便下次还能触发。 */
  reset(): void {
    this.fired = false
  }

  destroy(): void {
    this.zone.destroy()
  }
}

// ── 伪装陷阱 ──────────────────────────────────────────────────────────────────
/**
 * 伪装陷阱：看着是普通地面的一段，踩到 triggerX 附近且 armed → onTrigger(kind) 一次后显形。
 *   · collapse：建议场景按「掉坑」处理（塌陷下落）。
 *   · spike：建议场景按「受击」处理（扎伤）。
 * armed=false：永不触发（这一局是哑的）。锚点：(x, groundY) = 区段左边缘 + 地面线。
 */
export class DisguisedTrap {
  readonly x: number
  readonly w: number
  readonly kind: TrapKind
  readonly armed: boolean
  readonly triggerX: number
  readonly zone: Phaser.GameObjects.Zone & { body: Phaser.Physics.Arcade.Body }
  private fired = false
  private readonly onTrigger: (kind: TrapKind) => void
  private readonly scene: Phaser.Scene
  private readonly groundY: number
  /** 触发横向容差（主角中心进入 triggerX ± 这个值即触发）。 */
  private static readonly TRIGGER_PAD = 28

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    w: number,
    kind: TrapKind,
    armed: boolean,
    triggerX: number,
    onTrigger: (kind: TrapKind) => void,
  ) {
    this.scene = scene
    this.x = x
    this.w = w
    this.kind = kind
    this.armed = armed
    this.triggerX = triggerX
    this.onTrigger = onTrigger
    this.groundY = groundY
    // 触发区贴着地面上方一薄层（脚底高度），覆盖整段宽。
    const zone = scene.add.zone(x + w / 2, groundY - 8, w, 32)
    scene.physics.add.existing(zone)
    const zb = zone.body as Phaser.Physics.Arcade.Body
    zb.setAllowGravity(false)
    zb.moves = false
    this.zone = zone as DisguisedTrap['zone']
    this.zone.setData('ref', this)
  }

  /**
   * 判定是否踩中陷阱：主角中心进入 triggerX 容差内且脚底贴地 → 触发一次 onTrigger。
   * 在 overlap(hero, trap.zone) 回调里调，或每帧主动调。返回是否本次触发。
   */
  checkTrigger(hero: Phaser.GameObjects.GameObject & { body: Phaser.Physics.Arcade.Body | null }): boolean {
    if (this.fired || !this.armed) return false
    const body = hero.body as Phaser.Physics.Arcade.Body | null
    if (!body) return false
    const cx = body.center.x
    const onGround = body.blocked.down || body.touching.down
    if (onGround && Math.abs(cx - this.triggerX) <= DisguisedTrap.TRIGGER_PAD) {
      this.fired = true
      this.reveal()
      this.onTrigger(this.kind)
      return true
    }
    return false
  }

  /** 触发时显形：collapse 地面下陷一块，spike 冒出尖刺（轻量表演，纯图形）。 */
  private reveal(): void {
    if (this.kind === 'spike') {
      const g = this.scene.add.graphics().setDepth(DEPTH_BLOCK)
      g.fillStyle(COLOR_SPIKE, 1)
      const n = Math.max(2, Math.floor(this.w / 24))
      const step = this.w / n
      for (let i = 0; i < n; i++) {
        const sx = this.x + i * step
        g.fillTriangle(sx, this.groundY, sx + step, this.groundY, sx + step / 2, this.groundY - 26)
      }
    } else {
      // collapse：画一块下陷的暗坑提示（实际掉落逻辑由场景在 onTrigger 里按「掉坑」处理）。
      const r = this.scene.add
        .rectangle(this.x + this.w / 2, this.groundY + 30, this.w, 60, COLOR_TRAP_HINT, 0.35)
        .setDepth(DEPTH_BLOCK)
      this.scene.tweens.add({ targets: r, alpha: 0.55, y: r.y + 12, duration: 180 })
    }
  }

  destroy(): void {
    this.zone.destroy()
  }
}

// ── 踩头判定（纯函数）────────────────────────────────────────────────────────
/** 一个最小的「物理体」形状约定，方便对接 Phaser Arcade Body 也方便单测。 */
export interface BodyLike {
  bottom: number
  top: number
  center: { x: number; y: number }
  velocity: { x: number; y: number }
}

/** 横向重叠占任一较窄体的比例阈值（低于此算「擦边」不计踩）。 */
const STOMP_X_OVERLAP_RATIO = 0.35

/**
 * 判断主角是否「从上方踩到」敌人头顶（Mario 踩怪）。纯函数、无 Phaser 依赖。
 * 规则：
 *   1. 主角正在下落（velocity.y > 0）；
 *   2. 主角脚底（bottom）落在敌人头部区间内（敌人 top 上方一点 ~ 敌人体中线之间）；
 *   3. 两者横向有足够重叠（避免侧面擦碰被误判成踩）。
 * @returns 'stomp'=踩中（场景做击杀 + 主角弹起）；'none'=非踩（侧面/底部，走普通接触伤害）。
 */
export function stompResult(heroBody: BodyLike, enemyBody: BodyLike): 'stomp' | 'none' {
  if (heroBody.velocity.y <= 0) return 'none' // 没在下落
  const enemyMidY = (enemyBody.top + enemyBody.bottom) / 2
  const footY = heroBody.bottom
  // 脚底要落在敌人头顶上半段（top 上方一点点宽容 ~ 体中线）。
  if (footY < enemyBody.top - 12 || footY > enemyMidY) return 'none'
  return horizontalOverlapEnough(heroBody, enemyBody) ? 'stomp' : 'none'
}

/**
 * 横向是否「对得够准」可算踩头。
 * BodyLike 不带宽度（保持纯/可单测），故用两体中心 x 的距离近似：
 * 阈值以一个角色半宽量级为参考，乘 (1 + 容差比例) 放宽一点。
 * 调用处若有真实 body.width，可在外面用更精确的 AABB 重叠替代。
 */
function horizontalOverlapEnough(a: BodyLike, b: BodyLike): boolean {
  const dx = Math.abs(a.center.x - b.center.x)
  const REF_HALF = 56 // 角色半宽量级（px）
  return dx <= REF_HALF * (1 + STOMP_X_OVERLAP_RATIO)
}
