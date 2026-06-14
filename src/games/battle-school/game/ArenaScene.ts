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
import { preloadSprites, registerAnims, pickClassmateKey, TEACHER_KEY } from './assets'
import { Hero } from './Hero'
import { Enemy } from './Enemy'
import { themeForLevel, type Theme } from './themes'

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
  private pending: Pending | null = null // 当前挂起的答题
  private quizTimer?: Phaser.Time.TimerEvent
  private bossQuizCdUntil = 0 // BOSS 答题闸冷却（避免连弹）
  private frozenUntil = 0 // hitstop：全局冻结到此刻
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
    this.totalLevels = roster.bosses.length
    this.level = Phaser.Math.Clamp(cfg.startLevel, 0, this.totalLevels - 1)
    // 重置每局状态（场景可能被 restart 复用）。
    this.over = false
    this.pending = null
    this.energy = 0
    this.combo = 0
    this.skill = 'nova'
    this.boss = undefined
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

    // 主角。
    this.hero = new Hero(this, 200, this.groundY)
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
        const star = this.add.circle(Math.random() * WORLD_W, Math.random() * this.H * 0.6, Math.random() * 1.6 + 0.6, 0xffffff, 0.9)
        star.setScrollFactor(0.2)
        this.bgFar.add(star)
      }
      const moon = this.add.circle(this.W * 0.78, this.H * 0.2, 34, 0xfdf6c9, 1).setScrollFactor(0.2)
      this.bgFar.add(moon)
    }
    // 云/雾。
    if (t.cloud) {
      for (let i = 0; i < 7; i++) {
        const cx = Math.random() * WORLD_W
        const cy = this.H * (0.1 + Math.random() * 0.28)
        const cloud = this.add.ellipse(cx, cy, 120 + Math.random() * 120, 44 + Math.random() * 30, t.cloud, 0.55)
        cloud.setScrollFactor(0.35)
        this.bgFar.add(cloud)
      }
    }
    // 远景剪影（按地形铺一排）。
    const horizon = this.groundY
    for (let x = -100; x < WORLD_W + 100; x += 220) {
      const far = this.drawDeco(x + Math.random() * 80, horizon, t.decoFar, 0.7, t)
      far.setScrollFactor(0.5)
      this.bgFar.add(far)
    }
    // 近景装饰（更大、更靠下、视差更快）。
    for (let x = 0; x < WORLD_W; x += 360) {
      const near = this.drawDeco(x + Math.random() * 120, horizon, t.decoNear, 1.15, t)
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
    const e = new Enemy(this, x, this.groundY, { charKey: TEACHER_KEY, name: def.name, isBoss: true, hp: def.hp, speed: 70 })
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
    if (this.hero.startAttack()) playSfx('punch')
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
    // 大招要先答一道随机学科题（学霸大招）。
    const q = drawQuestions({ band: this.band, count: 1, learnRatio: 1 })[0]
    if (!q) {
      this.floatText(this.hero.x, this.hero.y - 150, '题库加载中…', '#9aa6b2', 18)
      return
    }
    this.openQuiz('skill', q)
  }

  // ── 近战命中（主角命中区 vs 敌人）──────────────────────────────────────
  private onMeleeOverlap(enemy: Enemy): void {
    if (!this.hero.swingActive || enemy.dead) return
    if (this.hero.hitThisSwing.has(enemy)) return
    this.hero.hitThisSwing.add(enemy)

    const result = enemy.meleeHit(HERO_MELEE_DMG, this.hero.x)
    if (result === 'immune') {
      this.floatText(enemy.x, enemy.y - enemy.displayHeight - 10, '学霸护盾·免疫!', '#7cc0ff', 18)
      this.hitstop(40)
      this.cameras.main.shake(80, 0.003)
      playSfx('hit')
      return
    }
    // 命中表演：hitstop + 抖屏 + 伤害数字 + 冒星。
    this.combo += 1
    const crit = this.combo > 0 && this.combo % 3 === 0
    this.gainEnergy(ENERGY_PER_HIT)
    this.hitstop(crit ? 90 : 55)
    this.cameras.main.shake(crit ? 160 : 90, crit ? 0.008 : 0.004)
    this.floatText(enemy.x, enemy.y - enemy.displayHeight - 6, crit ? `暴击 ${HERO_MELEE_DMG * 2}!` : `-${HERO_MELEE_DMG}`, crit ? '#ffd23f' : '#ffffff', crit ? 26 : 20)
    this.spawnBurst(enemy.x, enemy.y - enemy.displayHeight * 0.6, crit ? 0xffd23f : 0xffffff, crit ? 14 : 8)
    playSfx(crit ? 'crit' : 'hit')
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
    this.openQuiz('boss', q)
  }

  private openQuiz(source: 'boss' | 'skill', question: BattleQuestion): void {
    this.pending = { source, question, resolved: false }
    this.bridge.emit('quiz:open', {
      question,
      source,
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
    p.resolved = true
    this.quizTimer?.remove()
    this.quizTimer = undefined
    this.pending = null
    this.bridge.emit('quiz:close', undefined)

    const correct = choiceId != null && choiceId === p.question.answer
    if (p.source === 'boss') this.resolveBossQuiz(correct)
    else this.resolveSkillQuiz(correct)
    this.pushHud()
  }

  private resolveBossQuiz(correct: boolean): void {
    const boss = this.boss
    const def = this.bosses[this.level]
    if (!boss || boss.dead) return
    if (correct) {
      const res = boss.knowledgeHit(BOSS_KNOWLEDGE_DMG, this.hero.x)
      this.hitstop(110)
      this.cameras.main.shake(220, 0.01)
      this.cameras.main.flash(180, 180, 230, 255)
      this.spawnBurst(boss.x, boss.y - boss.displayHeight * 0.6, 0x7cc0ff, 22)
      this.floatText(boss.x, boss.y - boss.displayHeight - 10, `知识·重创 -${BOSS_KNOWLEDGE_DMG}!`, '#7cc0ff', 24)
      const cry = skillCry(def.subject, this.band)
      if (cry) this.floatText(this.hero.x, this.hero.y - 170, cry, '#ffd23f', 24)
      playSfx('skill')
      this.bridge.emit('result', { ok: true, crit: true, title: '答对！知识重创老师', detail: cry ?? undefined })
      if (res === 'dead') this.onBossDefeated()
    } else {
      // 答错：BOSS 反打主角。
      const hurt = this.hero.takeHit(BOSS_HIT_DMG, boss.x)
      this.cameras.main.shake(160, 0.008)
      this.cameras.main.flash(140, 255, 80, 80)
      const taunt = def.taunts[Phaser.Math.Between(0, def.taunts.length - 1)]
      this.floatText(boss.x, boss.y - boss.displayHeight - 10, `「${taunt}」`, '#ff9e6a', 20)
      playSfx('wrong')
      this.bridge.emit('result', { ok: false, crit: false, title: '答错了！被老师抓到', detail: taunt })
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

  private resolveSkillQuiz(correct: boolean): void {
    if (correct) {
      this.energy = 0
      if (this.skill === 'heal') {
        this.hero.heal(2)
        this.cameras.main.flash(200, 140, 255, 180)
        this.floatText(this.hero.x, this.hero.y - 160, '学霸回血 +2', '#7CFFB0', 24)
        playSfx('heal')
        this.bridge.emit('result', { ok: true, crit: false, title: '答对！学霸回血', detail: '体力恢复' })
      } else {
        // nova：清屏 AoE（含对 BOSS 的知识重创）。
        this.castNova()
        this.bridge.emit('result', { ok: true, crit: true, title: '学霸大招·全屏清场!', detail: '同学全倒，老师受创' })
      }
      const cry = battleCry('finish', this.band)
      if (cry) this.floatText(this.hero.x, this.hero.y - 200, cry, '#ffd23f', 26)
    } else {
      // 答错：大招哑火，扣一半能量。
      this.energy = Math.max(0, this.energy - 0.5)
      this.floatText(this.hero.x, this.hero.y - 150, '大招哑火…', '#9aa6b2', 20)
      playSfx('wrong')
      this.bridge.emit('result', { ok: false, crit: false, title: '答错了，大招没放出来', detail: '能量减半' })
    }
  }

  private castNova(): void {
    this.cameras.main.flash(300, 255, 240, 160)
    this.cameras.main.shake(360, 0.014)
    playSfx('nova')
    // 全屏冲击波。
    const ring = this.add.circle(this.hero.x, this.hero.y - 60, 20, 0xffe08a, 0.5).setDepth(80)
    this.tweens.add({ targets: ring, radius: this.W, alpha: 0, duration: 520, onComplete: () => ring.destroy() })
    // 清掉屏上所有小怪，并对 BOSS 知识重创 2。
    ;(this.enemies.getChildren() as Enemy[]).slice().forEach((e) => {
      if (e.dead) return
      if (e.isBoss) {
        const res = e.knowledgeHit(2, this.hero.x)
        this.floatText(e.x, e.y - e.displayHeight - 10, '知识·重创 -2!', '#7cc0ff', 22)
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
    playSfx('win')
    this.bridge.emit('gameover', 'won')
  }

  private lose(): void {
    if (this.over) return
    this.over = true
    playSfx('lose')
    this.bridge.emit('gameover', 'lost')
  }

  private restartLevel(): void {
    // 用场景重启从当前关重开（init 会重置状态）。
    this.scene.restart({ ...this.cfg, startLevel: this.level } as SceneConfig)
  }

  // ── juice 工具 ───────────────────────────────────────────────────────
  private hitstop(ms: number): void {
    this.frozenUntil = Math.max(this.frozenUntil, this.time.now + ms)
  }

  private gainEnergy(n: number): void {
    this.energy = Phaser.Math.Clamp(this.energy + n, 0, 1)
  }

  private floatText(x: number, y: number, text: string, color: string, size: number): void {
    const t = this.add.text(x, y, text, {
      fontSize: `${size}px`, color, fontStyle: 'bold',
      stroke: '#1b2030', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(95)
    this.tweens.add({ targets: t, y: y - 56, alpha: 0, duration: 820, ease: 'Quad.easeOut', onComplete: () => t.destroy() })
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
    this.W = this.scale.width
    this.H = this.scale.height
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
