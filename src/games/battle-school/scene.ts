// Phaser 可视化舞台（横版·会动）：世界比屏幕宽、相机跟随主角；主角可前后左右走 + 跳。
// 不含任何游戏逻辑、不读题库；由 React 通过 sceneRef 调方法 / 设移动意图驱动。
// 全部用 Graphics 画 + emoji 文本，不加载外部图片/精灵图。
//
// 关键交互：
//  · setMove({dir, jump})：React 把「移动意图」喂进来（键盘/触屏），scene 在 update() 里逐帧消费。
//  · 敌人站在主角前方的路上；主角走近到 REACH 距离 → 触发 onReachEnemy（React 据此弹挑战面板）。
//  · spawnEnemy 把新敌人放到主角【前方】，重置「已到达」标记；走过去才弹面板（reach gating）。
//  · 战斗动画（playHit/playDiss/playPeerHit/playDown）期间锁住移动，避免错位。

import Phaser from 'phaser'
import type { AttackKind } from './types'
import { ATTACK_META } from './types'

export type Side = 'hero' | 'enemy'

/** React 喂进来的移动意图：dir=-1 左 / 0 停 / 1 右；jump=本帧是否起跳。 */
export interface MoveIntent {
  dir: -1 | 0 | 1
  jump: boolean
}

/** 一个敌人单位（单怪/Boss/近战群里的一个）。front=units[0]，离主角最近，是 reach/skip/攻击目标。 */
interface EnemyUnit {
  container: Phaser.GameObjects.Container
  shadow: Phaser.GameObjects.Ellipse
  emojiText: Phaser.GameObjects.Text
  crown: Phaser.GameObjects.Text
  nameplate: Phaser.GameObjects.Container
  nameText: Phaser.GameObjects.Text
  isBoss: boolean
}

// 近战群里，相邻两个小怪之间的横向间距（front 最近，其余朝右错开站位）。
const WAVE_GAP = 135

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

// 世界比屏宽：相机跟随主角横向滚动。
const WORLD_W = 3200
const GROUND_RATIO = 0.56 // 地面在视口高度的占比（抬高些，让角色站在上方，底部留给题卡不挡人）
const REACH_DIST = 150 // 主角离敌人多近算「走到了」
const WALK_SPEED = 280 // px/秒
const GRAVITY = 1800 // px/秒^2
const JUMP_V = 760 // 起跳初速度

// 主角配色（一只友好的休闲游戏吉祥物）
const HERO_BODY = 0x4f8cff // 身体主色（明快的蓝）
const HERO_BODY_DARK = 0x2f6bd6 // 身体描边/暗部
const HERO_LIMB = 0x3a73e6 // 手臂/腿
const HERO_FOOT = 0xffce54 // 鞋（暖黄，画龙点睛）
const NAMEPLATE_BG = 0x1f2433 // 名牌底色（深色半透明）

export class BattleScene extends Phaser.Scene {
  private W = 800
  private H = 450
  private groundY = 360

  // 主角：容器(hero) 里有 影子 + 身体组(bodyGroup：身体/四肢一起翻转+挤压) + 头脸 + 名牌。
  private hero!: Phaser.GameObjects.Container
  private heroShadow!: Phaser.GameObjects.Ellipse
  private heroBodyGroup!: Phaser.GameObjects.Container // 装身体/手臂/腿，统一翻转朝向与挤压拉伸
  private heroBodyGfx!: Phaser.GameObjects.Graphics // 身体+四肢的形状（受击时闪它）
  private heroFace!: Phaser.GameObjects.Text // 头/脸 emoji（受击时也闪它）
  private heroName!: Phaser.GameObjects.Container // 头顶名牌（pill）。bg/label 存在容器 data 里，按需取。
  private heroNameValue = '🧒' // 当前显示的玩家名（空则回退到默认）

  // 敌人单位数组：front=units[0]（离主角最近，reach/skip/攻击目标）；近战群里其余排在它右后方。
  // 单怪/Boss/共斗时长度恒为 1，行为与改造前完全一致。
  private units: EnemyUnit[] = []
  private hint!: Phaser.GameObjects.Text
  private bg!: Phaser.GameObjects.Graphics
  private far!: Phaser.GameObjects.Graphics // 远景视差层
  private decos: Phaser.GameObjects.GameObject[] = []

  private theme: SceneTheme = THEMES[0]

  // 移动状态
  private move: MoveIntent = { dir: 0, jump: false }
  private heroVY = 0 // 竖直速度（跳跃/重力）
  private heroY = 0 // 主角「物理」基准 y（地面/跳跃），与走路上下颠的渲染偏移分离
  private heroFacing = 1 // 1 右 / -1 左
  private walkPhase = 0 // 走路摆动相位
  private onGround = true
  private breathPhase = 0 // 待机呼吸相位
  // 跳跃挤压/拉伸：jumpSquash 是当前对 bodyGroup 施加的额外缩放偏移（由 tween 驱动）。
  private jumpSquashX = 1
  private jumpSquashY = 1
  private wasOnGround = true // 上一帧是否在地面（用于检测「落地」播放挤压）

  // 战斗动画进行中：锁住移动 + 暂停跟随，避免攻击位移与走动打架
  private busy = false
  // reach gating：enemyReached 是真值；lastReportedReach 是上次告知 React 的值。
  // 两条边（到达 / 新敌人重置）都从 update() 循环上报（事件，非 React effect 体内），ESLint 合规。
  private enemyReached = false
  private lastReportedReach = false
  private onReach: (() => void) | null = null
  private onUnreach: (() => void) | null = null
  // 跳过：当前敌人是否可被「跳过去」越过（普通近战小怪可，Boss/特殊不可）。
  private enemySkippable = false
  private skipped = false // 本敌人已被跳过（一次性，避免重复上报）
  private onSkip: (() => void) | null = null

  constructor() {
    super('battle')
  }

  create() {
    this.recomputeLayout()

    this.theme = THEMES[Math.floor(Math.random() * THEMES.length)]
    this.far = this.add.graphics()
    this.bg = this.add.graphics()
    this.drawBackground(this.theme)

    // ── 主角：一只友好的休闲游戏吉祥物（影子 + 圆润身体/四肢 + 头脸 emoji + 头顶名牌）──
    // 容器自身的 (x,y) 是「脚下中心」(贴地点)。所有内容用脚为原点向上画。
    this.heroShadow = this.add.ellipse(0, 6, 80, 22, 0x000000, 0.18).setOrigin(0.5)
    this.heroBodyGfx = this.add.graphics()
    this.drawHeroBody(this.heroBodyGfx)
    // bodyGroup 单独成容器：朝向翻转(scaleX)与跳跃挤压(scaleY)都作用在它上，名牌/影子不受影响。
    this.heroBodyGroup = this.add.container(0, 0, [this.heroBodyGfx])
    // 头/脸：稳稳坐在身体顶端（身体顶约 -94，头中心放 -104），不再飘在左上。
    this.heroFace = this.add.text(0, -104, '🧒', { fontSize: '40px' }).setOrigin(0.5)
    this.heroBodyGroup.add(this.heroFace)
    this.heroName = this.makeNameplate('', false)
    this.heroName.setPosition(0, -150)
    this.hero = this.add.container(this.heroStartX(), this.groundY, [this.heroShadow, this.heroBodyGroup, this.heroName])
    this.hero.setDepth(10)
    this.heroY = this.groundY
    this.setHeroName(this.heroNameValue)

    // ── 敌人：同款风格（影子 + 表情 + 可选皇冠 + 头顶名牌 pill）。
    // 起始建一个单位（front），后续 spawnEnemy/spawnWave 复用/补建。──
    this.units = [this.createUnit(this.heroStartX() + 520)]

    // 「往右走 →」引导提示（走到敌人前消失）
    this.hint = this.add
      .text(0, 0, '← → 移动 · ↑ 跳 · 撞上对手开打', {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#00000066',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(60)

    // 相机：世界边界 + 跟随主角（横向滚动）。本场景用手动积分，不开物理引擎。
    this.cameras.main.setBounds(0, 0, WORLD_W, this.H)
    this.cameras.main.startFollow(this.hero, true, 0.12, 0.12, 0, this.H * 0.12)

    this.scale.on('resize', this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this)
    })
  }

  /** 前排敌人（离主角最近，reach/skip/攻击目标）。单怪/Boss/共斗时即唯一那个。 */
  private front(): EnemyUnit {
    return this.units[0]
  }

  /** 建一个敌人单位（影子 + 表情 + 可选皇冠 + 头顶名牌 pill），放在指定 x、地面 y。 */
  private createUnit(x: number): EnemyUnit {
    const shadow = this.add.ellipse(0, 6, 84, 22, 0x000000, 0.18).setOrigin(0.5)
    const emojiText = this.add.text(0, -58, '🙂', { fontSize: '54px' }).setOrigin(0.5)
    const crown = this.add.text(0, -104, '👑', { fontSize: '30px' }).setOrigin(0.5).setVisible(false)
    const nameplate = this.makeNameplate('', false)
    nameplate.setPosition(0, -132)
    const nameText = nameplate.getData('label') as Phaser.GameObjects.Text
    const container = this.add.container(x, this.groundY, [shadow, emojiText, crown, nameplate])
    container.setDepth(9)
    return { container, shadow, emojiText, crown, nameplate, nameText, isBoss: false }
  }

  /** 给一个单位套上「形象/名牌/皇冠/影子」样式（boss 更大 + 皇冠 + 暖红名牌；普通小怪常规）。 */
  private styleUnit(u: EnemyUnit, emoji: string, name: string, isBoss: boolean) {
    u.isBoss = isBoss
    u.emojiText.setText(emoji)
    u.emojiText.setFontSize(isBoss ? 84 : 54) // boss 明显更大
    u.emojiText.setY(isBoss ? -70 : -58)
    u.emojiText.setAngle(0)
    u.emojiText.clearTint()
    u.crown.setVisible(isBoss)
    u.crown.setY(isBoss ? -122 : -104)
    u.shadow.setSize(isBoss ? 110 : 84, isBoss ? 26 : 22)
    u.nameText.setText(name)
    this.redrawNameplate(u.nameplate, isBoss)
    u.nameplate.setY(isBoss ? -150 : -126)
  }

  private recomputeLayout() {
    this.W = this.scale.width
    this.H = this.scale.height
    this.groundY = Math.round(this.H * GROUND_RATIO)
  }

  private heroStartX() {
    return 220
  }

  private handleResize() {
    if (!this.bg) return
    this.recomputeLayout()
    this.cameras.main.setBounds(0, 0, WORLD_W, this.H)
    this.cameras.main.setFollowOffset(0, this.H * 0.12)
    // 重排贴地物体的 y（更新物理基准；在地面则贴新地面）
    this.heroY = Math.min(this.heroY, this.groundY)
    if (this.onGround) this.heroY = this.groundY
    this.hero.y = this.heroY
    for (const u of this.units) u.container.y = this.groundY
    this.drawBackground(this.theme)
    this.repositionHint()
  }

  private repositionHint() {
    this.hint.setPosition(this.W / 2, this.H * 0.16)
  }

  // ── 每帧：消费移动意图 + 重力 + 走路摆动 + reach 判定 ───────────────────
  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000 // 秒（夹住，切后台回来不暴冲）

    if (!this.busy) {
      // 横向移动
      const walking = this.move.dir !== 0
      if (walking) {
        this.heroFacing = this.move.dir
        this.hero.x = Phaser.Math.Clamp(this.hero.x + this.move.dir * WALK_SPEED * dt, 40, WORLD_W - 40)
        this.walkPhase += dt * 12
      } else {
        this.walkPhase = 0
      }

      // 跳跃（起跳瞬间：纵向拉伸的弹射感）
      if (this.move.jump && this.onGround) {
        this.heroVY = -JUMP_V
        this.onGround = false
        this.playJumpSquash()
      }
      this.move.jump = false // 起跳是「一次性」意图，消费掉

      // 重力积分（作用在物理基准 heroY 上，与渲染颠簸分离，避免颠簸被重力吃掉）
      this.heroVY += GRAVITY * dt
      this.heroY += this.heroVY * dt
      if (this.heroY >= this.groundY) {
        this.heroY = this.groundY
        this.heroVY = 0
        this.onGround = true
      }
      // 落地瞬间：横向铺开的「砸地」挤压
      if (this.onGround && !this.wasOnGround) this.playLandSquash()
      this.wasOnGround = this.onGround

      // 走路上下小颠（仅在地面且在走时）：纯渲染偏移，不反馈进物理
      const bob = this.onGround && walking ? Math.abs(Math.sin(this.walkPhase)) * -6 : 0
      this.hero.y = this.heroY + bob

      // 待机呼吸（仅地面静止时）：身体极轻微起伏，让角色「活着」。
      this.breathPhase += dt * 2.4
      const breath = this.onGround && !walking ? Math.sin(this.breathPhase) * 0.02 : 0

      // 在空中时纵向拉长一点（下落/上升的飘逸），落地后回到 1。
      const airStretch = this.onGround ? 0 : 0.08

      this.applyHeroTransform(walking, breath, airStretch)

      // 全部判定都对 front（最近的那个敌人）。near=front 容器。
      const frontX = this.front().container.x

      // 跳过判定：可跳过的普通近战小怪——在空中且越过敌人 x → 直接掠过（不弹面板、不开打）。
      if (this.enemySkippable && !this.skipped && !this.enemyReached && !this.onGround) {
        // 主角从敌人左侧跳到了敌人右侧（越过），算成功跳过
        if (this.hero.x > frontX + 24) {
          this.skipped = true
          this.hint.setVisible(false)
          this.onSkip?.()
        }
      }

      // reach 判定：走近敌人 → 置 enemyReached（上报在下方统一做）。已跳过的不再触发。
      // 可跳过的小怪在空中时不触发 reach——这样玩家「跳着冲过去」能直接掠过，不被卡下来开打。
      const reachSuppressedByJump = this.enemySkippable && !this.onGround
      if (!this.enemyReached && !this.skipped && !reachSuppressedByJump) {
        const dx = Math.abs(this.hero.x - frontX)
        if (dx <= REACH_DIST) {
          this.enemyReached = true
          this.hint.setVisible(false)
          this.heroFacing = frontX >= this.hero.x ? 1 : -1
          this.applyHeroTransform(false, 0, 0)
        }
      }
    }

    // reach 状态变化统一在 update 循环里上报给 React（事件式 setState，避开 effect 体内同步 setState）
    if (this.enemyReached !== this.lastReportedReach) {
      this.lastReportedReach = this.enemyReached
      if (this.enemyReached) this.onReach?.()
      else this.onUnreach?.()
    }

    // 远景视差：随相机滚动慢一拍
    const camX = this.cameras.main.scrollX
    this.far.x = camX * 0.4
  }

  // ── React 接口：移动意图 / reach 回调 ───────────────────────────────
  setMove(intent: Partial<MoveIntent>) {
    if (intent.dir !== undefined) this.move.dir = intent.dir
    if (intent.jump) this.move.jump = true
  }

  /** 走到敌人面前时回调（由 update 循环触发）。 */
  setReachCallback(cb: (() => void) | null) {
    this.onReach = cb
  }

  /** 新敌人登场（重置「已到达」）时回调（由 update 循环触发）。 */
  setUnreachCallback(cb: (() => void) | null) {
    this.onUnreach = cb
  }

  /** 当前敌人是否可被「跳过去」越过（普通近战小怪 true；Boss/题目/特殊小怪 false）。 */
  setSkippable(v: boolean) {
    this.enemySkippable = v
  }

  /** 成功跳过当前敌人时回调（由 update 循环触发，事件式）。 */
  setSkipCallback(cb: (() => void) | null) {
    this.onSkip = cb
  }

  // ── 背景：远景视差层 + 地面 + 装饰（覆盖整个世界宽度）────────────────────
  private drawBackground(theme: SceneTheme) {
    this.bg.clear()
    this.far.clear()
    this.far.x = 0
    for (const d of this.decos) d.destroy()
    this.decos = []

    // 天空渐变（铺满世界宽）
    const steps = 12
    for (let i = 0; i < steps; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(theme.sky),
        Phaser.Display.Color.IntegerToColor(theme.skyBottom),
        steps - 1,
        i
      )
      this.bg.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1)
      this.bg.fillRect(0, (this.groundY / steps) * i, WORLD_W, this.groundY / steps + 1)
    }
    // 地面（铺满世界宽）
    this.bg.fillStyle(theme.ground, 1)
    this.bg.fillRect(0, this.groundY, WORLD_W, this.H - this.groundY)
    this.bg.lineStyle(4, theme.groundLine, 1)
    this.bg.lineBetween(0, this.groundY, WORLD_W, this.groundY)
    this.bg.setDepth(-2)

    // 远景：一排矮丘（视差层，update 里跟相机慢滚）
    this.far.fillStyle(theme.deco, 0.5)
    for (let x = -200; x < WORLD_W; x += 360) {
      const r = 120 + Math.random() * 80
      this.far.fillCircle(x, this.groundY, r)
    }
    this.far.setDepth(-3)

    // 近景装饰：一路的草丛/小树，沿世界宽分布
    const bushCount = Math.floor(WORLD_W / 220)
    for (let i = 0; i < bushCount; i++) {
      const x = 60 + i * 220 + Math.random() * 80
      const h = 26 + Math.random() * 28
      const bush = this.add.graphics()
      bush.fillStyle(theme.deco, 1)
      bush.fillCircle(x, this.groundY - h * 0.4, h * 0.5)
      bush.fillTriangle(x - h * 0.5, this.groundY, x + h * 0.5, this.groundY, x, this.groundY - h)
      bush.setDepth(-1)
      this.decos.push(bush)
    }
    // 云朵（飘动）
    const cloudCount = Math.floor(WORLD_W / 480)
    for (let i = 0; i < cloudCount; i++) {
      const x = 120 + i * 480 + Math.random() * 120
      const y = 40 + Math.random() * 80
      const cloud = this.add.text(x, y, '☁️', { fontSize: '40px' }).setOrigin(0.5).setAlpha(0.85).setDepth(-1)
      this.decos.push(cloud)
      this.tweens.add({ targets: cloud, x: x + 40, duration: 6000 + i * 1500, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    }
  }

  // ── 主角形象：圆润的吉祥物身体 + 小手小脚（不是火柴线条）──────────────────
  // 以「脚下中心」(0,0) 为原点向上画。整体高约 110，身体是带描边的圆角胶囊。
  private drawHeroBody(g: Phaser.GameObjects.Graphics) {
    g.clear()

    // 腿（两条短粗腿）+ 鞋
    g.fillStyle(HERO_LIMB, 1)
    g.fillRoundedRect(-18, -22, 14, 26, 7) // 左腿
    g.fillRoundedRect(4, -22, 14, 26, 7) // 右腿
    g.fillStyle(HERO_FOOT, 1) // 鞋（暖黄）
    g.fillEllipse(-11, 2, 22, 12)
    g.fillEllipse(11, 2, 22, 12)

    // 手臂（两侧短粗手臂，略微张开）
    g.fillStyle(HERO_LIMB, 1)
    g.fillRoundedRect(-40, -78, 14, 40, 7) // 左臂
    g.fillRoundedRect(26, -78, 14, 40, 7) // 右臂
    // 手（小圆手）
    g.fillStyle(0xffe0bd, 1)
    g.fillCircle(-33, -36, 9)
    g.fillCircle(33, -36, 9)

    // 身体：圆角胶囊（先描边色铺底再叠主色，得到一圈干净描边）
    g.fillStyle(HERO_BODY_DARK, 1)
    g.fillRoundedRect(-32, -94, 64, 78, 26) // 描边底（略大）
    g.fillStyle(HERO_BODY, 1)
    g.fillRoundedRect(-28, -90, 56, 70, 23) // 主体
    // 肚子上一块更亮的高光，增加立体感
    g.fillStyle(0xeaf2ff, 0.55)
    g.fillEllipse(-6, -64, 22, 30)

    // 围巾/领口（一抹暖色点缀，呼应鞋）
    g.fillStyle(HERO_FOOT, 1)
    g.fillRoundedRect(-22, -96, 44, 12, 6)
  }

  // ── 名牌(pill)：深色半透明圆角底 + 白色粗体字。hero/enemy 共用一套样式。──
  // 返回一个 container（内含 bg/label），并把 bg/label 存进 data，方便后续更新文字重绘。
  private makeNameplate(name: string, boss: boolean): Phaser.GameObjects.Container {
    const bg = this.add.graphics()
    const label = this.add
      .text(0, 0, name, { fontSize: boss ? '16px' : '15px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
    const c = this.add.container(0, 0, [bg, label])
    c.setData('bg', bg)
    c.setData('label', label)
    this.redrawNameplate(c, boss)
    return c
  }

  // 按当前 label 文本重绘 pill 底（自适应宽度）；boss 用暖红强调，普通用深色。
  private redrawNameplate(c: Phaser.GameObjects.Container, boss: boolean) {
    const bg = c.getData('bg') as Phaser.GameObjects.Graphics
    const label = c.getData('label') as Phaser.GameObjects.Text
    const padX = 12
    const w = Math.max(40, label.width + padX * 2)
    const h = label.height + 10
    bg.clear()
    bg.fillStyle(boss ? 0x9f1239 : NAMEPLATE_BG, boss ? 0.92 : 0.78)
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2)
    // 小尖角，像对话框指向头顶
    bg.fillTriangle(-6, h / 2 - 1, 6, h / 2 - 1, 0, h / 2 + 7)
  }

  /** 设置/更新主角头顶名牌的玩家名（多人需要）。空字符串则回退到默认 🧒。 */
  setHeroName(name: string) {
    const value = name && name.trim() ? name.trim() : '🧒'
    this.heroNameValue = value
    if (!this.heroName) return
    const label = this.heroName.getData('label') as Phaser.GameObjects.Text
    label.setText(value)
    this.redrawNameplate(this.heroName, false)
  }

  // 把朝向翻转、走路前倾、待机呼吸、空中拉伸、跳跃挤压等综合到 bodyGroup 的缩放/旋转上。
  private applyHeroTransform(walking: boolean, breath: number, airStretch: number) {
    // 朝向：整组镜像。乘上跳跃挤压的横向分量。
    this.heroBodyGroup.scaleX = this.heroFacing * this.jumpSquashX
    // 纵向：呼吸 + 空中拉伸 + 跳跃挤压。
    this.heroBodyGroup.scaleY = (1 + breath + airStretch) * this.jumpSquashY
    // 走路时朝前方微微倾身（最多约 5°），增加冲劲；静止/空中回正。
    this.heroBodyGroup.angle = walking ? this.heroFacing * 5 : 0
  }

  // 起跳：纵向拉伸→回弹的弹射手感。
  private playJumpSquash() {
    this.tweens.killTweensOf(this)
    this.jumpSquashX = 0.86
    this.jumpSquashY = 1.18
    this.tweens.add({
      targets: this,
      jumpSquashX: 1,
      jumpSquashY: 1,
      duration: 220,
      ease: 'quad.out',
    })
  }

  // 落地：横向铺开→回弹的「砸地」手感。
  private playLandSquash() {
    this.tweens.killTweensOf(this)
    this.jumpSquashX = 1.2
    this.jumpSquashY = 0.8
    this.tweens.add({
      targets: this,
      jumpSquashX: 1,
      jumpSquashY: 1,
      duration: 240,
      ease: 'back.out',
    })
  }

  // ── React 调用的接口方法 ─────────────────────────────────────────

  /** 新敌人登场（单怪/Boss/共斗）：换 emoji/名字；放到主角【前方】的路上，重置「已到达」标记。
   *  内部即单成员的 spawnWave，额外处理 Boss 形象（皇冠 + 更大 + 暖红名牌）。 */
  spawnEnemy(emoji: string, name: string, isBoss = false) {
    this.spawnWaveInternal([{ emoji, name }], isBoss)
  }

  /** 近战群登场：把 members 排成主角前方的一条横队（front 最近，其余朝右错开补位）。
   *  全部是普通小怪（无皇冠、常规大小）；front 是 reach + skip 目标。 */
  spawnWave(members: { emoji: string; name: string }[], skippable: boolean) {
    this.setSkippable(skippable)
    this.spawnWaveInternal(members.length ? members : [{ emoji: '🙂', name: '' }], false)
  }

  /** 内部实现：建/复用单位、套样式、排成横队入场，并重置 reach/skip。 */
  private spawnWaveInternal(members: { emoji: string; name: string }[], isBoss: boolean) {
    // 单位数量对齐 members：多了销毁、少了补建。
    while (this.units.length > members.length) {
      const u = this.units.pop()!
      u.container.destroy()
    }
    while (this.units.length < members.length) {
      this.units.push(this.createUnit(this.hero.x + 800))
    }

    // front 落点：主角前方拉开一段距离，让玩家「走过去」。其余朝右每隔 WAVE_GAP 站一个。
    const ahead = 560 + Math.random() * 180
    let frontX = this.hero.x + ahead
    const lineW = (members.length - 1) * WAVE_GAP
    if (frontX + lineW > WORLD_W - 80) frontX = Math.max(this.hero.x + 320, WORLD_W - 80 - lineW)

    members.forEach((m, i) => {
      const u = this.units[i]
      this.styleUnit(u, m.emoji, m.name, isBoss && i === 0)
      const targetX = frontX + i * WAVE_GAP
      u.container.x = targetX + 60
      u.container.y = this.groundY
      u.container.setAlpha(0)
      u.container.setScale(0.6)
      u.container.setAngle(0)
      // depth：front 最靠前（数值大），后排略低，避免名牌互相压住时层次混乱。
      u.container.setDepth(9 - i)
      this.tweens.add({ targets: u.container, x: targetX, alpha: 1, scale: 1, duration: 420, delay: i * 70, ease: 'back.out' })
    })

    // 重置 reach / skip；显示「往前走」提示
    this.enemyReached = false
    this.skipped = false
    this.hint.setVisible(true)
    this.repositionHint()

    // 偶尔换背景增加新鲜感
    if (Math.random() < 0.34) {
      this.theme = THEMES[Math.floor(Math.random() * THEMES.length)]
      this.drawBackground(this.theme)
    }

    // 若主角此刻已经贴着敌人（极端：世界尽头），下一帧 checkReach 会立即触发，避免卡死。
  }

  /** 近战群：前排倒下并移除，余下整体左滑补位——下一个成新前排并重新进入 reach（连击爽快）。
   *  空（已无单位）时安全 no-op。 */
  killFront() {
    if (this.units.length === 0) return
    const dying = this.units.shift()!
    // 前排播倒地（旋转 + 淡出）后销毁。
    this.tweens.add({
      targets: dying.container,
      angle: 90,
      y: this.groundY + 20,
      alpha: 0,
      duration: 460,
      ease: 'quad.in',
      onComplete: () => dying.container.destroy(),
    })
    const star = this.add.text(dying.container.x, dying.container.y - 70, '💫', { fontSize: '34px' }).setOrigin(0.5).setDepth(30)
    this.tweens.add({ targets: star, angle: 360, alpha: 0, duration: 700, onComplete: () => star.destroy() })

    // 余下整体左滑一格（朝主角），并刷新 depth；新前排自动重新参与 reach。
    this.units.forEach((u, i) => {
      this.tweens.add({ targets: u.container, x: u.container.x - WAVE_GAP, duration: 260, ease: 'quad.out' })
      u.container.setDepth(9 - i)
    })

    // 复位每个前排独立的 reach/skip 标记，让新前排能再次触发「揍他」面板/连击。
    this.enemyReached = false
    this.skipped = false
  }

  /** 大招 AoE：相机闪光 + 抖屏 + 放射光环 + 全体一起倒地 + 中二招式横幅，随后全部移除。 */
  clearWaveAoe(cry?: string | null) {
    if (this.units.length === 0) return
    this.cameras.main.flash(200, 255, 240, 160)
    this.cameras.main.shake(360, 0.02)

    // 以前排为中心来一圈放射光环
    const cx = this.front().container.x
    const cy = this.groundY - 50
    const ring = this.add.circle(cx, cy, 24, 0xffe08a, 0.55).setDepth(23)
    this.tweens.add({
      targets: ring,
      radius: 260,
      alpha: { from: 0.6, to: 0 },
      duration: 560,
      ease: 'quad.out',
      onComplete: () => ring.destroy(),
    })
    const burst = ['💥', '⚡', '✨', '🔥', '💫']
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14
      const em = burst[i % burst.length]
      const t = this.add.text(cx, cy, em, { fontSize: '30px' }).setOrigin(0.5).setDepth(24)
      this.tweens.add({
        targets: t,
        x: cx + Math.cos(a) * 200,
        y: cy + Math.sin(a) * 140,
        scale: { from: 0.6, to: 1.6 },
        alpha: { from: 1, to: 0 },
        duration: 600,
        ease: 'quad.out',
        onComplete: () => t.destroy(),
      })
    }

    // 全体一起倒地 + 移除。units 清空。
    const dying = this.units
    this.units = []
    dying.forEach((u, i) => {
      u.emojiText.setTint(0xff7a3c)
      this.tweens.add({
        targets: u.container,
        angle: 90,
        y: this.groundY + 20,
        alpha: 0,
        duration: 480,
        delay: i * 50,
        ease: 'quad.in',
        onComplete: () => u.container.destroy(),
      })
    })

    if (cry) {
      const big = this.add
        .text(this.W / 2, this.H * 0.3, cry, {
          fontSize: '40px',
          color: '#f59e0b',
          fontStyle: 'bold',
          align: 'center',
          stroke: '#ffffff',
          strokeThickness: 6,
          wordWrap: { width: this.W * 0.86 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(52)
      this.tweens.add({
        targets: big,
        scale: { from: 0.4, to: 1.15 },
        duration: 200,
        ease: 'back.out',
        yoyo: true,
        hold: 620,
        onComplete: () => big.destroy(),
      })
    }
  }

  /** 播放一次攻击/受击：attacker 冲向 target，命中后弹回；target 抖动；飘招式特效。
   *  敌方一律取 front（最近的那个），单怪/Boss 时即唯一那个。 */
  playHit(attacker: Side, kind: AttackKind, opts?: { crit?: boolean; damage?: number }) {
    const front = this.front()?.container
    const atkObj = attacker === 'hero' ? this.hero : front
    const tgtObj = attacker === 'hero' ? front : this.hero
    if (!atkObj || !tgtObj) return // 群已清空（极端竞态）：本帧不播
    const dir = atkObj.x <= tgtObj.x ? 1 : -1 // 朝目标方向
    const startX = atkObj.x
    const meta = ATTACK_META[kind]
    if (attacker === 'hero') {
      this.heroFacing = dir as 1 | -1
      this.applyHeroTransform(false, 0, 0) // 让身体即刻朝向目标
    }

    this.busy = true
    const lungeX = tgtObj.x - dir * 90 // 冲到目标前一点
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
    this.tweens.add({
      targets: tgtObj,
      x: tgtObj.x + dir * 18,
      duration: 60,
      yoyo: true,
      repeat: 2,
      ease: 'sine.inOut',
    })
    if (tgtObj !== this.hero) {
      // 命中敌方 front：闪红它的表情。
      const emojiText = this.front()?.emojiText
      if (emojiText) {
        emojiText.setTint(0xff5a5a)
        this.time.delayedCall(180, () => emojiText.clearTint())
      }
    } else {
      // 主角受击：闪烁新身体 + 头脸（不再是火柴线条）
      this.tweens.add({ targets: [this.heroBodyGfx, this.heroFace], alpha: 0.3, duration: 70, yoyo: true, repeat: 1 })
    }

    // 命中招式特效（扇耳光👋/踹腿🦵/挠痒🤣/吐痰💦）：砸得又大又狠，先猛地弹大再淡出。
    const fxBig = opts?.crit ? '108px' : '84px'
    const fx = this.add.text(tgtObj.x - dir * 48, tgtObj.y - 60, fxEmoji, { fontSize: fxBig }).setOrigin(0.5).setDepth(20)
    this.tweens.add({
      targets: fx,
      x: tgtObj.x,
      y: tgtObj.y - 76,
      scale: { from: 0.5, to: opts?.crit ? 3.0 : 2.4 },
      angle: dir * 38,
      alpha: { from: 1, to: 0 },
      duration: 520,
      ease: 'back.out',
      onComplete: () => fx.destroy(),
    })

    if (opts?.damage && opts.damage > 0) {
      const dmgColor = opts.crit ? '#f43f5e' : '#3e2409'
      const dmgSize = opts.crit ? '40px' : '28px'
      const dmg = this.add
        .text(tgtObj.x, tgtObj.y - 90, `-${opts.damage}`, { fontSize: dmgSize, color: dmgColor, fontStyle: 'bold' })
        .setOrigin(0.5)
        .setDepth(21)
      this.tweens.add({
        targets: dmg,
        y: tgtObj.y - 150,
        alpha: { from: 1, to: 0 },
        duration: 800,
        ease: 'quad.out',
        onComplete: () => dmg.destroy(),
      })
    }

    if (opts?.crit) {
      this.cameras.main.shake(220, 0.012)
      this.cameras.main.flash(160, 255, 230, 120)
      const crit = this.add
        .text(tgtObj.x, tgtObj.y - 120, '暴击!', { fontSize: '34px', color: '#f59e0b', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setDepth(22)
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

    if (kind === 'tickle') {
      const laugh = this.add.text(tgtObj.x + 30, tgtObj.y - 60, '😆', { fontSize: '26px' }).setOrigin(0.5).setDepth(21)
      this.tweens.add({ targets: laugh, y: tgtObj.y - 110, alpha: 0, duration: 700, onComplete: () => laugh.destroy() })
    }
  }

  /** 损人嘴炮特效：大字 + 屏幕猛抖 + 一堆嘲讽 emoji 朝敌人爆发。（损人=非近战单怪，front 即唯一那个） */
  playDiss(text: string, damage?: number) {
    const front = this.front()
    if (!front) return
    const enemy = front.container
    this.busy = true
    front.emojiText.setTint(0xff5a5a)
    this.time.delayedCall(300, () => front.emojiText.clearTint())
    this.tweens.add({ targets: enemy, x: enemy.x + 14, duration: 55, yoyo: true, repeat: 4, ease: 'sine.inOut' })

    this.cameras.main.shake(360, 0.018)
    this.cameras.main.flash(120, 255, 120, 120)

    // 大字钉在屏幕中央（scrollFactor 0，不随相机跑）
    const big = this.add
      .text(this.W / 2, this.H * 0.34, text, {
        fontSize: '40px',
        color: '#e11d48',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: this.W * 0.86 },
        stroke: '#ffffff',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
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
        this.busy = false
      },
    })

    const burst = ['💢', '😤', '🤣', '👎', '🗯️', '💩', '😝']
    for (let i = 0; i < 9; i++) {
      const em = burst[Math.floor(Math.random() * burst.length)]
      const t = this.add.text(this.hero.x, this.groundY - 50, em, { fontSize: '30px' }).setOrigin(0.5).setDepth(45)
      this.tweens.add({
        targets: t,
        x: enemy.x + (Math.random() * 80 - 40),
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

    if (damage && damage > 0) {
      const dmg = this.add
        .text(enemy.x, enemy.y - 90, `-${damage}`, { fontSize: '28px', color: '#e11d48', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setDepth(46)
      this.tweens.add({ targets: dmg, y: enemy.y - 150, alpha: 0, duration: 800, onComplete: () => dmg.destroy() })
    }
  }

  /** 队友（多人共斗）打出的命中：从天而降一记拳头砸在敌人头上，标出是谁打的。（共斗=单怪，front 即唯一那个） */
  playPeerHit(byName: string, damage?: number, crit?: boolean) {
    const front = this.front()
    if (!front) return
    const tx = front.container.x
    const ty = front.container.y
    const fist = this.add.text(tx, ty - 220, '👊', { fontSize: '46px' }).setOrigin(0.5).setDepth(48).setAlpha(0)
    this.tweens.add({
      targets: fist,
      y: ty - 60,
      alpha: { from: 1, to: 1 },
      duration: 240,
      ease: 'quad.in',
      onComplete: () => {
        this.cameras.main.shake(crit ? 200 : 120, crit ? 0.012 : 0.006)
        front.emojiText.setTint(0x7dd3fc)
        this.time.delayedCall(160, () => front.emojiText.clearTint())
        this.tweens.add({ targets: fist, alpha: 0, y: ty - 90, duration: 220, onComplete: () => fist.destroy() })
      },
    })
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

  /** 敌人倒下：旋转倒地 + 淡出。敌方取 front（单怪/Boss/共斗即唯一那个；近战群的逐个倒地走 killFront）。 */
  playDown(side: Side) {
    const obj = side === 'enemy' ? this.front()?.container : this.hero
    if (!obj) return
    this.tweens.add({
      targets: obj,
      angle: side === 'enemy' ? 90 : -90,
      y: this.groundY + 20,
      alpha: 0.2,
      duration: 520,
      ease: 'quad.in',
    })
    const star = this.add.text(obj.x, obj.y - 70, '💫', { fontSize: '34px' }).setOrigin(0.5).setDepth(30)
    this.tweens.add({ targets: star, angle: 360, alpha: 0, duration: 700, onComplete: () => star.destroy() })
  }

  /** 原地挥拳（空挥）：身体朝前微冲一下 + 手臂前摆 + 一记 👊 朝当前朝向飞出。无敌人在身边时的「打个空气」手感。 */
  attack() {
    if (this.busy) return
    const dir = this.heroFacing
    // 身体朝前微冲（jab）后回弹 + 手臂前摆角度
    this.tweens.killTweensOf(this.heroBodyGroup)
    const baseAngle = 0
    this.heroBodyGroup.angle = baseAngle + dir * 14
    this.tweens.add({
      targets: this.heroBodyGroup,
      angle: baseAngle,
      duration: 220,
      ease: 'back.out',
    })
    const startX = this.hero.x
    this.tweens.add({
      targets: this.hero,
      x: startX + dir * 22,
      duration: 90,
      yoyo: true,
      ease: 'quad.out',
    })
    // 一记拳头特效朝前飞
    const fist = this.add
      .text(this.hero.x + dir * 30, this.hero.y - 70, '👊', { fontSize: '38px' })
      .setOrigin(0.5)
      .setDepth(20)
      .setFlipX(dir < 0)
    this.tweens.add({
      targets: fist,
      x: this.hero.x + dir * 90,
      scale: { from: 0.7, to: 1.3 },
      alpha: { from: 1, to: 0 },
      angle: dir * 30,
      duration: 320,
      ease: 'quad.out',
      onComplete: () => fist.destroy(),
    })
    // 一条小风线，强调挥空
    const swoosh = this.add
      .text(this.hero.x + dir * 16, this.hero.y - 78, '💨', { fontSize: '24px' })
      .setOrigin(0.5)
      .setDepth(19)
      .setAlpha(0.9)
    this.tweens.add({
      targets: swoosh,
      x: this.hero.x + dir * 70,
      alpha: 0,
      duration: 300,
      onComplete: () => swoosh.destroy(),
    })
  }

  /** 技能特效（视觉，伤害/血量由 React 算）。nova=大招爆发（朝敌人 front）；heal=回血光效（在主角身上）。
   *  nova 用于 Boss 或单个小怪（单怪 front 即唯一那个）；近战群的 AoE 走 clearWaveAoe。 */
  playSkillFx(kind: 'nova' | 'heal', cry?: string | null) {
    if (kind === 'nova') {
      const front = this.front()
      if (!front) return
      const enemy = front.container
      const tx = enemy.x
      const ty = enemy.y - 50
      this.cameras.main.flash(180, 255, 240, 160)
      this.cameras.main.shake(280, 0.016)
      // 中心一记大字 + 放射光环
      const ring = this.add.circle(tx, ty, 20, 0xffe08a, 0.55).setDepth(23)
      this.tweens.add({
        targets: ring,
        radius: 170,
        alpha: { from: 0.6, to: 0 },
        duration: 520,
        ease: 'quad.out',
        onComplete: () => ring.destroy(),
      })
      // 一圈爆裂 emoji
      const burst = ['💥', '⚡', '✨', '🔥', '💫']
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 * i) / 12
        const em = burst[i % burst.length]
        const t = this.add.text(tx, ty, em, { fontSize: '30px' }).setOrigin(0.5).setDepth(24)
        this.tweens.add({
          targets: t,
          x: tx + Math.cos(a) * 140,
          y: ty + Math.sin(a) * 110,
          scale: { from: 0.6, to: 1.5 },
          alpha: { from: 1, to: 0 },
          duration: 560,
          ease: 'quad.out',
          onComplete: () => t.destroy(),
        })
      }
      front.emojiText.setTint(0xff7a3c)
      this.time.delayedCall(260, () => front.emojiText.clearTint())
      this.tweens.add({ targets: enemy, x: enemy.x + 22, duration: 60, yoyo: true, repeat: 3, ease: 'sine.inOut' })
      if (cry) {
        const big = this.add
          .text(this.W / 2, this.H * 0.3, cry, {
            fontSize: '40px',
            color: '#f59e0b',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#ffffff',
            strokeThickness: 6,
            wordWrap: { width: this.W * 0.86 },
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(52)
        this.tweens.add({
          targets: big,
          scale: { from: 0.4, to: 1.15 },
          duration: 200,
          ease: 'back.out',
          yoyo: true,
          hold: 620,
          onComplete: () => big.destroy(),
        })
      }
      return
    }
    // heal：主角身上绿色上升光 + ➕
    const hx = this.hero.x
    const hy = this.hero.y
    this.cameras.main.flash(140, 150, 255, 170)
    for (let i = 0; i < 9; i++) {
      const t = this.add
        .text(hx + (Math.random() * 60 - 30), hy - 10, Math.random() < 0.5 ? '➕' : '💚', { fontSize: '26px' })
        .setOrigin(0.5)
        .setDepth(24)
      this.tweens.add({
        targets: t,
        y: hy - 120 - Math.random() * 50,
        alpha: { from: 1, to: 0 },
        scale: { from: 0.7, to: 1.3 },
        duration: 720 + Math.random() * 280,
        delay: i * 40,
        ease: 'quad.out',
        onComplete: () => t.destroy(),
      })
    }
    if (cry) {
      const big = this.add
        .text(this.W / 2, this.H * 0.3, cry, {
          fontSize: '34px',
          color: '#16a34a',
          fontStyle: 'bold',
          align: 'center',
          stroke: '#ffffff',
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(52)
      this.tweens.add({
        targets: big,
        scale: { from: 0.5, to: 1.1 },
        alpha: { from: 1, to: 0 },
        duration: 900,
        ease: 'back.out',
        onComplete: () => big.destroy(),
      })
    }
  }

  isBusy() {
    return this.busy
  }
}
