// Phaser 舞台桥：把 DuelScene 挂进 React（经 PhaserHost），并把「声明式动画指令」
// 翻译成对场景的命令式方法调用。
//
// 驱动方式（遵守 ESLint：effect 内不 setState、不在渲染期读写 ref.current）：
//   · React 持有战斗逻辑；每产生一次该播的动画，就把 fxSeq +1 并带上 fx 描述。
//   · 本组件用一个 effect 监听 fxSeq 变化，在回调里调 sceneRef.current.playHit/...，
//     只做命令式调用、绝不 setState。
//   · spawnKey 变化（开局/重开/进房）时另一个 effect 调 scene.spawn 重置双方。
//   · 拿 game 实例后还监听 'duel-scene-ready'：场景（重）建好时按当前 props 重铺一次，
//     避免 StrictMode 双挂载或场景重建后舞台空白。

import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { PhaserHost } from '@/games/_battle/PhaserHost'
import { DuelScene, type DuelSpawnSpec } from '../scene/DuelScene'
import type { AttackKind } from '../duelTypes'

/** 一次要播的动画指令（声明式）。none=不播。 */
export interface StageFx {
  kind: 'hit' | 'down' | 'none'
  attacker?: 'left' | 'right'
  victim?: 'left' | 'right'
  target?: 'enemy' | 'self'
  attack?: AttackKind
  crit?: boolean
  damage?: number
  victimHpAfter?: number
  /** 这一击是否击倒：命中后接着播该方倒地。 */
  downAfter?: 'left' | 'right'
  /** kind:'down' 独立倒地用：谁倒下。 */
  downSide?: 'left' | 'right'
}

interface DuelStageProps {
  left: DuelSpawnSpec
  right: DuelSpawnSpec
  /** 变化即重置双方（开局/再来一局）。 */
  spawnKey: string
  /** 自增计数：每 +1 触发一次 fx。 */
  fxSeq: number
  fx: StageFx | null
}

export function DuelStage({ left, right, spawnKey, fxSeq, fx }: DuelStageProps) {
  const sceneRef = useRef<DuelScene | null>(null)
  // 把可能每次渲染变化的值收进 ref，供「只想监听 fxSeq」的 effect / 事件回调读最新值。
  // 注意：仓库 ESLint 禁止在渲染期写 ref.current，故统一在「每次提交后」的 effect 里同步。
  const leftRef = useRef(left)
  const rightRef = useRef(right)
  const fxRef = useRef(fx)
  const lastSeqRef = useRef(0)
  const lastSpawnRef = useRef<string | null>(null)

  // 每次提交后把最新 props 同步进 ref（声明在前 → 后面的 effect 读到的就是最新值）。
  useEffect(() => {
    leftRef.current = left
    rightRef.current = right
    fxRef.current = fx
  })

  const handleReady = (game: Phaser.Game) => {
    // 场景实例由 PhaserHost 在内部创建；这里拿到 game 后取场景引用并监听就绪。
    const grab = () => {
      const sc = game.scene.getScene('duel') as DuelScene | null
      if (sc) sceneRef.current = sc
    }
    grab()
    // 场景（重）建好：按当前 props 铺一次双方（防重建后空白）。
    game.events.on('duel-scene-ready', () => {
      grab()
      sceneRef.current?.spawn(leftRef.current, rightRef.current)
      lastSpawnRef.current = null // 强制下个 spawn effect 再对齐一次
    })
  }

  // 开局/重开/进房：重置双方（含满血血条）。血量变化时不在此直更——血条由 fx 命中时
  // （victimHpAfter）刷新，与动画同步；spawn 负责复位，避免血条早于命中就掉。
  useEffect(() => {
    if (lastSpawnRef.current === spawnKey) return
    lastSpawnRef.current = spawnKey
    sceneRef.current?.spawn(leftRef.current, rightRef.current)
  }, [spawnKey])

  // fxSeq 自增 → 播一次动画（命令式，绝不 setState）。
  useEffect(() => {
    if (fxSeq === lastSeqRef.current) return
    lastSeqRef.current = fxSeq
    const sc = sceneRef.current
    const f = fxRef.current
    if (!sc || !f || f.kind === 'none') return
    if (f.kind === 'hit' && f.attacker && f.victim && f.target && f.attack) {
      sc.playHit({
        attacker: f.attacker,
        victim: f.victim,
        target: f.target,
        kind: f.attack,
        crit: f.crit,
        damage: f.damage,
        victimHpAfter: f.victimHpAfter,
        downAfter: f.downAfter,
      })
    } else if (f.kind === 'down' && f.downSide) {
      sc.playDown(f.downSide)
    }
  }, [fxSeq])

  return (
    <PhaserHost
      scene={DuelScene}
      onReady={handleReady}
      className="mx-auto aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-3xl shadow-sm ring-1 ring-ink-100"
    />
  )
}
