// 把一次结算（Strike / 在线 StrikeMsg）翻译成给 Phaser 舞台的声明式动画指令。
// 本地与在线两条路径共用，保证两端动画一致。

import type { StageFx } from './components/DuelStage'
import type { Strike } from './types'
import type { AttackKind } from './duelTypes'

/** 本地引擎的 Strike → StageFx。winnerSide 非空表示这一击击倒了某方。 */
export function strikeToFx(strike: Strike, winnerSide: 'left' | 'right' | null): StageFx {
  const downAfter =
    winnerSide != null ? (winnerSide === 'left' ? 'right' : 'left') : undefined
  return {
    kind: 'hit',
    attacker: strike.attacker,
    victim: strike.victim,
    target: strike.target,
    attack: strike.kind,
    crit: strike.crit,
    damage: strike.damage,
    victimHpAfter: strike.victimHpAfter,
    downAfter,
  }
}

/** 在线：构造一次出招的 StageFx（attacker/victim 为「我方/对方」映射后的左右）。 */
export function onlineFx(args: {
  attacker: 'left' | 'right'
  victim: 'left' | 'right'
  target: 'enemy' | 'self'
  kind: AttackKind
  crit: boolean
  damage: number
  victimHpAfter: number
  down: boolean
}): StageFx {
  return {
    kind: 'hit',
    attacker: args.attacker,
    victim: args.victim,
    target: args.target,
    attack: args.kind,
    crit: args.crit,
    damage: args.damage,
    victimHpAfter: args.victimHpAfter,
    downAfter: args.down ? args.victim : undefined,
  }
}
