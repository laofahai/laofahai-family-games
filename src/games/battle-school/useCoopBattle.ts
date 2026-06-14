// 多人共斗的对局编排（host 权威）。把「上报命中 / 应用共享血量 / 推进」收在这里，
// 全部走「用户事件回调 / 频道消息回调 / 微任务」——不在 effect 里同步 dispatch（遵守 ESLint）。
//
// 模型：
//  · host 在 sharedHpRef 里维护共享 Boss 血量（唯一真源），按在线人数放大。
//  · 任何人（host 自己 or guest）打出一记伤害 → host 扣 sharedHp；归零就推进到下一个共享敌人，
//    或全部打完则通关；然后 host 广播 CoopShared，并把同样的变更 dispatch 进自己的 reducer。
//  · guest 不动血量，收到 host 的 CoopShared 后 dispatch COOP_SYNC / COOP_ADVANCE / COOP_WON。
//  · 队友（非自己）打出的命中，本地播一个 peer-hit 特效。

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Dispatch } from 'react'
import type { CoopShared } from '@/games/_battle/coop'
import { advanceSharedEnemy, sharedEnemyAt } from './reducer'
import type { Action, GameState } from './types'
import type { CoopMe, UseCoopRoom } from './useCoopRoom'

export interface UseCoopBattle {
  /** 把「我这次打出的伤害」上报（host 自己算账，guest 发给 host）。 */
  reportHit: (damage: number, crit: boolean) => void
}

export function useCoopBattle(args: {
  state: GameState
  dispatch: Dispatch<Action>
  room: UseCoopRoom
  me: CoopMe
}): UseCoopBattle {
  const { state, dispatch, room, me } = args
  const stateRef = useRef(state)
  stateRef.current = state

  // host：共享 Boss 当前血 / 上限（真源）
  const sharedHpRef = useRef<number>(state.enemy.hp)
  const sharedMaxRef = useRef<number>(state.enemy.maxHp)
  const startedRef = useRef(false)
  // host：每关只取一次在线人数做血量缩放——避免本关中途有人进/退导致【下一个】敌人血量被意外重算。
  // 仅在跨关（打完 Boss 进下一关）时刷新这个快照。
  const levelPlayerCountRef = useRef<number>(1)

  // host：把一帧共享态广播出去
  const broadcastFrame = useCallback(
    (frame: {
      levelIndex: number
      stepIndex: number
      enemyName: string
      enemyEmoji: string
      hp: number
      maxHp: number
      phase: CoopShared['phase']
    }) => {
      room.channel?.broadcastShared({
        rev: Date.now(),
        code: room.code ?? '',
        hostId: me.id,
        levelIndex: frame.levelIndex,
        stepIndex: frame.stepIndex,
        bossId: `${frame.levelIndex}:${frame.stepIndex}`,
        bossName: frame.enemyName,
        bossEmoji: frame.enemyEmoji,
        bossHp: frame.hp,
        bossMaxHp: frame.maxHp,
        phase: frame.phase,
        players: room.players,
      })
    },
    [room, me.id]
  )

  // host：应用一记伤害到共享血；归零则推进 / 通关。任何来源（自己/队友）都走这里。
  const hostApplyDamage = useCallback(
    (byId: string, byName: string, damage: number, crit: boolean) => {
      const s = stateRef.current
      // 队友打的：本地播 peer-hit 特效（自己打的特效已由 reducer 的 hero-attack/diss 播过）
      if (byId !== me.id) dispatch({ type: 'COOP_PEER_HIT', byName, damage, crit })

      sharedHpRef.current = Math.max(0, sharedHpRef.current - damage)

      // 还没倒：同步血量
      if (sharedHpRef.current > 0) {
        dispatch({
          type: 'COOP_SYNC',
          bossHp: sharedHpRef.current,
          bossMaxHp: sharedMaxRef.current,
          levelIndex: s.levelIndex,
          stepIndex: s.stepIndex,
        })
        broadcastFrame({
          levelIndex: s.levelIndex, stepIndex: s.stepIndex,
          enemyName: s.enemy.name, enemyEmoji: s.enemy.emoji,
          hp: sharedHpRef.current, maxHp: sharedMaxRef.current, phase: 'playing',
        })
        return
      }

      // 共享敌人倒下 → 推进。
      // 当前是 Boss（stepIndex 越过本关小怪数）→ 即将进入下一关 → 刷新人数快照；否则沿用本关快照。
      const curLevel = s.levels[s.levelIndex]
      const enteringNextLevel = curLevel != null && s.stepIndex >= curLevel.mobs.length
      if (enteringNextLevel) levelPlayerCountRef.current = room.playerCount()
      const next = advanceSharedEnemy(s.levels, s.levelIndex, s.stepIndex, levelPlayerCountRef.current)
      if (!next) {
        // 通关
        dispatch({ type: 'COOP_WON' })
        broadcastFrame({
          levelIndex: s.levelIndex, stepIndex: s.stepIndex,
          enemyName: s.enemy.name, enemyEmoji: s.enemy.emoji,
          hp: 0, maxHp: sharedMaxRef.current, phase: 'won',
        })
        return
      }
      sharedHpRef.current = next.enemyHp
      sharedMaxRef.current = next.enemyHp
      dispatch({
        type: 'COOP_ADVANCE',
        levelIndex: next.levelIndex, stepIndex: next.stepIndex,
        enemyEmoji: next.enemyEmoji, enemyName: next.enemyName,
        enemyHp: next.enemyHp, isBoss: next.isBoss,
      })
      broadcastFrame({
        levelIndex: next.levelIndex, stepIndex: next.stepIndex,
        enemyName: next.enemyName, enemyEmoji: next.enemyEmoji,
        hp: next.enemyHp, maxHp: next.enemyHp, phase: 'playing',
      })
    },
    [broadcastFrame, dispatch, me.id, room]
  )

  // 上报命中：host 自己结算；guest 发给 host
  const reportHit = useCallback(
    (damage: number, crit: boolean) => {
      if (room.isHost) hostApplyDamage(me.id, me.name, damage, crit)
      else room.channel?.sendHit({ byId: me.id, byName: me.name, damage, crit })
    },
    [room, me.id, me.name, hostApplyDamage]
  )

  // 注册频道业务回调（host 收 guest 命中；guest 收 host 快照）
  useEffect(() => {
    room.setSinks({
      onHit: (hit) => hostApplyDamage(hit.byId, hit.byName, hit.damage, hit.crit),
      onShared: (shared) => applyGuestShared(shared, stateRef.current, dispatch),
    })
  }, [room, hostApplyDamage, dispatch])

  // host：开打时按人数定一次共享敌人血（微任务推迟，避免挂载 effect 内同步 dispatch）
  useEffect(() => {
    if (!room.isHost || startedRef.current) return
    startedRef.current = true
    const s = stateRef.current
    levelPlayerCountRef.current = room.playerCount() // 本关人数快照（开打定一次）
    const e = sharedEnemyAt(s.levels, s.levelIndex, s.stepIndex, levelPlayerCountRef.current)
    if (!e) return
    sharedHpRef.current = e.enemyHp
    sharedMaxRef.current = e.enemyHp
    queueMicrotask(() => {
      dispatch({
        type: 'COOP_SYNC',
        bossHp: e.enemyHp, bossMaxHp: e.enemyHp,
        levelIndex: s.levelIndex, stepIndex: s.stepIndex,
      })
      broadcastFrame({
        levelIndex: s.levelIndex, stepIndex: s.stepIndex,
        enemyName: e.enemyName, enemyEmoji: e.enemyEmoji,
        hp: e.enemyHp, maxHp: e.enemyHp, phase: 'playing',
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.isHost])

  return useMemo(() => ({ reportHit }), [reportHit])
}

/** guest：把 host 快照对齐到本地 reducer。 */
function applyGuestShared(shared: CoopShared, local: GameState, dispatch: Dispatch<Action>) {
  if (shared.phase === 'lobby') return
  if (shared.phase === 'won') {
    dispatch({ type: 'COOP_WON' })
    return
  }
  // 推进判定按【稳定的步骤身份】(levelIndex/stepIndex)，不要按 bossName——小怪名字会重复，按名字会漏推进。
  const advanced =
    shared.levelIndex !== local.levelIndex || shared.stepIndex !== local.stepIndex
  if (advanced) {
    // 是否 Boss：当前步骤 stepIndex >= 该关小怪数 即为 Boss（与 reducer isBossStep 一致）。
    // guest 据此让 Phaser 用大形象 + 皇冠 spawn，并显示 Boss 血条。
    const level = local.levels[shared.levelIndex]
    const isBoss = level != null && shared.stepIndex >= level.mobs.length
    // 换敌人 + 同步进度（COOP_ADVANCE 自带 levelIndex/stepIndex），随后再 SYNC 当前血量
    dispatch({
      type: 'COOP_ADVANCE',
      levelIndex: shared.levelIndex,
      stepIndex: shared.stepIndex,
      enemyEmoji: shared.bossEmoji,
      enemyName: shared.bossName,
      enemyHp: shared.bossMaxHp,
      isBoss,
    })
  }
  dispatch({
    type: 'COOP_SYNC',
    bossHp: shared.bossHp,
    bossMaxHp: shared.bossMaxHp,
    levelIndex: shared.levelIndex,
    stepIndex: shared.stepIndex,
  })
}
