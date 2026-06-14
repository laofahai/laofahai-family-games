// 课间大乱斗 · 主场景（Phaser 原生）。这里是整局的唯一事实来源：
//   游戏循环、Arcade 物理、键盘输入、实体（主角/小怪/BOSS）、近战命中、碰撞、敌人 AI、
//   波次推进、BOSS 知识闸、学霸大招、动画、相机、场景/天气、打击感（juice）全在本类。
// React 只通过 GameBridge 收事件画 HUD/弹窗，并经 GameControls 把触屏/答题/静音意图喂回来。
//
// 流程：每关 N 波小怪（1–5，偏 2–4）→ 清完进 BOSS 波 → BOSS 学霸护盾免疫近战，
//      逼近主角时弹学科题（知识闸）：答对重创 BOSS、答错 BOSS 反打主角；BOSS 倒下→下一关。
//      全部关通关=won；主角血空=lost。能量满时按技能弹随机学科题，答对放 AoE（清波/重创 BOSS）。

import Phaser from 'phaser'
import { rosterFor, type BossDef } from '@/games/_battle/roster'
import { drawBySubject, drawQuestions } from '@/games/_battle/questions'
import { skillCry, battleCry } from '@/games/_battle/cries'
import { subjectLabel, type BattleQuestion, type Band } from '@/games/_battle/core'
import { playSfx, isMuted, toggleMuted, unlockAudio } from '@/games/shared/sound'
import { saveLevel } from '../storage'
import { type GameBridge, type GameControls, type MoveDir, type SkillKind, type SceneConfig, type HudState } from './bridge'
import { preloadSprites, registerAnims, pickClassmateKey, pickHeroKey, pickTeacherKey } from './assets'
import { Hero, COMBO_MOVES, type MoveSpec } from './Hero'
import { Enemy } from './Enemy'
import { FloatingQuiz } from './FloatingQuiz'
import { themeForLevel, type Theme } from './themes'

/** 学科 → 冲击波/光效配色（答对按科目配色）。 */
const SUBJECT_COLOR: Record<string, number> = {
  math: 0x4f9eff,
  chinese: 0xff7a59,
  english: 0x9b7cff,
  science: 0x35d6a4,
  sports: 0xffb020,
  life: 0x6fd36f,
  social: 0xff8fc7,
  interest: 0xffd23f,
  funny: 0xff5a8a,
}
function subjectColor(subject: string): number {
  return SUBJECT_COLOR[subject] ?? 0x7cc0ff
}

const WORLD_W = 3600 // 世界宽（比屏宽，相机横向滚动）
const GROUND_RATIO = 0.82 // 地面线在视口高度的占比
const HERO_MELEE_DMG = 1
const MOB_HIT_DMG = 1 // 小怪打主角的伤害
const BOSS_HIT_DMG = 1
const BOSS_KNOWLEDGE_DMG = 1 // 答对一题扣 BOSS 1 血
const ENERGY_PER_KILL = 0.34 // 每杀一个小怪涨多少能量
const ENERGY_PER_HIT = 0.08 // 每命中一次涨多少
const QUIZ_SECONDS = 15
const MAX_WEATHER = 80 // 天气粒子上限

type Pending = { source: 'boss' | 'skill'; question: BattleQuestion; resolved: boolean }

export class ArenaScene extends Phaser.Scene {
  private cfg!: SceneConfig
  private bridge!: GameBridge
  private band!: Band
  private bosses: BossDef[] = []
  private mobNames: string[] = []
  private playerName = ''
  private totalLevels = 1

  private W = 800
  private H = 450
  private groundY = 360

  private hero!: Hero
  private enemies!: Phaser.Physics.Arcade.Group
  private platforms!: Phaser.Physics.Arcade.StaticGroup

  // 输入
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private touchDir: MoveDir = 0 // 触屏方向意图（叠加键盘）
  private allKeys: Phaser.Input.Keyboard.Key[] = [] // 所有移动相关键（弹窗时统一清栓锁用）

  // 局面状态（场景持有，唯一事实来源）
  private level = 0 // 0-based
  private waveIndex = 0 // 0-based，含 BOSS 波（=最后一波）
  private waveTotal = 1
  private waveDefs: number[] = [] // 每波小怪数；BOSS 波用 -1 标记
  private waveActive = false // 当前波是否已生成且未清空
  private pendingSpawns = 0 // 本波还有几个敌人在排队（delayedCall）未生成；>0 时不算清波
  private energy = 0
  private combo = 0
  private skill: SkillKind = 'nova'
  private theme!: Theme
  private boss?: Enemy
  private pending: Pending | null = null // 当前挂起的答题（boss=React 卡片 / skill=Phaser 飘题）
  private floatingQuiz?: FloatingQuiz // 学霸大招的轻量飘浮快题（Phaser 原生）
  private quizTimer?: Phaser.Time.TimerEvent
  private bossQuizCdUntil = 0 // BOSS 答题闸冷却（避免连弹）
  private frozenUntil = 0 // hitstop：全局冻结到此刻
  private slowmoUntil = 0 // 微慢镜结束时刻（大招/重击）
  private over = false
  private hudThrottleAt = 0 // 下次允许推 HUD 的时刻（节流，避免每帧推）
  private weatherParticles: Phaser.GameObjects.Rectangle[] = []
  private bgSky!: Phaser.GameObjects.Graphics // 天空层（固定铺满视口，不随相机滚）
  private bgFar!: Phaser.GameObjects.Container // 远景（视差慢）
  private bgNear!: Phaser.GameObjects.Container // 近景（视差快）+ 地面

  constructor() {
    super('arena')
  }

  init(cfg: SceneConfig): void {
    this.cfg = cfg
    this.bridge = cfg.bridge
    this.band = cfg.band
    const roster = rosterFor(cfg.player)
    this.bosses = roster.bosses
    this.mobNames = roster.mobs
    this.playerName = roster.player
    this.totalLevels = roster.bosses.length
    this.level = Phaser.Math.Clamp(cfg.startLevel, 0, this.totalLevels - 1)
    // 重置每局状态（场景可能被 restart 复用）。
    this.over = false
    this.pending = null
    this.floatingQuiz?.dismiss()
    this.floatingQuiz = undefined
    this.energy = 0
    this.combo = 0
    this.skill = 'nova'
    this.boss = undefined
    this.slowmoUntil = 0
    this.weatherParticles = []
  }

  preload(): void {
    preloadSprites(this.load)
    this.load.on('progress', (p: number) => this.bridge.emit('loading', p))
  }

  create(): void {
    registerAnims(this.anims)
    this.W = this.scale.width
    this.H = this.scale.height
    this.physics.world.setBounds(0, 0, WORLD_W, this.H)
    this.physics.world.gravity.y = 1800

    this.bgSky = this.add.graphics().setScrollFactor(0).setDepth(0)
    this.bgFar = this.add.container(0, 0).setDepth(1)
    this.bgNear = this.add.container(0, 0).setDepth(2)

    // 地面与平台。
    this.platforms = this.physics.add.staticGroup()
    this.buildLevelWorld()

    // 主角（头顶挂玩家名）。按玩家性别选精灵（女=herog / 男=hero）。
    this.hero = new Hero(this, 200, this.groundY, this.playerName, pickHeroKey(this.cfg.player, this.playerName))
    this.physics.add.collider(this.hero, this.platforms)

    // 敌人组。
    this.enemies = this.physics.add.group({ runChildUpdate: false })
    this.physics.add.collider(this.enemies, this.platforms)

    // 主角攻击命中区 vs 敌人。
    this.physics.add.overlap(this.hero.hitbox, this.enemies, (_hb, e) => this.onMeleeOverlap(e as Enemy))
    // 敌人 lunge 接触主角 → 敌人打主角。
    this.physics.add.overlap(this.hero, this.enemies, (_h, e) => this.onEnemyTouch(e as Enemy))

    // 相机跟随主角，限制在世界内。
    this.cameras.main.setBounds(0, 0, WORLD_W, this.H)
    this.cameras.main.startFollow(this.hero, true, 0.1, 0.1, -this.W * 0.18, this.groundY - this.H * 0.62)
    this.cameras.main.setDeadzone(this.W * 0.3, this.H)

    this.setupInput()
    this.exposeControls()

    // 开第一波。
    this.startLevel(this.level)
    this.bridge.emit('ready', undefined)
    this.pushHud()

    // 自适应：窗口变化时重排地面/背景。
    this.scale.on('resize', this.onResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize, this)
    })
  }

  // ── 世界/场景 ───────────────────────────────────────────────────────
  /** create 时建一次世界（地面碰撞体 + 首张背景）。后续换关只重画背景。 */
  private buildLevelWorld(): void {
    this.theme = themeForLevel(this.level)
    this.groundY = Math.round(this.H * GROUND_RATIO)
    this.drawBackground()
    // 地面碰撞体（不可见静态矩形，铺满世界宽）。
    this.platforms.clear(true, true)
    const ground = this.add.rectangle(WORLD_W / 2, this.groundY + 40, WORLD_W, 80, 0x000000, 0)
    this.platforms.add(ground)
    const gb = ground.body as Phaser.Physics.Arcade.StaticBody
    gb.updateFromGameObject()
    this.setupWeather()
  }

  /** 重画背景（幂等：清空两层容器 + 天空层后重绘当前 theme）。 */
  private drawBackground(): void {
    this.bgFar.removeAll(true)
    this.bgNear.removeAll(true)
    this.bgSky.clear()
    const t = this.theme
    // 背景元素位置用「按关卡定种子」的确定性随机：同一关每次重画都生成一致布局，
    // 即便 onResize/换关重画，树/云/星也不会瞬移乱跳（修复「背景所有元素无规律地动」）。
    const rng = new Phaser.Math.RandomDataGenerator(['bg', String(this.level)])
    const rnd = () => rng.frac()
    // 天空渐变（固定层，用横向条带从上到下插值堆出来，铺满视口）。
    const steps = 24
    for (let i = 0; i < steps; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(t.skyTop),
        Phaser.Display.Color.IntegerToColor(t.skyBottom),
        steps, i,
      )
      this.bgSky.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1)
      this.bgSky.fillRect(0, (this.H * i) / steps, this.W, this.H / steps + 1)
    }

    // 夜晚：月亮 + 星星。
    if (t.night) {
      for (let i = 0; i < 40; i++) {
        const star = this.add.circle(rnd() * WORLD_W, rnd() * this.H * 0.6, rnd() * 1.6 + 0.6, 0xffffff, 0.9)
        star.setScrollFactor(0.2)
        this.bgFar.add(star)
      }
      const moon = this.add.circle(this.W * 0.78, this.H * 0.2, 34, 0xfdf6c9, 1).setScrollFactor(0.2)
      this.bgFar.add(moon)
    }
    // 云/雾。
    if (t.cloud) {
      for (let i = 0; i < 7; i++) {
        const cx = rnd() * WORLD_W
        const cy = this.H * (0.1 + rnd() * 0.28)
        const cloud = this.add.ellipse(cx, cy, 120 + rnd() * 120, 44 + rnd() * 30, t.cloud, 0.55)
        cloud.setScrollFactor(0.35)
        this.bgFar.add(cloud)
      }
    }
    // 远景剪影（按地形铺一排）。
    const horizon = this.groundY
    for (let x = -100; x < WORLD_W + 100; x += 220) {
      const far = this.drawDeco(x + rnd() * 80, horizon, t.decoFar, 0.7, t)
      far.setScrollFactor(0.5)
      this.bgFar.add(far)
    }
    // 近景装饰（更大、更靠下、视差更快）。
    for (let x = 0; x < WORLD_W; x += 360) {
      const near = this.drawDeco(x + rnd() * 120, horizon, t.decoNear, 1.15, t)
      near.setScrollFactor(0.9)
      this.bgNear.add(near)
    }
    // 地面（铺色 + 地平线）。
    const groundG = this.add.graphics()
    groundG.fillStyle(t.ground, 1)
    groundG.fillRect(0, horizon, WORLD_W, this.H - horizon + 80)
    groundG.lineStyle(4, t.groundLine, 1)
    groundG.lineBetween(0, horizon, WORLD_W, horizon)
    // 地面纹理（虚线/草点）。
    groundG.fillStyle(t.groundLine, 0.5)
    for (let x = 0; x < WORLD_W; x += 60) groundG.fillRect(x, horizon + 18, 26, 4)
    groundG.setScrollFactor(1)
    groundG.setDepth(3)
    this.bgNear.add(groundG)
  }

  /** 画一个装饰物（按主题种类：树/仙人掌/松树/楼/山丘/路灯），返回一个容器。 */
  private drawDeco(x: number, baseY: number, color: number, scale: number, t: Theme): Phaser.GameObjects.Container {
    const c = this.add.container(x, baseY)
    const g = this.add.graphics()
    const k = t.deco
    if (k === 'tree') {
      g.fillStyle(0x6b4a2b, 1); g.fillRect(-6 * scale, -50 * scale, 12 * scale, 50 * scale)
      g.fillStyle(color, 1); g.fillCircle(0, -64 * scale, 38 * scale)
    } else if (k === 'pine') {
      g.fillStyle(0x6b4a2b, 1); g.fillRect(-5 * scale, -30 * scale, 10 * scale, 30 * scale)
      g.fillStyle(color, 1)
      g.fillTriangle(-30 * scale, -34 * scale, 30 * scale, -34 * scale, 0, -96 * scale)
      g.fillTriangle(-24 * scale, -56 * scale, 24 * scale, -56 * scale, 0, -110 * scale)
    } else if (k === 'cactus') {
      g.fillStyle(color, 1)
      g.fillRoundedRect(-9 * scale, -76 * scale, 18 * scale, 76 * scale, 8)
      g.fillRoundedRect(-30 * scale, -52 * scale, 14 * scale, 30 * scale, 6)
      g.fillRoundedRect(16 * scale, -60 * scale, 14 * scale, 30 * scale, 6)
    } else if (k === 'building') {
      g.fillStyle(color, 1); g.fillRect(-40 * scale, -130 * scale, 80 * scale, 130 * scale)
      g.fillStyle(0xffe9a8, 0.85)
      for (let r = 0; r < 4; r++) for (let col = 0; col < 3; col++) g.fillRect(-30 * scale + col * 22 * scale, -116 * scale + r * 28 * scale, 12 * scale, 16 * scale)
    } else if (k === 'hill') {
      g.fillStyle(color, 1); g.fillEllipse(0, -10 * scale, 200 * scale, 120 * scale)
    } else { // lamp
      g.fillStyle(0x444444, 1); g.fillRect(-3 * scale, -120 * scale, 6 * scale, 120 * scale)
      g.fillStyle(0xfff1a8, 1); g.fillCircle(0, -124 * scale, 10 * scale)
    }
    c.add(g)
    return c
  }

  private setupWeather(): void {
    this.clearWeather()
    if (this.theme.weather === 'none') return
    const isSnow = this.theme.weather === 'snow'
    for (let i = 0; i < MAX_WEATHER; i++) {
      const p = isSnow
        ? this.add.rectangle(Math.random() * this.W, Math.random() * this.H, 4, 4, 0xffffff, 0.9)
        : this.add.rectangle(Math.random() * this.W, Math.random() * this.H, 2, 12, 0xbcd0e6, 0.7)
      p.setScrollFactor(0).setDepth(90)
      this.weatherParticles.push(p)
    }
  }

  private clearWeather(): void {
    this.weatherParticles.forEach((p) => p.destroy())
    this.weatherParticles = []
  }

  private updateWeather(dt: number): void {
    if (!this.weatherParticles.length) return
    const snow = this.theme.weather === 'snow'
    const vy = snow ? 60 : 520
    const vx = snow ? 18 : 90
    for (const p of this.weatherParticles) {
      p.y += vy * dt
      p.x += vx * dt
      if (snow) p.x += Math.sin((this.time.now + p.y) * 0.005) * 0.6
      if (p.y > this.H) { p.y = -8; p.x = Math.random() * this.W }
      if (p.x > this.W) p.x = 0
    }
  }

  // ── 输入 ─────────────────────────────────────────────────────────────
  private setupInput(): void {
    const kb = this.input.keyboard!
    this.cursors = kb.createCursorKeys()
    this.keys = kb.addKeys('W,A,S,D,J,K,L,SPACE') as Record<string, Phaser.Input.Keyboard.Key>
    // 移动相关键集合（含方向键），弹窗打开时统一清「按下栓锁」。
    this.allKeys = [this.keys.A, this.keys.D, this.cursors.left, this.cursors.right]
    // 离散动作用 keydown 事件（避免每帧重复触发）。
    this.keys.J.on('down', () => this.doAttack())
    this.keys.K.on('down', () => this.doSkill())
    this.keys.L.on('down', () => this.doSwitchSkill())
    const jump = () => this.doJump()
    this.keys.W.on('down', jump)
    this.keys.SPACE.on('down', jump)
    this.cursors.up.on('down', jump)
    // 首次任意键解锁音频。
    kb.on('keydown', () => unlockAudio(), this)
  }

  /**
   * 清掉所有「移动方向」栓锁：触屏意图清零 + 重置 Phaser 键的 isDown 状态。
   * 弹窗（答题卡片/飘题）打开时调用，避免暂停期间松/换键后仍按旧方向自动走，
   * 也避免「按反方向无反应、必须重按同方向才解开」的卡死。弹窗关闭后下一帧重读实时输入。
   */
  private clearMovementInput(): void {
    this.touchDir = 0
    // Phaser 的 Key.reset() 会清掉 isDown/_justDown 等内部状态；DOM 仍持有真实按键，
    // 玩家下次按下/松开会重新触发事件刷新状态，所以这里清掉旧栓锁是安全的。
    for (const k of this.allKeys) k?.reset()
  }

  /** 把控制接口回填给 React 宿主（触屏按钮/答题/静音）。 */
  private exposeControls(): void {
    const controls: GameControls = {
      setMove: (dir) => { this.touchDir = dir },
      jump: () => { unlockAudio(); this.doJump() },
      attack: () => { unlockAudio(); this.doAttack() },
      triggerSkill: () => { unlockAudio(); this.doSkill() },
      switchSkill: () => this.doSwitchSkill(),
      submitAnswer: (id) => this.resolveQuiz(id),
      toggleMute: () => { const m = toggleMuted(); this.pushHud(); return m },
      restart: () => this.restartLevel(),
    }
    this.cfg.onControls(controls)
  }

  // ── 关卡/波次 ───────────────────────────────────────────────────────
  private startLevel(level: number): void {
    this.level = level
    this.theme = themeForLevel(level)
    // 重画背景（biome 切换）+ 重铺天气。drawBackground 幂等，不会泄漏旧对象。
    this.drawBackground()
    this.setupWeather()
    // 设计波次：2–3 波小怪 + 1 波 BOSS（最后）。
    const mobWaves = Phaser.Math.Between(2, 3)
    this.waveDefs = []
    for (let i = 0; i < mobWaves; i++) {
      // 每波 1–5（偏 2–4）。
      this.waveDefs.push(this.weightedWaveSize())
    }
    this.waveDefs.push(-1) // BOSS 波
    this.waveTotal = this.waveDefs.length
    this.waveIndex = 0
    this.boss = undefined
    this.bossQuizCdUntil = 0
    // 把主角放回左侧入场，给一段入场无敌（避免刚进关贴脸刷怪连扣）。
    this.hero.setPosition(220, this.groundY)
    this.hero.invulnUntil = this.time.now + 1200
    this.cameras.main.flash(280, 255, 255, 255)
    this.spawnCurrentWave()
    this.pushHud()
  }

  private weightedWaveSize(): number {
    // 权重偏向 2–3（仍保留 1 和 5 的可能，符合「1–5、偏 2–4」需求且不至于太挤）。
    const pool = [1, 2, 2, 2, 3, 3, 3, 4, 4, 5]
    return pool[Phaser.Math.Between(0, pool.length - 1)]
  }

  private spawnCurrentWave(): void {
    const def = this.waveDefs[this.waveIndex]
    this.waveActive = true
    if (def === -1) {
      this.pendingSpawns = 1
      this.spawnBoss()
    } else {
      // 记下还要生成几个；逐个延时入场，每个生成后 pendingSpawns--（清波判定要等都生成完）。
      this.pendingSpawns = def
      for (let i = 0; i < def; i++) {
        // 大多从右入场，偶尔从左包抄。
        const fromLeft = Math.random() < 0.22 && i > 0
        this.time.delayedCall(i * 240, () => this.spawnMob(fromLeft))
      }
    }
    this.pushHud()
  }

  private spawnMob(fromLeft: boolean): void {
    this.pendingSpawns = Math.max(0, this.pendingSpawns - 1)
    if (this.over) return
    const name = this.mobNames[Phaser.Math.Between(0, this.mobNames.length - 1)]
    // 以【主角】为基准在安全距离外生成（不依赖相机/视口尺寸，避免首帧未测量导致贴脸刷怪）。
    const camW = this.cameras.main.width || this.W
    const gap = Math.max(camW * 0.6, 420) // 至少离主角一屏多
    const x = fromLeft
      ? Math.max(60, this.hero.x - gap - Phaser.Math.Between(0, 120))
      : Math.min(WORLD_W - 60, this.hero.x + gap + Phaser.Math.Between(0, 160))
    const hp = Phaser.Math.Between(1, 2)
    const speed = Phaser.Math.Between(70, 120)
    const e = new Enemy(this, x, this.groundY, { charKey: pickClassmateKey(name), name, isBoss: false, hp, speed })
    this.enemies.add(e)
    this.physics.add.collider(e, this.platforms)
  }

  private spawnBoss(): void {
    this.pendingSpawns = 0
    if (this.over) return
    const def = this.bosses[this.level]
    const camW = this.cameras.main.width || this.W
    const x = Math.min(WORLD_W - 80, this.hero.x + Math.max(camW * 0.65, 480))
    // 老师 Boss 按名字性别选精灵（女=teacherF / 男=teacher）。
    const e = new Enemy(this, x, this.groundY, { charKey: pickTeacherKey(def.name), name: def.name, isBoss: true, hp: def.hp, speed: 70 })
    this.enemies.add(e)
    this.physics.add.collider(e, this.platforms)
    this.boss = e
    // BOSS 出场吼。
    const taunt = def.taunts[Phaser.Math.Between(0, def.taunts.length - 1)]
    this.floatText(e.x, e.y - e.displayHeight - 30, `${def.name}：「${taunt}」`, '#ffe08a', 20)
    this.cameras.main.shake(220, 0.006)
    this.pushHud()
  }

  // ── 动作 ─────────────────────────────────────────────────────────────
  private get frozen(): boolean {
    return this.time.now < this.frozenUntil || this.pending !== null || this.over
  }

  private doJump(): void {
    if (this.frozen) return
    if (this.hero.canJump()) {
      this.hero.jump()
      playSfx('jump')
    }
  }

  private doAttack(): void {
    if (this.frozen) return
    const step = this.hero.startAttack()
    if (step < 0) return // 没挥出（硬直/已在攻击中）
    const move = COMBO_MOVES[step]
    playSfx(move.sfx) // 每招出招音不同（slap/kick/spit）
    // 招式名飘字（短停留，挂在主角头顶前方）：肉眼可辨这一击是哪招（#21/#22）。
    const ahead = this.hero.facing * 36
    this.floatText(this.hero.x + ahead, this.hero.y - this.hero.displayHeight - 18, move.name, move.labelColor, 22)
  }

  private doSwitchSkill(): void {
    this.skill = this.skill === 'nova' ? 'heal' : 'nova'
    this.pushHud()
  }

  private doSkill(): void {
    if (this.frozen) return
    if (this.energy < 1) {
      this.floatText(this.hero.x, this.hero.y - 150, '能量不足', '#9aa6b2', 18)
      return
    }
    // 大招要先答一道随机学科题（学霸大招）—— 用轻量飘浮快题（不卡屏卡片）。
    const q = drawQuestions({ band: this.band, count: 1, learnRatio: 1 })[0]
    if (!q) {
      this.floatText(this.hero.x, this.hero.y - 150, '题库加载中…', '#9aa6b2', 18)
      return
    }
    this.castAura(subjectColor(q.subject))
    this.openSkillQuiz(q)
  }

  /** 技能起手光环：主角脚下涌起一圈能量环 + 上升粒子。 */
  private castAura(color: number): void {
    playSfx('skill')
    const cx = this.hero.x
    const cy = this.hero.y - this.hero.displayHeight * 0.4
    const ring = this.add.circle(cx, this.hero.y - 6, 10, color, 0.0).setDepth(48)
    ring.setStrokeStyle(4, color, 0.9)
    this.tweens.add({ targets: ring, radius: this.hero.displayHeight * 0.9, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() })
    // 上升的光点。
    for (let i = 0; i < 12; i++) {
      const px = cx + Phaser.Math.Between(-40, 40)
      const p = this.add.circle(px, this.hero.y, Phaser.Math.Between(2, 5), color, 0.9).setDepth(49)
      this.tweens.add({ targets: p, y: cy - Phaser.Math.Between(40, 110), alpha: 0, duration: Phaser.Math.Between(380, 680), ease: 'Quad.easeOut', onComplete: () => p.destroy() })
    }
    this.hero.setTint(color)
    this.time.delayedCall(260, () => this.hero.clearTint())
  }

  /** 打开学霸大招的飘浮快题（Phaser 原生，自动收起）。 */
  private openSkillQuiz(question: BattleQuestion): void {
    this.pending = { source: 'skill', question, resolved: false }
    this.clearMovementInput() // 弹窗即暂停：清移动栓锁，主角立刻停步（见 #23）
    this.hero.drive(0, true)
    playSfx('tap')
    const qx = Phaser.Math.Clamp(this.hero.x, this.cameras.main.scrollX + 200, this.cameras.main.scrollX + this.W - 200)
    const qy = this.hero.y - this.hero.displayHeight - 70
    this.floatingQuiz = new FloatingQuiz(
      this,
      question,
      { x: qx, y: qy, subjectLabel: subjectLabel(question.subject), accent: subjectColor(question.subject), seconds: QUIZ_SECONDS },
      (id) => this.resolveSkillFromFloating(id),
    )
    this.pushHud()
  }

  private resolveSkillFromFloating(choiceId: string | null): void {
    const p = this.pending
    if (!p || p.resolved || p.source !== 'skill') return
    p.resolved = true
    this.pending = null
    this.floatingQuiz = undefined
    const correct = choiceId != null && choiceId === p.question.answer
    this.resolveSkillQuiz(correct, p.question.subject)
    this.pushHud()
  }

  // ── 近战命中（主角命中区 vs 敌人）──────────────────────────────────────
  private onMeleeOverlap(enemy: Enemy): void {
    if (!this.hero.swingActive || enemy.dead) return
    if (this.hero.hitThisSwing.has(enemy)) return
    this.hero.hitThisSwing.add(enemy)

    const move = this.hero.activeMove
    const result = enemy.meleeHit(HERO_MELEE_DMG, this.hero.x, move.knockback, move.launch)
    if (result === 'immune') {
      this.floatText(enemy.x, enemy.y - enemy.displayHeight - 10, '学霸护盾·免疫!', '#7cc0ff', 18)
      this.hitstop(40)
      this.cameras.main.shake(80, 0.003)
      playSfx('hit')
      return
    }
    // 命中表演：每招的命中特效形状/配色不同（巴掌=星 / 踹=冲击环 / 呸=喷溅波）。
    this.combo += 1
    // 第 3 招（呸）= 收招，配合 kill-streak 触发暴击感（更重的 hitstop/慢镜/闪屏）。
    const crit = this.combo > 0 && this.combo % 3 === 0
    this.gainEnergy(ENERGY_PER_HIT)
    this.hitstop(crit ? 95 : 60)
    if (crit) this.slowmo(120, 0.5)
    this.cameras.main.shake(crit ? 170 : 95, crit ? 0.009 : 0.0045)
    const hitX = enemy.x
    const hitY = enemy.y - enemy.displayHeight * 0.55
    this.moveImpact(hitX, hitY, move, crit)
    this.comboGlow()
    this.floatText(enemy.x, enemy.y - enemy.displayHeight - 6, crit ? `暴击 ${HERO_MELEE_DMG * 2}!` : `-${HERO_MELEE_DMG}`, crit ? '#ffd23f' : '#ffffff', crit ? 26 : 20)
    this.spawnBurst(hitX, hitY, crit ? 0xffd23f : move.vfxColor, crit ? 14 : 8)
    if (crit) playSfx('crit') // 收招暴击额外叠一记重音（出招音在 doAttack 已播）
    if (crit) {
      this.cameras.main.flash(120, 255, 220, 120)
      const cry = battleCry('crit', this.band)
      if (cry) this.floatText(this.hero.x, this.hero.y - 160, cry, '#ffd23f', 22)
    }
    if (result === 'dead') this.onEnemyKilled(enemy)
    this.pushHud()
  }

  private onEnemyTouch(enemy: Enemy): void {
    if (this.frozen || enemy.dead) return
    const now = this.time.now
    if (!enemy.isLunging(now)) return // 只有在攻击窗口才造成伤害
    // 跳跃可躲：敌人攻击在身体/地面高度，主角跳起来（脚底高过攻击线）就越过这一击。
    if (!enemy.lungeHitsAt(this.hero.y)) {
      enemy.lungeHitDone = true // 消耗这次扑击（落空）
      this.floatText(this.hero.x, this.hero.y - this.hero.displayHeight - 20, '闪避!', '#9fe0ff', 18)
      return
    }
    enemy.lungeHitDone = true
    const dmg = enemy.isBoss ? BOSS_HIT_DMG : MOB_HIT_DMG
    const hurt = this.hero.takeHit(dmg, enemy.x)
    if (!hurt) return // 无敌期内
    this.combo = 0
    this.hitstop(70)
    this.cameras.main.shake(140, 0.007)
    this.cameras.main.flash(120, 255, 80, 80)
    this.floatText(this.hero.x, this.hero.y - 150, `-${dmg}`, '#ff6b6b', 22)
    playSfx('hit')
    this.pushHud()
    if (this.hero.isDead()) this.lose()
  }

  private onEnemyKilled(enemy: Enemy): void {
    this.gainEnergy(ENERGY_PER_KILL)
    this.spawnBurst(enemy.x, enemy.y - enemy.displayHeight * 0.5, 0xffe08a, 16)
    this.floatText(enemy.x, enemy.y - enemy.displayHeight, 'KO!', '#ffd23f', 24)
    playSfx('down')
    this.pushHud()
  }

  // ── BOSS 知识闸 + 答题结算 ───────────────────────────────────────────
  private maybeBossQuiz(): void {
    if (!this.boss || this.boss.dead || this.pending || this.frozen) return
    const now = this.time.now
    if (now < this.bossQuizCdUntil) return
    // BOSS 逼近主角（攻击距离内）时触发知识闸。
    const dist = Math.abs(this.boss.x - this.hero.x)
    if (dist > 180) return
    const def = this.bosses[this.level]
    const q = drawBySubject(def.subject, this.band, 1)[0] ?? drawQuestions({ band: this.band, count: 1 })[0]
    if (!q) return
    this.bossQuizCdUntil = now + 4000 // 答题闸冷却：两次知识闸之间留出战斗/喘息窗口（非常驻弹窗）
    this.openBossQuiz(q)
  }

  /** Boss 知识闸：用 React 卡片（更清晰的提示），但答完/超时即自动收起。 */
  private openBossQuiz(question: BattleQuestion): void {
    this.pending = { source: 'boss', question, resolved: false }
    this.clearMovementInput() // 弹窗即暂停：清移动栓锁，主角立刻停步（见 #23）
    this.hero.drive(0, true)
    this.bridge.emit('quiz:open', {
      question,
      source: 'boss',
      seconds: QUIZ_SECONDS,
      subjectLabel: subjectLabel(question.subject),
    })
    playSfx('tap')
    // 超时按答错处理。
    this.quizTimer?.remove()
    this.quizTimer = this.time.delayedCall(QUIZ_SECONDS * 1000, () => this.resolveQuiz(null))
    this.pushHud()
  }

  private resolveQuiz(choiceId: string | null): void {
    const p = this.pending
    if (!p || p.resolved) return
    // skill 飘题走 resolveSkillFromFloating；这里只处理 React 卡片（boss）。
    if (p.source === 'skill') return
    p.resolved = true
    this.quizTimer?.remove()
    this.quizTimer = undefined
    this.pending = null
    this.bridge.emit('quiz:close', undefined)

    const correct = choiceId != null && choiceId === p.question.answer
    this.resolveBossQuiz(correct)
    this.pushHud()
  }

  private resolveBossQuiz(correct: boolean): void {
    const boss = this.boss
    const def = this.bosses[this.level]
    if (!boss || boss.dead) return
    if (correct) {
      const res = boss.knowledgeHit(BOSS_KNOWLEDGE_DMG, this.hero.x)
      const color = subjectColor(def.subject)
      this.hitstop(120)
      this.slowmo(160, 0.45) // 重创老师：微慢镜
      this.cameras.main.shake(240, 0.011)
      this.cameras.main.flash(180, 180, 230, 255)
      // 纯视觉表达「答对→破防→可近战」：护盾碎裂爆 + BOSS 身上「可揍」高亮脉冲（替代啰嗦文字 #25）。
      this.shieldShatter(boss, color)
      this.meleeReadyPulse(boss)
      this.shockwave(boss.x, boss.y - boss.displayHeight * 0.5, color) // 答对按科目配色冲击波
      this.spawnBurst(boss.x, boss.y - boss.displayHeight * 0.6, color, 24)
      // 短促招式名战吼（保留），不再有「答对，知识重创老师」之类的教学句。
      const cry = skillCry(def.subject, this.band)
      if (cry) this.floatText(this.hero.x, this.hero.y - 170, cry, '#ffd23f', 24)
      playSfx('skill')
      playSfx('correct')
      if (res === 'dead') this.onBossDefeated()
    } else {
      // 答错：BOSS 反打主角。纯视觉（红闪 + 抖屏 + 老师吐槽气泡），不再有「答错了！被老师抓到」横幅。
      const hurt = this.hero.takeHit(BOSS_HIT_DMG, boss.x)
      this.cameras.main.shake(160, 0.008)
      this.cameras.main.flash(140, 255, 80, 80)
      const taunt = def.taunts[Phaser.Math.Between(0, def.taunts.length - 1)]
      this.floatText(boss.x, boss.y - boss.displayHeight - 10, `「${taunt}」`, '#ff9e6a', 20)
      playSfx('wrong')
      if (hurt && this.hero.isDead()) { this.lose(); return }
    }
    // 答题闸结束后给一段喘息：主角短无敌 + 把 BOSS 推开，避免一关掉就被连打。
    if (boss && !boss.dead) {
      this.hero.invulnUntil = Math.max(this.hero.invulnUntil, this.time.now + 900)
      const bb = boss.body as Phaser.Physics.Arcade.Body
      bb.setVelocity(this.facingFromHero(boss) * 200, -150)
    }
  }

  /** BOSS 相对主角在哪边（用于把它往远离主角的方向推）。 */
  private facingFromHero(e: Enemy): 1 | -1 {
    return e.x >= this.hero.x ? 1 : -1
  }

  private resolveSkillQuiz(correct: boolean, subject: string): void {
    if (correct) {
      this.energy = 0
      playSfx('correct')
      this.shockwave(this.hero.x, this.hero.y - this.hero.displayHeight * 0.5, subjectColor(subject))
      if (this.skill === 'heal') {
        // 回血：纯视觉（绿闪 + 主角染绿 + 短飘字 +2），无教学横幅。
        this.hero.heal(2)
        this.cameras.main.flash(200, 140, 255, 180)
        this.floatText(this.hero.x, this.hero.y - 160, '+2', '#7CFFB0', 28)
        playSfx('heal')
      } else {
        // nova：清屏 AoE（含对 BOSS 的知识重创）。保留一条【短促】大招横幅（无说明性长句），
        // 且由 ResultFlash 自动收起（#29）。
        this.castNova()
        this.bridge.emit('result', { ok: true, crit: true, title: '学霸大招·全屏清场!' })
      }
      const cry = battleCry('finish', this.band)
      if (cry) this.floatText(this.hero.x, this.hero.y - 200, cry, '#ffd23f', 26)
    } else {
      // 答错：大招哑火，扣一半能量。纯视觉（灰飘字 + 错误音），无教学横幅。
      this.energy = Math.max(0, this.energy - 0.5)
      this.floatText(this.hero.x, this.hero.y - 150, '大招哑火…', '#9aa6b2', 20)
      playSfx('wrong')
    }
  }

  private castNova(): void {
    this.cameras.main.flash(320, 255, 240, 160)
    this.cameras.main.shake(420, 0.016)
    this.slowmo(260, 0.35) // 大招定格般的微慢镜
    playSfx('nova')
    const cx = this.hero.x
    const cy = this.hero.y - this.hero.displayHeight * 0.5
    // 全屏 nova 爆发：双层扩张光环（外亮内白）。
    const ringA = this.add.circle(cx, cy, 20, 0xffe08a, 0.55).setDepth(80)
    ringA.setStrokeStyle(10, 0xfff3c0, 0.9)
    this.tweens.add({ targets: ringA, radius: this.W * 1.1, alpha: 0, duration: 560, ease: 'Cubic.easeOut', onComplete: () => ringA.destroy() })
    const ringB = this.add.circle(cx, cy, 10, 0xffffff, 0.0).setDepth(81)
    ringB.setStrokeStyle(6, 0xffffff, 0.95)
    this.tweens.add({ targets: ringB, radius: this.W * 0.7, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ringB.destroy() })
    // 满屏白闪（贴相机，瞬亮即收）。
    const flash = this.add.rectangle(this.cameras.main.scrollX + this.W / 2, this.H / 2, this.W, this.H, 0xffffff, 0.5)
      .setScrollFactor(0).setDepth(82)
    this.tweens.add({ targets: flash, alpha: 0, duration: 300, onComplete: () => flash.destroy() })
    // 放射火星。
    for (let i = 0; i < 22; i++) {
      const ang = (i / 22) * Math.PI * 2
      const spd = Phaser.Math.Between(220, 420)
      const p = this.add.circle(cx, cy, Phaser.Math.Between(4, 8), 0xffe08a, 1).setDepth(83)
      this.tweens.add({ targets: p, x: cx + Math.cos(ang) * spd, y: cy + Math.sin(ang) * spd, alpha: 0, scale: 0.2, duration: 540, ease: 'Quad.easeOut', onComplete: () => p.destroy() })
    }
    // 清掉屏上所有小怪，并对 BOSS 知识重创 2。
    ;(this.enemies.getChildren() as Enemy[]).slice().forEach((e) => {
      if (e.dead) return
      if (e.isBoss) {
        const res = e.knowledgeHit(2, this.hero.x)
        this.shieldShatter(e, 0x7cc0ff)
        this.floatText(e.x, e.y - e.displayHeight - 10, '-2!', '#7cc0ff', 24) // 伤害数字（短促），非教学句
        if (res === 'dead') this.onBossDefeated()
      } else {
        this.spawnBurst(e.x, e.y - e.displayHeight * 0.5, 0xffe08a, 12)
        e.knowledgeHit(99, this.hero.x)
        this.onEnemyKilled(e)
      }
    })
  }

  private onBossDefeated(): void {
    const def = this.bosses[this.level]
    playSfx('win')
    this.cameras.main.flash(400, 255, 240, 180)
    this.floatText(this.hero.x, this.hero.y - 180, `${def.name}：「${def.winLine}」`, '#7CFFB0', 22)
    this.boss = undefined
    // 存档：已通过本关。
    saveLevel(this.cfg.player, this.level + 1)
    // 下一关 or 通关。
    this.time.delayedCall(900, () => {
      if (this.level + 1 >= this.totalLevels) {
        this.win()
      } else {
        this.startLevel(this.level + 1)
      }
    })
  }

  // ── 胜负 ─────────────────────────────────────────────────────────────
  private win(): void {
    if (this.over) return
    this.over = true
    this.cleanupTransient()
    playSfx('win')
    this.bridge.emit('gameover', 'won')
  }

  private lose(): void {
    if (this.over) return
    this.over = true
    this.cleanupTransient()
    playSfx('lose')
    this.bridge.emit('gameover', 'lost')
  }

  /** 收尾：收起飘题、恢复时间缩放、关掉残留的答题卡片（避免胜负后还卡着）。 */
  private cleanupTransient(): void {
    this.floatingQuiz?.dismiss()
    this.floatingQuiz = undefined
    this.restoreTimeScale()
    this.slowmoUntil = 0
    if (this.pending) {
      this.pending = null
      this.quizTimer?.remove()
      this.quizTimer = undefined
      this.bridge.emit('quiz:close', undefined)
    }
  }

  private restartLevel(): void {
    // 用场景重启从当前关重开（init 会重置状态）。先恢复时间缩放，避免慢镜带进新局。
    this.cleanupTransient()
    this.scene.restart({ ...this.cfg, startLevel: this.level } as SceneConfig)
  }

  // ── juice 工具 ───────────────────────────────────────────────────────
  private hitstop(ms: number): void {
    this.frozenUntil = Math.max(this.frozenUntil, this.time.now + ms)
  }

  private gainEnergy(n: number): void {
    this.energy = Phaser.Math.Clamp(this.energy + n, 0, 1)
  }

  /**
   * 飘字（招式名/伤害数字/战吼）：先弹入上浮一小段，停住读一拍，再淡出。
   * 总时长 ~1.9s（pop 140 + hold 1200 + fade 560），比旧的 0.82s 长得多，看得清（#22）。
   */
  private floatText(x: number, y: number, text: string, color: string, size: number): void {
    const t = this.add.text(x, y, text, {
      fontSize: `${size}px`, color, fontStyle: 'bold',
      stroke: '#1b2030', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(95)
    // 弹入：快速上浮 + 轻微放大回弹（更醒目）。
    t.setScale(0.7)
    this.tweens.add({ targets: t, y: y - 28, scale: 1, duration: 140, ease: 'Back.easeOut' })
    // 停住读一拍后再上浮一点并淡出（hold → fade）。
    this.tweens.add({
      targets: t, y: y - 28 - 22, alpha: 0,
      delay: 140 + 1200, duration: 560, ease: 'Quad.easeIn',
      onComplete: () => t.destroy(),
    })
  }

  private spawnBurst(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.add.circle(x, y, Phaser.Math.Between(3, 6), color, 1).setDepth(94)
      const ang = Math.random() * Math.PI * 2
      const spd = Phaser.Math.Between(60, 200)
      this.tweens.add({
        targets: p,
        x: x + Math.cos(ang) * spd,
        y: y + Math.sin(ang) * spd,
        alpha: 0, scale: 0.2,
        duration: Phaser.Math.Between(300, 560),
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      })
    }
  }

  /**
   * 命中特效（按招式形状/配色，肉眼可辨这一击是哪招，#21）：
   *   · 巴掌 star：冲击星 + 四射火花线（脆）
   *   · 踹   ring：向前的冲击半环 + 直冲火花（猛）
   *   · 呸   wave：朝前的喷溅扇形点（毒舌/唾沫）
   * crit（收招）统一叠金色加大。
   */
  private moveImpact(x: number, y: number, move: MoveSpec, crit: boolean): void {
    const color = crit ? 0xffd23f : move.vfxColor
    const dir = this.hero.facing
    const big = crit ? 1.4 : 1
    if (move.vfxShape === 'star') {
      const star = this.add.star(x, y, crit ? 6 : 5, 6, (crit ? 22 : 16) * big, color, 0.95).setDepth(96)
      this.tweens.add({ targets: star, scale: crit ? 2.4 : 1.8, alpha: 0, angle: 60, duration: 220, ease: 'Quad.easeOut', onComplete: () => star.destroy() })
      for (let i = 0; i < (crit ? 6 : 4); i++) {
        const ang = (dir > 0 ? 0 : Math.PI) + Phaser.Math.FloatBetween(-0.6, 0.6)
        this.spark(x, y, ang, color)
      }
    } else if (move.vfxShape === 'ring') {
      // 冲击环（朝命中点放大的圆环，给「踹」一记厚重的撞击感）。
      const ring = this.add.circle(x, y, 8, color, 0.0).setDepth(96)
      ring.setStrokeStyle(crit ? 8 : 6, color, 0.95)
      this.tweens.add({ targets: ring, radius: (crit ? 64 : 46) * big, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() })
      // 直冲火花（集中朝前，体现踹的方向性）。
      for (let i = 0; i < (crit ? 7 : 5); i++) {
        const ang = (dir > 0 ? 0 : Math.PI) + Phaser.Math.FloatBetween(-0.25, 0.25)
        this.spark(x, y, ang, color)
      }
    } else {
      // 喷溅扇形（朝前张开的一束小点，给「呸」唾沫/毒舌的感觉）。
      for (let i = 0; i < (crit ? 14 : 10); i++) {
        const ang = (dir > 0 ? 0 : Math.PI) + Phaser.Math.FloatBetween(-0.5, 0.5)
        const spd = Phaser.Math.Between(120, 260) * big
        const p = this.add.circle(x, y, Phaser.Math.Between(3, 6), color, 1).setDepth(96)
        this.tweens.add({ targets: p, x: x + Math.cos(ang) * spd, y: y + Math.sin(ang) * spd - 20, alpha: 0, scale: 0.2, duration: 360, ease: 'Quad.easeOut', onComplete: () => p.destroy() })
      }
    }
  }

  /** 一条向某方向飞的火花线（命中特效用）。 */
  private spark(x: number, y: number, ang: number, color: number): void {
    const len = Phaser.Math.Between(18, 34)
    const spark = this.add.rectangle(x, y, len, 3, color, 1).setDepth(96).setRotation(ang)
    const spd = Phaser.Math.Between(120, 240)
    this.tweens.add({ targets: spark, x: x + Math.cos(ang) * spd, y: y + Math.sin(ang) * spd, alpha: 0, duration: 240, ease: 'Quad.easeOut', onComplete: () => spark.destroy() })
  }

  /** 连击发光：连击越高，主角身上的光晕越亮越大（逐级升）。 */
  private comboGlow(): void {
    if (this.combo < 2) return
    const tier = Math.min(this.combo, 12)
    const color = this.combo >= 9 ? 0xff5a8a : this.combo >= 5 ? 0xffd23f : 0x9fe0ff
    const glow = this.add.circle(this.hero.x, this.hero.y - this.hero.displayHeight * 0.5, 24 + tier * 4, color, 0.5).setDepth(48)
    this.tweens.add({ targets: glow, scale: 1.8, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => glow.destroy() })
  }

  /** 答对冲击波：按科目配色的扩张光环（短促有力）。 */
  private shockwave(x: number, y: number, color: number): void {
    const ring = this.add.circle(x, y, 16, color, 0.0).setDepth(82)
    ring.setStrokeStyle(8, color, 0.85)
    this.tweens.add({ targets: ring, radius: 260, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() })
  }

  /**
   * 护盾碎裂爆（纯视觉替代「护盾破了」文字 #25）：答对重创老师时，
   * 护盾光环猛地撑大碎掉，向四周崩出一圈玻璃碎片（短弧线 + 火花）。
   */
  private shieldShatter(boss: Enemy, color: number): void {
    const cx = boss.x
    const cy = boss.y - boss.displayHeight * 0.5
    const r0 = boss.displayHeight * 0.55
    // 护盾撑爆环。
    const ring = this.add.circle(cx, cy, r0, 0xffffff, 0.0).setDepth(83)
    ring.setStrokeStyle(5, color, 0.9)
    this.tweens.add({ targets: ring, radius: r0 * 1.6, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() })
    // 碎片（短弧片向外崩飞 + 自转淡出）。
    const shards = 12
    for (let i = 0; i < shards; i++) {
      const ang = (i / shards) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2)
      const sx = cx + Math.cos(ang) * r0
      const sy = cy + Math.sin(ang) * r0
      const shard = this.add.rectangle(sx, sy, Phaser.Math.Between(6, 12), 3, color, 0.95).setDepth(96).setRotation(ang)
      const spd = Phaser.Math.Between(120, 240)
      this.tweens.add({
        targets: shard,
        x: sx + Math.cos(ang) * spd, y: sy + Math.sin(ang) * spd,
        angle: Phaser.Math.Between(-180, 180), alpha: 0,
        duration: 360, ease: 'Quad.easeOut', onComplete: () => shard.destroy(),
      })
    }
  }

  /**
   * 「可近战」高亮脉冲（纯视觉替代「快用普攻」文字 #25）：BOSS 被破防后，
   * 脚下涌起两道金色脉冲环，暗示「现在能上去揍它」。
   * （不动 BOSS 的 tint：受击红闪已由 Enemy.applyDamage 负责，避免互相覆盖。）
   */
  private meleeReadyPulse(boss: Enemy): void {
    const cy = boss.y - boss.displayHeight * 0.5
    for (let i = 0; i < 2; i++) {
      this.time.delayedCall(i * 130, () => {
        if (boss.dead) return
        const pulse = this.add.circle(boss.x, cy, boss.displayHeight * 0.3, 0xffd23f, 0.0).setDepth(46)
        pulse.setStrokeStyle(4, 0xffe08a, 0.9)
        this.tweens.add({ targets: pulse, radius: boss.displayHeight * 0.8, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => pulse.destroy() })
      })
    }
  }

  /** 微慢镜：把物理/动画时间缩放压低一小段后自动恢复（大招/重击的「定格感」）。 */
  private slowmo(ms: number, scale: number): void {
    this.slowmoUntil = Math.max(this.slowmoUntil, this.time.now + ms)
    this.time.timeScale = scale
    this.physics.world.timeScale = 1 / scale // arcade 的 timeScale 是倒数语义（越大越慢）
    this.tweens.timeScale = scale
    this.anims.globalTimeScale = scale
  }

  private restoreTimeScale(): void {
    this.time.timeScale = 1
    this.physics.world.timeScale = 1
    this.tweens.timeScale = 1
    this.anims.globalTimeScale = 1
  }

  // ── HUD 推送 ─────────────────────────────────────────────────────────
  private pushHud(): void {
    const alive = (this.enemies.getChildren() as Enemy[]).filter((e) => !e.dead).length
    const remaining = alive + this.pendingSpawns // 含还在排队入场的
    const isBossWave = this.waveDefs[this.waveIndex] === -1
    const hud: HudState = {
      hp: this.hero.hp,
      maxHp: this.hero.maxHp,
      level: this.level + 1,
      totalLevels: this.totalLevels,
      waveIndex: this.waveIndex + 1,
      waveTotal: this.waveTotal,
      waveRemaining: remaining,
      isBossWave,
      bossHp: this.boss && !this.boss.dead ? this.boss.hp : 0,
      bossMaxHp: this.boss ? this.boss.maxHp : 0,
      bossName: this.boss ? this.boss.enemyName : '',
      energy: this.energy,
      combo: this.combo,
      skill: this.skill,
      muted: isMuted(),
      biome: this.theme?.name ?? '',
    }
    this.bridge.emit('hud', hud)
  }

  private onResize(): void {
    const w = this.scale.width
    const h = this.scale.height
    // Scale.RESIZE 模式会在尺寸「其实没变」时也反复派发 resize；尺寸没变就直接返回，
    // 否则每次都重画背景（重铺天空/天气）→ 背景一直在抖。只有真变化才重铺。
    if (w === this.W && h === this.H) return
    this.W = w
    this.H = h
    this.cameras.main.setDeadzone(this.W * 0.3, this.H)
    // 天空层与天气按新视口重铺（地面线 groundY 不随窗口高变，保持世界一致）。
    this.drawBackground()
    this.setupWeather()
  }

  // ── 主循环 ───────────────────────────────────────────────────────────
  update(_time: number, delta: number): void {
    if (this.over) return
    const dt = delta / 1000
    this.updateWeather(dt)

    // 微慢镜到时恢复。
    if (this.slowmoUntil && this.time.now >= this.slowmoUntil) {
      this.slowmoUntil = 0
      this.restoreTimeScale()
    }

    // 学霸大招飘题跟随主角头顶。
    if (this.floatingQuiz && !this.floatingQuiz.isResolved) {
      const qx = Phaser.Math.Clamp(this.hero.x, this.cameras.main.scrollX + 200, this.cameras.main.scrollX + this.W - 200)
      this.floatingQuiz.follow(qx, this.hero.y - this.hero.displayHeight - 70)
    }

    const frozen = this.frozen

    // 主角移动意图：键盘（A/D/←/→）叠加触屏。
    let dir: MoveDir = this.touchDir
    if (!frozen) {
      const left = this.cursors.left.isDown || this.keys.A.isDown
      const right = this.cursors.right.isDown || this.keys.D.isDown
      if (left && !right) dir = -1
      else if (right && !left) dir = 1
      else if (this.touchDir !== 0) dir = this.touchDir
    } else {
      dir = 0
    }
    this.hero.drive(dir, frozen)

    // 敌人 AI。限制「同时围攻人数」：场上正在 lunge 的 + 本帧新批准的 ≤ MAX_ATTACKERS，
    // 避免一拥而上把主角秒掉（围而不上更像真打架，也更可玩）。
    const now = this.time.now
    const list = this.enemies.getChildren() as Enemy[]
    const MAX_ATTACKERS = 2
    let attacking = list.filter((e) => !e.dead && e.isLunging(now)).length
    // 离主角近的先获得攻击名额。
    const sorted = list
      .filter((e) => !e.dead)
      .sort((a, b) => Math.abs(a.x - this.hero.x) - Math.abs(b.x - this.hero.x))
    for (const e of sorted) {
      const may = attacking < MAX_ATTACKERS
      e.think(this.hero.x, now, frozen, may)
      // 若这帧它真的发起了 lunge，占一个名额。
      if (may && e.isLunging(now)) attacking++
    }

    // BOSS 知识闸（逼近触发）。
    this.maybeBossQuiz()

    // 波次推进：当前波清空 → 下一波。
    this.checkWaveCleared()

    // 节流推 HUD（每 ~150ms 一次），让剩余人数/能量/BOSS 血实时但不过频。
    if (this.time.now >= this.hudThrottleAt) {
      this.hudThrottleAt = this.time.now + 150
      this.pushHud()
    }
  }

  private checkWaveCleared(): void {
    if (!this.waveActive || this.pending || this.over) return
    if (this.pendingSpawns > 0) return // 本波还有敌人在排队入场，不算清波
    const alive = (this.enemies.getChildren() as Enemy[]).filter((e) => !e.dead).length
    if (alive > 0) return
    // 当前波已清。
    this.waveActive = false
    if (this.waveDefs[this.waveIndex] === -1) {
      // BOSS 波清空但 BOSS 未死不会到这（boss 在 enemies 里）；BOSS 死走 onBossDefeated。
      return
    }
    // 还有下一波。
    if (this.waveIndex + 1 < this.waveTotal) {
      this.waveIndex += 1
      const next = this.waveDefs[this.waveIndex]
      this.floatText(this.hero.x, this.hero.y - 170, next === -1 ? '关底·老师来了!' : `第 ${this.waveIndex + 1} 波!`, '#ffe08a', 24)
      this.time.delayedCall(700, () => this.spawnCurrentWave())
      this.pushHud()
    }
  }
}
