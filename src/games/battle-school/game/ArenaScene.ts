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
import { Hero, HERO_MAX_HP, COMBO_MOVES, type MoveSpec } from './Hero'
import { Enemy } from './Enemy'
import { FloatingQuiz } from './FloatingQuiz'
import { themeForLevel, type Theme } from './themes'
import { makeRng } from './rng'
import { movesForBoss, MOVE_POOL, type TeacherMove } from './bossMoves'
import { STAGES } from './stage/stages'
import { resolveStage } from './stage/randomize'
import type { ResolvedStage } from './stage/StageDef'
import { buildPlatform, buildPipe, Pit, QBlockState, TrapState, stompResult } from './stage/entities'

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

// 关卡用横版长地图：世界宽由当前关蓝图（STAGES）决定（~13000px）。
// 这个常量是「兜底/相机初值」，create 后会被 this.worldW（= 关蓝图 worldW）覆盖。
const GROUND_RATIO = 0.82 // 地面线在视口高度的占比
const HERO_MELEE_DMG = 1
const MOB_HIT_DMG = 1 // 小怪打主角的伤害
const BOSS_HIT_DMG = 1
const BOSS_KNOWLEDGE_DMG = 1 // 破盾窗口内一次近战扣 BOSS 1 血（答题只负责破盾，伤害靠揍）
const PIT_FALL_DMG = 1 // 掉坑扣血（非死，回到最近安全点）
const SHIELD_BREAK_MS = 4500 // 答对题后 BOSS 护盾落下、可被近战的窗口
const ENERGY_PER_KILL = 0.34 // 每杀一个小怪涨多少能量
const ENERGY_PER_HIT = 0.08 // 每命中一次涨多少
const ENERGY_PER_COIN = 0.18 // ?块金币涨能量
const ENERGY_PER_QENERGY = 0.4 // ?块能量块涨能量
const QUIZ_SECONDS = 15
const MAX_WEATHER = 80 // 天气粒子上限

// 答题来源：boss=破盾知识闸 / skill=学霸大招 / rollcall=老师「我点名了」主动招（答错挨罚）。
type Pending = { source: 'boss' | 'skill' | 'rollcall'; question: BattleQuestion; resolved: boolean; dmg?: number }

// #28 老师主动招：已实现结算的效果类型（未列入的先不入选，避免空招）。
// v1：ground-shock/projectile/cone/aoe-drop/root；v2 增 forced-quiz/disable-skill/gaze-stun/enrage。
// （damage-down「最差的一届」暂缓：近战仅 1 点，整数砍半无意义。）
const BOSS_MOVE_IMPL: ReadonlySet<TeacherMove['effect']> = new Set([
  'ground-shock', // 拍桌子（跳起躲）
  'projectile', // 粉笔头（走位躲）
  'cone', // 唾沫横飞 / 罚跑十圈（走位躲）
  'aoe-drop', // 作业山 / 危险实验（走开落点）
  'root', // 出来罚站 / 全文背诵（狂点挣脱）
  'forced-quiz', // 我点名了 / 随堂测验 / 听写单词（答对免罚，答错/超时挨罚）
  'disable-skill', // 没收（暂封大招）
  'gaze-stun', // 眼神杀（短定身，预警时走出视线锥可躲）
  'enrage', // 拖堂（老师自我狂暴：出招更密 + 红色杀气）
])

type BossPhase = 'idle' | 'telegraph' | 'active' | 'recover'
type BossProjectile = { obj: Phaser.GameObjects.Arc; vx: number; dieAt: number; hit: boolean; dmg: number }

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
  private worldW = 13000 // 当前关世界宽（由关蓝图 worldW 决定，create/startLevel 时赋值）
  private lastViewW = 0 // onResize 防抖：上次重画时的视口宽（不变则早退，避免背景抖动）
  private lastViewH = 0

  private hero!: Hero
  private enemies!: Phaser.Physics.Arcade.Group
  private platforms!: Phaser.Physics.Arcade.StaticGroup

  // ── 横版长地图（确定性关卡：同 seed 同布局；联机将来用共享 seed）──────────
  private runSeed = 0 // 本局随机种子（场景启动时生成一次）
  private stage!: ResolvedStage // 当前关解析后的地形
  private pits: Pit[] = [] // 真坑（掉落扣血回位）
  private qBlocks: QBlockState[] = [] // ?块（顶一下出奖励）
  private traps: TrapState[] = [] // 伪装陷阱（踩中触发一次）
  private pendingSpawnSlots: { atX: number; count: number }[] = [] // 还没触发的沿路刷怪点
  private lastSafeX = 220 // 掉坑后回到的最近安全 x（脚踏实地时更新）
  private bossSpawned = false // 关底 Boss 是否已生成（推进到 flagX 附近触发）

  // 输入
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private touchDir: MoveDir = 0 // 触屏方向意图（叠加键盘）
  // 移动方向走 window 级 DOM 事件（capture 阶段）追踪：React 弹窗抢焦点时也能收到 keyup，
  // 按住的键不丢、松开必清——不再用 Phaser isDown/Key.reset()（reset 会把按住的键清成松开，
  // 导致「按反方向无反应、必须重按原方向」#23）。
  private heldLeft = false
  private heldRight = false
  private domKeyDown?: (e: KeyboardEvent) => void
  private domKeyUp?: (e: KeyboardEvent) => void
  private domBlur?: () => void

  // 局面状态（场景持有，唯一事实来源）
  private level = 0 // 0-based
  private energy = 0
  private combo = 0
  private skill: SkillKind = 'nova'
  private theme!: Theme
  private boss?: Enemy
  private pending: Pending | null = null // 当前挂起的答题（boss=React 卡片 / skill=Phaser 飘题）
  private floatingQuiz?: FloatingQuiz // 学霸大招的轻量飘浮快题（Phaser 原生）
  private quizTimer?: Phaser.Time.TimerEvent
  private bossQuizCdUntil = 0 // BOSS 答题闸冷却（避免连弹）
  // ── #28 老师主动攻击状态机 ──────────────────────────────────────────
  private bossMoveSet: TeacherMove[] = [] // 本 Boss 招式组（spawnBoss 时种子化选定）
  private bossPhase: BossPhase = 'idle'
  private bossMove?: TeacherMove // 当前招
  private bossMoveIdx = 0 // 轮转下标
  private bossPhaseUntil = 0 // 当前阶段截止时刻
  private bossNextMoveAt = 0 // 下次可发招时刻（冷却闸）
  private bossMoveObjs: Phaser.GameObjects.GameObject[] = [] // 当前招的预警视觉（收招/清场销毁）
  private bossProjectiles: BossProjectile[] = [] // 在飞的粉笔头
  private bossDropXs: number[] = [] // 作业山落点（telegraph 锁定）
  private bossLockX = 0 // 罚站锁定的主角 x（telegraph 时）
  private heroRootedUntil = 0 // 罚站：主角被钉到此刻（狂点可缩短）
  private heroRootRing?: Phaser.GameObjects.Arc // 罚站视觉环
  private heroStunUntil = 0 // 眼神杀：主角被定身到此刻（不可挣脱，短时自动解除）
  private heroSkillDisabledUntil = 0 // 没收：大招被封到此刻
  private bossEnrageUntil = 0 // 拖堂：老师狂暴（出招更密 + 红色杀气）到此刻
  private bossEnrageTinted = false // 拖堂红 tint 当前是否挂着（到点恢复一次）
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
    this.bossSpawned = false
    this.pendingSpawnSlots = []
    this.pits = []
    this.qBlocks = []
    this.traps = []
    // 本局随机种子（生成一次）。Date.now 即可——同一局所有关用它 + level 偏移派生，
    // 保证一局内地形确定；将来联机只需两端用「共享 seed」替换这里即可两端布局一致。
    this.runSeed = Date.now() >>> 0
  }

  preload(): void {
    preloadSprites(this.load)
    this.load.on('progress', (p: number) => this.bridge.emit('loading', p))
  }

  create(): void {
    registerAnims(this.anims)
    this.W = this.scale.width
    this.H = this.scale.height
    this.lastViewW = this.W
    this.lastViewH = this.H
    this.physics.world.gravity.y = 1800

    this.bgSky = this.add.graphics().setScrollFactor(0).setDepth(0)
    this.bgFar = this.add.container(0, 0).setDepth(1)
    this.bgNear = this.add.container(0, 0).setDepth(2)

    // 解析当前关地形（确定性：seed + level）→ 拿到 worldW 后再铺世界/相机/物理边界。
    this.resolveCurrentStage()

    // 地面与平台。
    this.platforms = this.physics.add.staticGroup()
    this.buildLevelWorld()

    // 主角出生在近端 heroStartX，头顶挂玩家名，按性别选精灵（女=herog / 男=hero）。
    this.hero = new Hero(this, this.stage.heroStartX, this.groundY, this.playerName, pickHeroKey(this.cfg.player, this.playerName))
    this.lastSafeX = this.stage.heroStartX
    this.physics.add.collider(this.hero, this.platforms)

    // 敌人组。
    this.enemies = this.physics.add.group({ runChildUpdate: false })
    this.physics.add.collider(this.enemies, this.platforms)

    // 主角攻击命中区 vs 敌人。
    this.physics.add.overlap(this.hero.hitbox, this.enemies, (_hb, e) => this.onMeleeOverlap(e as Enemy))
    // 敌人 lunge 接触主角 → 敌人打主角（含踩怪判定）。
    this.physics.add.overlap(this.hero, this.enemies, (_h, e) => this.onEnemyTouch(e as Enemy))

    // 相机跟随主角，限制在世界内（铺满长地图全宽）。
    this.cameras.main.setBounds(0, 0, this.worldW, this.H)
    this.cameras.main.startFollow(this.hero, true, 0.1, 0.1, -this.W * 0.18, this.groundY - this.H * 0.62)
    this.cameras.main.setDeadzone(this.W * 0.3, this.H)

    this.setupInput()
    this.exposeControls()

    // 开关。
    this.startLevel(this.level)
    this.bridge.emit('ready', undefined)
    this.pushHud()

    // 自适应：窗口变化时重排地面/背景。
    this.scale.on('resize', this.onResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize, this)
      if (this.domKeyDown) window.removeEventListener('keydown', this.domKeyDown, true)
      if (this.domKeyUp) window.removeEventListener('keyup', this.domKeyUp, true)
      if (this.domBlur) window.removeEventListener('blur', this.domBlur)
    })
  }

  // ── 世界/场景 ───────────────────────────────────────────────────────
  /** 解析当前关地形（确定性）：从 STAGES 取一关，用 seed+level 派生的 Rng 落定坐标。 */
  private resolveCurrentStage(): void {
    const def = STAGES[this.level % STAGES.length]
    // 同一局内每关用 (runSeed + level) 派生独立 Rng；同 seed 同布局（联机用共享 seed 即可一致）。
    const resolved = resolveStage(def, makeRng((this.runSeed + this.level * 0x9e3779b1) >>> 0))
    this.stage = resolved
    this.worldW = resolved.worldW
  }

  /** 建一关世界（地面碰撞体 + 背景 + 地形物件：平台/管道/?块/坑/陷阱）。 */
  private buildLevelWorld(): void {
    this.theme = themeForLevel(this.level)
    this.groundY = Math.round(this.H * GROUND_RATIO)
    this.physics.world.setBounds(0, 0, this.worldW, this.H + 400) // 高度留余地：掉坑能短暂落到地下再回位
    this.drawBackground()
    this.buildTerrain()
    this.setupWeather()
  }

  /** 铺地形：分段地面（坑处断开）+ 平台/管道/?块/坑/陷阱的碰撞体与触发器。 */
  private buildTerrain(): void {
    this.platforms.clear(true, true)
    this.pits = []
    this.qBlocks = []
    this.traps = []
    const s = this.stage

    // 真坑：这些 x 段不铺地面（掉下去触发 onFall）。非真坑当装饰、地面照铺。
    const realPits = s.pits.filter((p) => p.real)
    // 把世界宽按真坑切成若干「实心地面段」，逐段铺不可见地面碰撞体。
    const cuts = realPits
      .map((p) => ({ from: p.x, to: p.x + p.w }))
      .sort((a, b) => a.from - b.from)
    let cursor = 0
    for (const cut of cuts) {
      if (cut.from > cursor) this.addGroundSegment(cursor, cut.from)
      cursor = Math.max(cursor, cut.to)
    }
    if (cursor < this.worldW) this.addGroundSegment(cursor, this.worldW)

    // 坑的视觉/落坑判定对象（真坑参与 onFall，非真坑仅视觉）。
    for (const p of s.pits) this.pits.push(new Pit(this, p, this.groundY))

    // 浮空平台（主角与敌人共用的碰撞体）。
    for (const p of s.platforms) {
      buildPlatform(this, this.platforms, p, this.groundY, this.theme.ground, this.theme.groundLine)
    }
    // 管道（实心障碍）。
    for (const p of s.pipes) buildPipe(this, this.platforms, p, this.groundY)
    // ?块（顶一下出奖励）。
    for (const q of s.qBlocks) this.qBlocks.push(new QBlockState(this, this.platforms, q, this.groundY))
    // 伪装陷阱（踩中触发一次）。
    for (const t of s.traps) this.traps.push(new TrapState(this, t, this.groundY))
  }

  /** 在 [from,to] 这段铺一条不可见地面碰撞体（脚踏实地处；坑处不铺）。 */
  private addGroundSegment(from: number, to: number): void {
    const w = to - from
    if (w <= 0) return
    const ground = this.add.rectangle(from + w / 2, this.groundY + 40, w, 80, 0x000000, 0)
    this.platforms.add(ground)
    ;(ground.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject()
  }

  /** 重画背景（幂等：清空两层容器 + 天空层后重绘当前 theme）。装饰用确定性随机（同关同布局，重画不抖）。 */
  private drawBackground(): void {
    this.bgFar.removeAll(true)
    this.bgNear.removeAll(true)
    this.bgSky.clear()
    const t = this.theme
    // 背景装饰用确定性随机源（seed+level，固定偏移），保证 onResize 重画时布局一致、不抖动
    // （修复「背景所有元素无规律地动」）。W=本关世界宽（长地图按 worldW 全宽铺）。
    const bg = makeRng((this.runSeed + this.level * 0x85ebca6b + 0x27d4eb2f) >>> 0)
    const W = this.worldW
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
      for (let i = 0; i < 90; i++) {
        const star = this.add.circle(bg.float(0, W), bg.float(0, this.H * 0.6), bg.float(0.6, 2.2), 0xffffff, 0.9)
        star.setScrollFactor(0.2)
        this.bgFar.add(star)
      }
      const moon = this.add.circle(this.W * 0.78, this.H * 0.2, 34, 0xfdf6c9, 1).setScrollFactor(0.2)
      this.bgFar.add(moon)
    }
    // 云/雾。
    if (t.cloud) {
      for (let i = 0; i < 24; i++) {
        const cx = bg.float(0, W)
        const cy = this.H * (0.1 + bg.float(0, 0.28))
        const cloud = this.add.ellipse(cx, cy, 120 + bg.float(0, 120), 44 + bg.float(0, 30), t.cloud, 0.55)
        cloud.setScrollFactor(0.35)
        this.bgFar.add(cloud)
      }
    }
    // 远景剪影（按地形铺一排，全宽）。
    const horizon = this.groundY
    for (let x = -100; x < W + 100; x += 220) {
      const far = this.drawDeco(x + bg.float(0, 80), horizon, t.decoFar, 0.7, t)
      far.setScrollFactor(0.5)
      this.bgFar.add(far)
    }
    // 近景装饰（更大、更靠下、视差更快，全宽）。
    for (let x = 0; x < W; x += 360) {
      const near = this.drawDeco(x + bg.float(0, 120), horizon, t.decoNear, 1.15, t)
      near.setScrollFactor(0.9)
      this.bgNear.add(near)
    }
    // 地面（铺色 + 地平线，全宽）。
    const groundG = this.add.graphics()
    groundG.fillStyle(t.ground, 1)
    groundG.fillRect(0, horizon, W, this.H - horizon + 80)
    groundG.lineStyle(4, t.groundLine, 1)
    groundG.lineBetween(0, horizon, W, horizon)
    // 地面纹理（虚线/草点）。
    groundG.fillStyle(t.groundLine, 0.5)
    for (let x = 0; x < W; x += 60) groundG.fillRect(x, horizon + 18, 26, 4)
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
    // 移动方向用 window 级 DOM 事件追踪（capture：先于任何 stopPropagation；React 弹窗有焦点也收得到）。
    // 按物理键码（KeyA/KeyD/Arrow*）判定，与键盘布局无关。
    this.domKeyDown = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.heldLeft = true
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.heldRight = true
    }
    this.domKeyUp = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.heldLeft = false
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.heldRight = false
    }
    this.domBlur = () => { this.heldLeft = false; this.heldRight = false } // 切走窗口/失焦：别卡住方向
    window.addEventListener('keydown', this.domKeyDown, true)
    window.addEventListener('keyup', this.domKeyUp, true)
    window.addEventListener('blur', this.domBlur)
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
   * 清触屏方向意图（弹窗打开时调用，避免摇杆栓锁）。键盘方向不在这里处理——
   * 它由 window 级 DOM keydown/keyup 实时反映真实按键，弹窗期间松键也收得到，无需 reset。
   */
  private clearMovementInput(): void {
    this.touchDir = 0
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

  // ── 关卡（横版长地图：从近端走到远端关底）─────────────────────────────
  private startLevel(level: number): void {
    const levelChanged = level !== this.level
    this.level = level
    this.theme = themeForLevel(level)
    // 换关：重解析地形 + 重建世界（地面/平台/坑/管道/?块/陷阱）+ 相机/物理边界。
    if (levelChanged) {
      this.resolveCurrentStage()
      this.physics.world.setBounds(0, 0, this.worldW, this.H + 400)
      this.cameras.main.setBounds(0, 0, this.worldW, this.H)
      this.buildLevelWorld()
    } else {
      // 同关（首关/重开）：背景与地形已在 create 建好，只重画背景层 + 重铺天气。
      this.drawBackground()
      this.setupWeather()
    }
    this.boss = undefined
    this.bossSpawned = false
    this.bossQuizCdUntil = 0
    this.resetBossCombat() // #28：换关清掉上一关老师招式残留
    // 沿路刷怪点（已按 atX 升序）排队，主角推进到 atX 时成簇刷怪。
    this.pendingSpawnSlots = this.stage.spawns.map((s) => ({ atX: s.atX, count: s.count }))
    // 主角回到近端出生点，给一段入场无敌（避免刚进关贴脸刷怪连扣）。
    this.hero.setPosition(this.stage.heroStartX, this.groundY)
    this.lastSafeX = this.stage.heroStartX
    this.hero.invulnUntil = this.time.now + 1200
    this.cameras.main.flash(280, 255, 255, 255)
    this.floatText(this.hero.x, this.hero.y - 170, '冲向关底·打穿同学群!', '#ffe08a', 22)
    this.pushHud()
  }

  /** 主角推进到某刷怪点 atX → 成簇刷 count 个小怪（散在主角前方一带）。 */
  private maybeTriggerSpawns(): void {
    if (this.over) return
    const heroX = this.hero.x
    // 触发所有已越过的刷怪点（队列已升序；推进式弹出）。
    while (this.pendingSpawnSlots.length && heroX >= this.pendingSpawnSlots[0].atX) {
      const slot = this.pendingSpawnSlots.shift()!
      this.spawnCluster(slot.atX, slot.count)
    }
  }

  /** 在 atX 前方一带成簇刷 count 个同学小怪。 */
  private spawnCluster(atX: number, count: number): void {
    if (this.over) return
    const camW = this.cameras.main.width || this.W
    // 大多刷在主角前方（推进方向）半屏开外，错开 x 避免叠在一起。
    const base = Math.max(atX, this.hero.x + Math.max(camW * 0.42, 320))
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Clamp(base + i * Phaser.Math.Between(70, 150), 80, this.worldW - 80)
      this.time.delayedCall(i * 160, () => this.spawnMob(x))
    }
  }

  private spawnMob(x: number): void {
    if (this.over) return
    const name = this.mobNames[Phaser.Math.Between(0, this.mobNames.length - 1)]
    const hp = Phaser.Math.Between(1, 2)
    const speed = Phaser.Math.Between(70, 120)
    const e = new Enemy(this, x, this.groundY, { charKey: pickClassmateKey(name), name, isBoss: false, hp, speed })
    this.enemies.add(e)
    this.physics.add.collider(e, this.platforms)
  }

  /** 关底 Boss：推进到 flagX 附近触发（生成在远端关底，不再贴脸跟刷）。 */
  private maybeSpawnBoss(): void {
    if (this.bossSpawned || this.over) return
    if (this.hero.x < this.stage.flagX - this.W * 0.55) return
    this.bossSpawned = true
    this.spawnBoss()
  }

  private spawnBoss(): void {
    if (this.over) return
    const def = this.bosses[this.level]
    // Boss 出现在旗杆/校门（关卡远端），按名字性别选精灵（女=teacherF / 男=teacher）。
    const x = Phaser.Math.Clamp(this.stage.flagX, this.hero.x + 240, this.worldW - 80)
    const e = new Enemy(this, x, this.groundY, { charKey: pickTeacherKey(def.name), name: def.name, isBoss: true, hp: def.hp, speed: 70 })
    this.enemies.add(e)
    this.physics.add.collider(e, this.platforms)
    this.boss = e
    this.resetBossCombat()
    this.initBossMoves(def) // #28：种子化挑这位老师的主动招组
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
    if (this.time.now < this.heroStunUntil) return // #28 眼神杀：定住，动不了
    if (this.tryStruggle(this.time.now)) return // #28 罚站中：这下用来挣脱，不起跳
    if (this.hero.canJump()) {
      this.hero.jump()
      playSfx('jump')
    }
  }

  private doAttack(): void {
    if (this.frozen) return
    if (this.time.now < this.heroStunUntil) return // #28 眼神杀：定住，出不了招
    if (this.tryStruggle(this.time.now)) return // #28 罚站中：这下用来挣脱，不出招
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
    if (this.time.now < this.heroStunUntil) return // #28 眼神杀：定住，放不了大招
    if (this.time.now < this.heroSkillDisabledUntil) {
      this.floatText(this.hero.x, this.hero.y - 150, '技能被没收了!', '#c89bff', 18) // #28 没收
      return
    }
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
    if (result === 'dead') {
      if (enemy.isBoss) this.onBossDefeated()
      else this.onEnemyKilled(enemy)
    }
    this.pushHud()
  }

  private onEnemyTouch(enemy: Enemy): void {
    if (this.frozen || enemy.dead) return
    const now = this.time.now

    // 踩怪：主角下落踩在敌人头顶 → 小怪踩杀、Boss（护盾在线）只弹起。优先于接触伤害判定。
    const heroBody = this.hero.body as Phaser.Physics.Arcade.Body
    const enemyTopY = enemy.y - enemy.displayHeight
    const killable = !enemy.isBoss || enemy.isShieldDown(now)
    const stomp = stompResult(this.hero.y, heroBody.velocity.y, enemyTopY, this.hero.x, enemy.x, enemy.displayWidth * 0.5, killable)
    if (stomp !== 'none') {
      // 踩中：主角弹起。
      heroBody.setVelocityY(-460)
      this.hero.invulnUntil = Math.max(this.hero.invulnUntil, now + 220)
      if (stomp === 'kill') {
        const res = enemy.knowledgeHit(enemy.isBoss ? BOSS_KNOWLEDGE_DMG : 99, this.hero.x)
        this.hitstop(60)
        this.cameras.main.shake(90, 0.004)
        this.spawnBurst(enemy.x, enemyTopY + 20, 0xffe08a, 10)
        this.floatText(enemy.x, enemyTopY, '踩!', '#ffd23f', 22)
        playSfx('slap')
        if (res === 'dead') {
          if (enemy.isBoss) this.onBossDefeated()
          else this.onEnemyKilled(enemy)
        }
      } else {
        // bounce：踩到护盾 Boss 弹开（无伤），提示去破盾。
        this.floatText(enemy.x, enemyTopY, '护盾·弹开!', '#7cc0ff', 18)
        playSfx('hit')
      }
      this.pushHud()
      return
    }

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

  // ── BOSS 知识闸 + 破盾循环 ───────────────────────────────────────────
  // 循环：BOSS 出场带学霸护盾（免疫近战）→ 逼近主角弹知识闸（题卡）→ 答对则 breakShield，
  //      护盾落下约 SHIELD_BREAK_MS，这段窗口内用普攻揍它扣血 → 窗口结束护盾再生、知识闸恢复。
  private maybeBossQuiz(): void {
    if (!this.boss || this.boss.dead || this.pending || this.frozen) return
    if (this.bossPhase !== 'idle') return // #28：老师正在施放主动招，先不弹知识闸
    const now = this.time.now
    // 破盾窗口内不弹题（让玩家专心揍）；护盾在线才弹知识闸。
    if (!this.boss.isShielded) return
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
    if (p.source === 'rollcall') this.resolveRollCall(correct, p.dmg ?? 2) // #28 老师点名
    else this.resolveBossQuiz(correct)
    this.pushHud()
  }

  private resolveBossQuiz(correct: boolean): void {
    const boss = this.boss
    const def = this.bosses[this.level]
    if (!boss || boss.dead) return
    if (correct) {
      // 答对 → 破盾：护盾真的落下一段窗口，这段时间普攻能扣它血。纯视觉（无卡片、无常驻文案）。
      boss.breakShield(SHIELD_BREAK_MS)
      const color = subjectColor(def.subject)
      this.hitstop(120)
      this.slowmo(160, 0.45) // 破盾定格般的微慢镜
      this.cameras.main.shake(220, 0.010)
      this.cameras.main.flash(180, 180, 230, 255)
      // 纯视觉「答对→破盾→可近战」：碎盾爆 + 「可揍」金色脉冲 + 科目配色冲击波（无卡片、无教学句 #25）。
      this.shieldShatter(boss, color)
      this.meleeReadyPulse(boss)
      this.shockwave(boss.x, boss.y - boss.displayHeight * 0.5, color)
      this.spawnBurst(boss.x, boss.y - boss.displayHeight * 0.6, color, 24)
      // 一条短促自动消失的「破盾!」飘字（非卡片，~0.8s 自动飘走）。
      this.floatText(boss.x, boss.y - boss.displayHeight - 10, '破盾!', '#ffd23f', 26)
      const cry = skillCry(def.subject, this.band)
      if (cry) this.floatText(this.hero.x, this.hero.y - 170, cry, '#ffd23f', 24)
      playSfx('skill')
      playSfx('correct')
    } else {
      // 答错：BOSS 反打主角（护盾仍在）。纯视觉（红闪+抖屏+老师吐槽气泡），无横幅。
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
    if (!this.boss || this.over) return // 防重入（近战/AoE 同帧多次触发）
    const def = this.bosses[this.level]
    playSfx('win')
    this.cameras.main.flash(400, 255, 240, 180)
    this.floatText(this.hero.x, this.hero.y - 180, `${def.name}：「${def.winLine}」`, '#7CFFB0', 22)
    this.boss = undefined
    this.resetBossCombat() // #28：清掉残留预警/弹体/罚站
    // 存档：已通过本关。
    saveLevel(this.cfg.player, this.level + 1)
    // 下一关 or 通关。
    this.time.delayedCall(900, () => {
      if (this.level + 1 >= this.totalLevels) {
        this.win()
      } else {
        this.clearAllEnemies()
        this.startLevel(this.level + 1)
      }
    })
  }

  /** 换关前清掉场上所有残留敌人（含还没倒地的）。 */
  private clearAllEnemies(): void {
    ;(this.enemies.getChildren() as Enemy[]).slice().forEach((e) => e.destroy(true))
    this.enemies.clear(true, true)
  }

  // ── #28 老师主动攻击：telegraph → active → recover 状态机 ─────────────
  // 招式池(纯数据)在 bossMoves.ts；这里驱动节奏与命中/躲避。每招先给 ≥500ms 看得见的预警，
  // 玩家据 move.dodge 用 跳(ground-shock)/走位(projectile·cone·aoe-drop)/狂点(root) 躲。
  // 破盾窗口=玩家进攻回合，老师不发招。冻结/答题时整套时钟暂停（预警不被吃掉）。

  /** spawnBoss 时种子化挑这位老师的招式组（只保留 v1 已实现的效果，保底 ≥2 招）。 */
  private initBossMoves(def: BossDef): void {
    const rng = makeRng((this.runSeed + this.level * 0x632be59b + 0x9e3779b1) >>> 0)
    const pick = <T,>(arr: T[]): T => rng.pick(arr)
    let set = movesForBoss({ subject: def.subject, band: this.band, pick }).filter((m) =>
      BOSS_MOVE_IMPL.has(m.effect),
    )
    const want = this.band === 'low' ? 2 : 3
    for (const m of MOVE_POOL) {
      if (set.length >= want) break
      if (!m.subject && BOSS_MOVE_IMPL.has(m.effect) && !set.some((s) => s.id === m.id)) set.push(m)
    }
    this.bossMoveSet = set
    this.bossMoveIdx = 0
    this.bossPhase = 'idle'
    this.bossMove = undefined
    this.bossNextMoveAt = this.time.now + (this.band === 'low' ? 3400 : 2400) // 出场缓冲
  }

  /** 清掉一切老师招式残留（换关/Boss死/胜负/重开调用）。 */
  private resetBossCombat(): void {
    this.bossPhase = 'idle'
    this.bossMove = undefined
    this.bossMoveSet = []
    this.bossMoveIdx = 0
    this.heroRootedUntil = 0
    this.heroRootRing?.destroy()
    this.heroRootRing = undefined
    this.heroStunUntil = 0
    this.heroSkillDisabledUntil = 0
    this.bossEnrageUntil = 0
    if (this.bossEnrageTinted && this.boss && !this.boss.dead) this.boss.clearTint()
    this.bossEnrageTinted = false
    this.bossDropXs = []
    this.clearBossMoveObjs()
    for (const p of this.bossProjectiles) p.obj.destroy()
    this.bossProjectiles = []
    if (this.boss) this.boss.bossBusy = false
  }

  private clearBossMoveObjs(): void {
    // 先杀掉对象身上在跑的 tween（radius/alpha，含 repeat:-1）——否则销毁后 tween 还写属性会抛错。
    for (const o of this.bossMoveObjs) {
      this.tweens.killTweensOf(o)
      o.destroy()
    }
    this.bossMoveObjs = []
  }

  private updateBossMoves(now: number, deltaMs: number): void {
    const boss = this.boss
    if (!boss || boss.dead) {
      if (this.bossPhase !== 'idle' || this.bossProjectiles.length) this.resetBossCombat()
      return
    }
    // 冻结/答题：整套时钟暂停——把所有截止时刻顺延一帧，解冻后接着走。
    if (this.pending != null || now < this.frozenUntil || this.over) {
      this.bossPhaseUntil += deltaMs
      this.bossNextMoveAt += deltaMs
      if (this.heroRootedUntil > now) this.heroRootedUntil += deltaMs
      for (const p of this.bossProjectiles) p.dieAt += deltaMs
      return
    }
    this.updateBossProjectiles(now)
    this.updateRootRing(now)
    // 拖堂杀气：狂暴期维持红 tint（受击红闪后重新染上）；到点恢复一次。
    if (this.bossEnrageUntil > now) { boss.setTint(0xff7a7a); this.bossEnrageTinted = true }
    else if (this.bossEnrageTinted) { boss.clearTint(); this.bossEnrageTinted = false }
    // 破盾窗口 = 玩家进攻回合：老师不发新招（让玩家专心揍）。
    if (boss.isShieldDown(now)) {
      if (this.bossPhase === 'idle') this.bossNextMoveAt = Math.max(this.bossNextMoveAt, now + 700)
      return
    }
    switch (this.bossPhase) {
      case 'idle':
        if (now < this.bossNextMoveAt || this.bossMoveSet.length === 0) break
        if (Math.abs(boss.x - this.hero.x) > 560) {
          this.bossNextMoveAt = now + 350 // 太远：先逼近，稍后再判
          break
        }
        this.startBossMove(now)
        break
      case 'telegraph':
        if (now >= this.bossPhaseUntil) this.enterBossActive(now)
        break
      case 'active':
        if (now >= this.bossPhaseUntil) this.enterBossRecover(now)
        break
      case 'recover':
        if (now >= this.bossPhaseUntil) this.endBossMove(now)
        break
    }
  }

  private startBossMove(now: number): void {
    const boss = this.boss!
    const move = this.bossMoveSet[this.bossMoveIdx % this.bossMoveSet.length]
    this.bossMoveIdx++
    this.bossMove = move
    this.bossPhase = 'telegraph'
    this.bossPhaseUntil = now + move.telegraphMs
    boss.bossBusy = true
    // 招名预警飘字（橙）+ 起手抖动。
    this.floatText(boss.x, boss.y - boss.displayHeight - 12, `老师·${move.label}!`, '#ffb84d', 22)
    this.tweens.add({ targets: boss, scaleY: boss.scaleY * 1.06, duration: move.telegraphMs * 0.5, yoyo: true })
    this.telegraphBossMove(move)
    playSfx('tap')
  }

  /** 预警视觉：按 effect 给看得见的起手 tell（同时锁定落点/钉点）。 */
  private telegraphBossMove(move: TeacherMove): void {
    const boss = this.boss!
    const gY = this.groundY - 4
    const range = move.range ?? 220
    if (move.effect === 'ground-shock') {
      const ring = this.add.circle(boss.x, gY, 20, 0xff6b6b, 0.12).setDepth(30)
      ring.setStrokeStyle(3, 0xff6b6b, 0.85)
      this.tweens.add({ targets: ring, radius: range, duration: move.telegraphMs, ease: 'Quad.easeIn' })
      this.bossMoveObjs.push(ring)
    } else if (move.effect === 'cone') {
      const midY = boss.y - boss.displayHeight * 0.5
      const zone = this.add
        .rectangle(boss.x + boss.facing * range * 0.5, midY, range, 64, 0xffd23f, 0.12)
        .setDepth(30)
      zone.setStrokeStyle(2, 0xffd23f, 0.7)
      this.tweens.add({ targets: zone, alpha: 0.24, duration: move.telegraphMs * 0.5, yoyo: true, repeat: -1 })
      this.bossMoveObjs.push(zone)
    } else if (move.effect === 'aoe-drop') {
      const n = move.count ?? 3
      const r = move.range ?? 140
      this.bossDropXs = []
      for (let i = 0; i < n; i++) {
        const mx = this.hero.x + (i - (n - 1) / 2) * (r * 1.1)
        this.bossDropXs.push(mx)
        const mark = this.add.circle(mx, gY, r * 0.5, 0xff8a3d, 0.12).setDepth(30)
        mark.setStrokeStyle(3, 0xff8a3d, 0.85)
        this.tweens.add({ targets: mark, alpha: 0.3, duration: 240, yoyo: true, repeat: -1 })
        this.bossMoveObjs.push(mark)
      }
    } else if (move.effect === 'root') {
      this.bossLockX = this.hero.x
      const ring = this.add.circle(this.hero.x, gY, (move.range ?? 260) * 0.5, 0xb06bff, 0.1).setDepth(30)
      ring.setStrokeStyle(3, 0xb06bff, 0.85)
      this.tweens.add({ targets: ring, radius: 40, duration: move.telegraphMs, ease: 'Quad.easeIn' })
      this.bossMoveObjs.push(ring)
    } else if (move.effect === 'projectile') {
      const dot = this.add.circle(boss.x + boss.facing * 22, boss.y - boss.displayHeight * 0.6, 5, 0xffffff, 0.95).setDepth(46)
      this.tweens.add({ targets: dot, scale: 1.9, duration: move.telegraphMs * 0.5, yoyo: true, repeat: -1 })
      this.bossMoveObjs.push(dot)
    } else if (move.effect === 'gaze-stun') {
      // 视线锥预警（紫，朝主角方向）——预警期走出锥/绕背可躲。
      const midY = boss.y - boss.displayHeight * 0.62
      const zone = this.add
        .rectangle(boss.x + boss.facing * range * 0.5, midY, range, 40, 0xb06bff, 0.1)
        .setDepth(30)
      zone.setStrokeStyle(2, 0xc89bff, 0.7)
      this.tweens.add({ targets: zone, alpha: 0.26, duration: move.telegraphMs * 0.5, yoyo: true, repeat: -1 })
      this.bossMoveObjs.push(zone)
    }
    // forced-quiz / disable-skill / enrage 无定位躲避：以招名飘字 + 起手抖动为预警（见 startBossMove）。
  }

  private enterBossActive(now: number): void {
    const move = this.bossMove!
    this.bossPhase = 'active'
    this.bossPhaseUntil = now + Math.max(80, move.activeMs)
    this.resolveBossActive(move)
    this.clearBossMoveObjs() // 预警视觉收掉（弹体已独立存在）
  }

  /** 命中结算（单次快照）：预警阶段是反应窗口，active 起手这一刻判定是否躲过。 */
  private resolveBossActive(move: TeacherMove): void {
    const boss = this.boss!
    const dmg = move.damage ?? 1
    const heroBody = this.hero.body as Phaser.Physics.Arcade.Body
    const airborne = !heroBody.blocked.down && !heroBody.touching.down
    const dx = this.hero.x - boss.x
    const range = move.range ?? 220
    switch (move.effect) {
      case 'ground-shock': {
        this.shockwave(boss.x, this.groundY - 6, 0xff6b6b)
        this.cameras.main.shake(160, 0.006)
        playSfx('hit')
        if (!airborne && Math.abs(dx) <= range) this.bossHitHero(dmg, boss.x) // 跳起离地可躲
        else this.dodgeFlash()
        break
      }
      case 'cone': {
        this.spawnBurst(boss.x + boss.facing * range * 0.4, boss.y - boss.displayHeight * 0.5, 0xffd23f, 14)
        playSfx('spit')
        const inFront = Math.sign(dx) === boss.facing || Math.abs(dx) < 40
        if (inFront && Math.abs(dx) <= range) this.bossHitHero(dmg, boss.x) // 走位/退出扇区可躲
        else this.dodgeFlash()
        break
      }
      case 'aoe-drop': {
        const r = (move.range ?? 140) * 0.6
        let hit = false
        for (const mx of this.bossDropXs) {
          this.dropBurst(mx)
          if (Math.abs(this.hero.x - mx) <= r) hit = true
        }
        this.cameras.main.shake(180, 0.006)
        playSfx('hit')
        if (hit) this.bossHitHero(dmg, this.hero.x) // 走开落点可躲
        else this.dodgeFlash()
        break
      }
      case 'root': {
        if (Math.abs(this.hero.x - this.bossLockX) <= (move.range ?? 260) * 0.5) {
          this.applyRoot(this.time.now, move.durationMs ?? 1400)
        } else this.dodgeFlash()
        break
      }
      case 'projectile': {
        this.fireBossProjectiles(move)
        break
      }
      case 'gaze-stun': {
        // 眼神杀：预警时走出视线锥（背身/离开范围）可躲；命中则短定身（不可挣脱、自动解除）。
        this.spawnBurst(boss.x + boss.facing * range * 0.5, boss.y - boss.displayHeight * 0.55, 0xb06bff, 10)
        playSfx('tap')
        const inFront = Math.sign(dx) === boss.facing || Math.abs(dx) < 40
        if (inFront && Math.abs(dx) <= range) {
          const ms = move.durationMs ?? 900
          this.heroStunUntil = this.time.now + ms
          this.floatText(this.hero.x, this.hero.y - this.hero.displayHeight - 16, '眼神杀! 定住', '#c89bff', 20)
          this.hero.setTint(0xc89bff)
          this.time.delayedCall(ms, () => { if (!this.over) this.hero.clearTint() })
        } else this.dodgeFlash()
        break
      }
      case 'forced-quiz': {
        this.startRollCall(move) // 我点名了/随堂测验/听写：弹题，答对免罚、答错/超时挨罚
        break
      }
      case 'disable-skill': {
        // 没收：在范围内则暂封大招（预警时走远可躲）。
        if (Math.abs(dx) <= range) {
          this.heroSkillDisabledUntil = this.time.now + (move.durationMs ?? 5000)
          this.floatText(this.hero.x, this.hero.y - this.hero.displayHeight - 16, '没收! 大招暂封', '#c89bff', 20)
          this.spawnBurst(this.hero.x, this.hero.y - this.hero.displayHeight * 0.5, 0xc89bff, 10)
          playSfx('tap')
          this.pushHud()
        } else this.dodgeFlash()
        break
      }
      case 'enrage': {
        // 拖堂：老师自我狂暴（出招更密 + 红色杀气），无直接命中。
        this.bossEnrageUntil = this.time.now + (move.durationMs ?? 7000)
        this.floatText(boss.x, boss.y - boss.displayHeight - 12, '拖堂! 老师变凶', '#ff6b6b', 22)
        this.shockwave(boss.x, boss.y - boss.displayHeight * 0.5, 0xff6b6b)
        this.cameras.main.shake(160, 0.006)
        playSfx('skill')
        break
      }
    }
  }

  private enterBossRecover(now: number): void {
    const move = this.bossMove!
    this.bossPhase = 'recover'
    this.bossPhaseUntil = now + Math.max(120, move.recoverMs)
    const boss = this.boss
    if (boss) this.tweens.add({ targets: boss, scaleY: boss.scaleY * 0.96, duration: 120, yoyo: true })
  }

  private endBossMove(now: number): void {
    this.bossPhase = 'idle'
    this.bossMove = undefined
    this.clearBossMoveObjs()
    if (this.boss) this.boss.bossBusy = false
    let cd = this.band === 'low' ? Phaser.Math.Between(3000, 4200) : Phaser.Math.Between(2000, 3200)
    if (now < this.bossEnrageUntil) cd = Math.round(cd * 0.55) // 拖堂：出招更密
    this.bossNextMoveAt = now + cd
  }

  /** 老师命中主角（断连击 + 红闪抖屏 + 扣血；无敌期内不结算）。 */
  private bossHitHero(dmg: number, fromX: number): void {
    const hurt = this.hero.takeHit(dmg, fromX)
    if (!hurt) return
    this.combo = 0
    this.hitstop(70)
    this.cameras.main.shake(150, 0.007)
    this.cameras.main.flash(120, 255, 80, 80)
    this.floatText(this.hero.x, this.hero.y - 150, `-${dmg}`, '#ff6b6b', 22)
    playSfx('hit')
    this.pushHud()
    if (this.hero.isDead()) this.lose()
  }

  private dodgeFlash(): void {
    this.floatText(this.hero.x, this.hero.y - this.hero.displayHeight - 20, '躲过!', '#9fe0ff', 18)
  }

  /** 作业/教具从头顶砸到地面的视觉（aoe-drop）。 */
  private dropBurst(x: number): void {
    const o = this.add.rectangle(x, this.groundY - 230, 26, 22, 0xff8a3d, 0.95).setDepth(60)
    this.tweens.add({
      targets: o,
      y: this.groundY - 12,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.spawnBurst(x, this.groundY - 14, 0xff8a3d, 8)
        o.destroy()
      },
    })
  }

  private applyRoot(now: number, durationMs: number): void {
    this.heroRootedUntil = now + durationMs
    this.heroRootRing?.destroy()
    const ring = this.add.circle(this.hero.x, this.groundY - 4, 44, 0xb06bff, 0).setDepth(47)
    ring.setStrokeStyle(4, 0xc89bff, 0.9)
    this.heroRootRing = ring
    this.floatText(this.hero.x, this.hero.y - this.hero.displayHeight - 16, '罚站! 狂点挣脱', '#c89bff', 20)
    playSfx('hit')
  }

  private updateRootRing(now: number): void {
    const ring = this.heroRootRing
    if (!ring) return
    if (now >= this.heroRootedUntil) {
      ring.destroy()
      this.heroRootRing = undefined
      return
    }
    ring.setPosition(this.hero.x, this.groundY - 4)
    ring.setScale(Phaser.Math.Clamp((this.heroRootedUntil - now) / 1400, 0.2, 1))
  }

  /** 罚站中：每次按 跳/巴掌 都算挣扎（缩短定身、不执行该动作）。返回是否消耗了这次输入。 */
  private tryStruggle(now: number): boolean {
    if (now >= this.heroRootedUntil) return false
    this.heroRootedUntil -= 320
    this.spawnBurst(this.hero.x, this.hero.y - this.hero.displayHeight * 0.5, 0xc89bff, 4)
    if (now >= this.heroRootedUntil) {
      this.heroRootedUntil = 0
      this.heroRootRing?.destroy()
      this.heroRootRing = undefined
      this.floatText(this.hero.x, this.hero.y - this.hero.displayHeight - 16, '挣脱!', '#9fe0ff', 18)
    }
    return true
  }

  private fireBossProjectiles(move: TeacherMove): void {
    const boss = this.boss!
    const n = move.count ?? 1
    const speed = move.projectileSpeed ?? 520
    const range = move.range ?? 900
    const life = (range / speed) * 1000
    const oy = boss.y - boss.displayHeight * 0.6
    for (let i = 0; i < n; i++) {
      this.time.delayedCall(i * 130, () => {
        if (!this.boss || this.boss.dead) return
        const b = this.boss
        const dir = this.hero.x >= b.x ? 1 : -1
        const p = this.add.circle(b.x + dir * 22, oy, 7, 0xffffff, 1).setDepth(60)
        p.setStrokeStyle(2, 0xcfd8e3, 1)
        this.bossProjectiles.push({ obj: p, vx: dir * speed, dieAt: this.time.now + life, hit: false, dmg: move.damage ?? 1 })
        playSfx('jump')
      })
    }
  }

  private updateBossProjectiles(now: number): void {
    if (this.bossProjectiles.length === 0) return
    const dt = 1 / 60
    const remain: BossProjectile[] = []
    for (const pr of this.bossProjectiles) {
      if (pr.hit || now >= pr.dieAt) {
        pr.obj.destroy()
        continue
      }
      pr.obj.x += pr.vx * dt
      const hx = this.hero.x
      const hy = this.hero.y - this.hero.displayHeight * 0.5
      if (Math.abs(pr.obj.x - hx) < 26 && Math.abs(pr.obj.y - hy) < this.hero.displayHeight * 0.55) {
        pr.hit = true
        this.spawnBurst(pr.obj.x, pr.obj.y, 0xffffff, 8)
        this.bossHitHero(pr.dmg, pr.obj.x)
        pr.obj.destroy()
        continue
      }
      const cam = this.cameras.main
      if (pr.obj.x < cam.scrollX - 60 || pr.obj.x > cam.scrollX + this.W + 60) {
        pr.obj.destroy()
        continue
      }
      remain.push(pr)
    }
    this.bossProjectiles = remain
  }

  /** #28 我点名了：弹一道知识题（React 卡片）。答对免罚、答错/超时挨罚（move.damage）。 */
  private startRollCall(move: TeacherMove): void {
    const def = this.bosses[this.level]
    const q = drawBySubject(def.subject, this.band, 1)[0] ?? drawQuestions({ band: this.band, count: 1 })[0]
    if (!q) return // 没题就跳过，不卡
    this.pending = { source: 'rollcall', question: q, resolved: false, dmg: move.damage ?? 2 }
    this.clearMovementInput()
    this.hero.drive(0, true)
    this.bridge.emit('quiz:open', {
      question: q,
      source: 'boss',
      seconds: QUIZ_SECONDS,
      subjectLabel: subjectLabel(q.subject),
    })
    this.floatText(this.hero.x, this.hero.y - 170, '点名! 答对免罚', '#ffd23f', 20)
    playSfx('tap')
    this.quizTimer?.remove()
    this.quizTimer = this.time.delayedCall(QUIZ_SECONDS * 1000, () => this.resolveQuiz(null))
    this.pushHud()
  }

  private resolveRollCall(correct: boolean, dmg: number): void {
    if (correct) {
      this.floatText(this.hero.x, this.hero.y - 160, '答对·免罚!', '#7CFFB0', 22)
      playSfx('correct')
      this.gainEnergy(0.15) // 答对小奖励
      this.bossPhaseUntil = Math.max(this.bossPhaseUntil, this.time.now + 500) // 老师愣一下露破绽
    } else {
      const boss = this.boss
      const hurt = this.hero.takeHit(dmg, boss ? boss.x : this.hero.x)
      this.cameras.main.shake(160, 0.008)
      this.cameras.main.flash(140, 255, 80, 80)
      this.floatText(this.hero.x, this.hero.y - 150, `点名挨罚 -${dmg}`, '#ff6b6b', 22)
      playSfx('wrong')
      if (hurt && this.hero.isDead()) this.lose()
    }
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
    this.resetBossCombat() // #28：胜负收尾清掉老师招式残留
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
    const alive = this.hero
      ? (this.enemies?.getChildren() as Enemy[] | undefined)?.filter((e) => !e.dead).length ?? 0
      : 0
    const bossPresent = !!(this.boss && !this.boss.dead)
    // 横版长地图：用「到关底的推进进度」表达 waveIndex/waveTotal（进度条），
    // waveRemaining = 当前场上同学数，isBossWave = 关底 Boss 已现身。
    const span = this.stage ? this.stage.flagX - this.stage.heroStartX : 1
    const progressed = this.hero ? Phaser.Math.Clamp((this.hero.x - (this.stage?.heroStartX ?? 0)) / span, 0, 1) : 0
    const hud: HudState = {
      hp: this.hero?.hp ?? 0,
      maxHp: this.hero?.maxHp ?? HERO_MAX_HP,
      level: this.level + 1,
      totalLevels: this.totalLevels,
      waveIndex: Math.round(progressed * 100), // 复用为「推进百分比」
      waveTotal: 100,
      waveRemaining: alive,
      isBossWave: bossPresent,
      bossHp: bossPresent ? this.boss!.hp : 0,
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
    // 防抖：Scale.RESIZE 会在尺寸其实没变时也反复派发 resize；尺寸没变就早退，
    // 否则每次重画背景 → 背景一直抖。只有真变化才重铺。
    if (w === this.lastViewW && h === this.lastViewH) return
    this.lastViewW = w
    this.lastViewH = h
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
      const left = this.heldLeft
      const right = this.heldRight
      if (left && !right) dir = -1
      else if (right && !left) dir = 1
      else if (this.touchDir !== 0) dir = this.touchDir
    } else {
      dir = 0
    }
    // #28 罚站(狂点挣脱)/眼神杀(短定身)：被定住时走不动。
    if (this.time.now < this.heroRootedUntil || this.time.now < this.heroStunUntil) dir = 0
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

    // #28 老师主动招状态机（telegraph→active→recover）。先于知识闸，发招期间不弹题。
    this.updateBossMoves(now, delta)
    // BOSS 知识闸（护盾在线 + 逼近触发）。
    this.maybeBossQuiz()

    // 横版长地图推进：到刷怪点成簇刷怪、到关底刷 Boss、坑/陷阱/?块判定。
    if (!frozen) {
      this.maybeTriggerSpawns()
      this.maybeSpawnBoss()
      this.checkPits()
      this.checkTraps()
      this.checkQBlocks()
      this.updateSafeX()
    }

    // 节流推 HUD（每 ~150ms 一次），让剩余人数/能量/BOSS 血实时但不过频。
    if (this.time.now >= this.hudThrottleAt) {
      this.hudThrottleAt = this.time.now + 150
      this.pushHud()
    }
  }

  /** 记录最近的「安全 x」（脚踏实地、不在坑上）——掉坑后回到这里。 */
  private updateSafeX(): void {
    const body = this.hero.body as Phaser.Physics.Arcade.Body
    const onGround = body.blocked.down || body.touching.down
    if (!onGround) return
    // 脚下别正好在坑沿（留点边距），否则回位又掉。
    const overPit = this.pits.some((p) => p.real && this.hero.x > p.x - 40 && this.hero.x < p.x + p.w + 40)
    if (!overPit) this.lastSafeX = this.hero.x
  }

  /** 掉坑判定：主角脚底越过坑沿且水平在真坑内 → 扣血 + 回到最近安全点（非死，全家向）。 */
  private checkPits(): void {
    if (this.hero.y <= this.groundY + 60) return // 还没掉下去多少，先不判
    for (const p of this.pits) {
      if (!p.real) continue
      if (!p.contains(this.hero.x, this.hero.y, this.groundY)) continue
      this.onFall()
      return
    }
  }

  /** 落坑：扣血、回到最近安全 x、短无敌。HP 空才算输（不是即死）。 */
  private onFall(): void {
    const hurt = this.hero.takeHit(PIT_FALL_DMG, this.hero.x)
    // 回到最近安全点（即使无敌期内也要捞回来，避免无限下坠）。
    const body = this.hero.body as Phaser.Physics.Arcade.Body
    this.hero.setPosition(Phaser.Math.Clamp(this.lastSafeX, 60, this.worldW - 60), this.groundY - 40)
    body.setVelocity(0, 0)
    this.hero.invulnUntil = Math.max(this.hero.invulnUntil, this.time.now + 900)
    this.cameras.main.shake(160, 0.006)
    this.cameras.main.flash(140, 120, 140, 200)
    this.floatText(this.hero.x, this.hero.y - 150, `掉坑 -${PIT_FALL_DMG}`, '#9fd0ff', 22)
    playSfx('hit')
    this.combo = 0
    this.pushHud()
    if (hurt && this.hero.isDead()) this.lose()
  }

  /** 伪装陷阱判定：踩中 → 扣血 + 击退（非死）。 */
  private checkTraps(): void {
    for (const t of this.traps) {
      if (!t.checkTrigger(this.hero.x, this.hero.y, this.groundY)) continue
      const hurt = this.hero.takeHit(1, this.hero.x - this.hero.facing * 50)
      this.cameras.main.shake(150, 0.007)
      this.cameras.main.flash(120, 220, 80, 60)
      this.floatText(this.hero.x, this.hero.y - 150, '陷阱! -1', '#ff8a5a', 22)
      playSfx('hit')
      this.combo = 0
      this.pushHud()
      if (hurt && this.hero.isDead()) { this.lose(); return }
    }
  }

  /** ?块判定：主角上升时头顶撞到未顶过的 ?块 → 顶出奖励（金币=能量小 / 能量块=能量大）。 */
  private checkQBlocks(): void {
    const body = this.hero.body as Phaser.Physics.Arcade.Body
    if (body.velocity.y >= -40) return // 必须在上升中（顶头）
    const headY = this.hero.y - this.hero.displayHeight
    for (const q of this.qBlocks) {
      if (q.popped) continue
      const blockBottom = this.groundY - q.h
      if (Math.abs(this.hero.x - q.x) > 34) continue // 水平要对上
      if (Math.abs(headY - blockBottom) > 28) continue // 头顶贴到块底
      if (!q.pop()) continue
      this.onQBlockPop(q.x, blockBottom, q.reward)
      // 顶到把上冲速度卸掉（更像撞到东西）。
      body.setVelocityY(60)
    }
  }

  /** ?块发奖励：金币（能量小涨）/ 能量块（能量大涨）+ 弹出特效。 */
  private onQBlockPop(x: number, y: number, reward: 'coin' | 'energy'): void {
    const isEnergy = reward === 'energy'
    this.gainEnergy(isEnergy ? ENERGY_PER_QENERGY : ENERGY_PER_COIN)
    const color = isEnergy ? 0x35d6a4 : 0xffd23f
    const icon = this.add.circle(x, y - 8, 12, color, 1).setDepth(60)
    this.tweens.add({ targets: icon, y: y - 56, alpha: 0, duration: 560, ease: 'Quad.easeOut', onComplete: () => icon.destroy() })
    this.spawnBurst(x, y - 8, color, 8)
    this.floatText(x, y - 24, isEnergy ? '能量块!' : '金币 +', isEnergy ? '#7CFFB0' : '#ffd23f', 20)
    playSfx('correct')
    this.pushHud()
  }
}
