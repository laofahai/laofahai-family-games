// 在线对战的纯计算：本地两份 Fighter（me=左, opp=右）+ 一次作答/收到对端 strike
// 如何改血、判胜负。无渲染、无副作用，方便推理与复用。

import {
  applyDamage,
  isDown,
  makeFighter,
  resolveAnswer,
  type Fighter,
} from '@/games/_battle/core'
import { randomAttackKind, type AttackKind } from '../duelTypes'
import type { StageFx } from '../components/DuelStage'
import { onlineFx } from '../stageFx'
import type { StrikeMsg } from './protocol'

export interface OnlineFighters {
  me: Fighter
  opp: Fighter
}

export function makeOnlineFighters(
  meSpec: { name: string; emoji: string },
  oppSpec: { name: string; emoji: string },
  maxHp: number
): OnlineFighters {
  return {
    me: makeFighter('me', meSpec.name, meSpec.emoji, maxHp),
    opp: makeFighter('opp', oppSpec.name, oppSpec.emoji, maxHp),
  }
}

export type OnlineWinner = 'me' | 'opp' | 'draw' | null

export interface LocalAnswerResult {
  fighters: OnlineFighters
  fx: StageFx
  msg: StrikeMsg
  /** 这一击后是否分出胜负（draw=同归于尽，null=未结束）。 */
  winner: OnlineWinner
  correct: boolean
  crit: boolean
  damage: number
}

/** 我作答（answeredCorrect 已判好）：改血、产 fx（我=左 attacker）、产要广播的 msg。 */
export function applyMyAnswer(
  f: OnlineFighters,
  correct: boolean,
  myStreakBefore: number,
  uid: string
): LocalAnswerResult {
  const res = resolveAnswer(correct, myStreakBefore)
  const kind: AttackKind = randomAttackKind()
  // 答对 → 打对手(opp)；答错 → 自损(me)
  const next: OnlineFighters =
    res.target === 'enemy'
      ? { ...f, opp: applyDamage(f.opp, res.damage) }
      : { ...f, me: applyDamage(f.me, res.damage) }

  const victimSide: 'left' | 'right' = res.target === 'enemy' ? 'right' : 'left'
  const victimHpAfter = res.target === 'enemy' ? next.opp.hp : next.me.hp
  const down = res.target === 'enemy' ? isDown(next.opp) : isDown(next.me)

  const fx = onlineFx({
    attacker: 'left',
    victim: victimSide,
    target: res.target,
    kind,
    crit: res.crit,
    damage: res.damage,
    victimHpAfter,
    down,
  })

  const msg: StrikeMsg = {
    t: 'strike',
    uid,
    correct,
    crit: res.crit,
    damage: res.damage,
    kind,
    target: res.target,
    myHpAfter: next.me.hp,
    streak: correct ? myStreakBefore + 1 : 0,
  }

  return {
    fighters: next,
    fx,
    msg,
    winner: decideWinner(next),
    correct,
    crit: res.crit,
    damage: res.damage,
  }
}

export interface PeerStrikeResult {
  fighters: OnlineFighters
  fx: StageFx
  winner: OnlineWinner
}

/** 收到对手的 strike：对手=右 attacker。target:'enemy' → 扣【我】的血；'self' → 对齐对手镜像血量。 */
export function applyPeerStrike(f: OnlineFighters, msg: StrikeMsg): PeerStrikeResult {
  let next: OnlineFighters
  let victimSide: 'left' | 'right'
  let victimHpAfter: number

  if (msg.target === 'enemy') {
    // 对手打中我：我自己给自己扣血（我是我血量的唯一写者）
    const me = applyDamage(f.me, msg.damage)
    // 同时用 myHpAfter 对齐对手镜像血量（纠偏，万一上条自损丢了）
    const opp = { ...f.opp, hp: clampHp(f.opp, msg.myHpAfter) }
    next = { me, opp }
    victimSide = 'left'
    victimHpAfter = me.hp
  } else {
    // 对手自损：对齐对手镜像血量到它自己报的真实血量
    const opp = { ...f.opp, hp: clampHp(f.opp, msg.myHpAfter) }
    next = { ...f, opp }
    victimSide = 'right'
    victimHpAfter = opp.hp
  }

  const down = victimSide === 'left' ? isDown(next.me) : isDown(next.opp)
  const fx = onlineFx({
    attacker: 'right',
    victim: victimSide,
    target: msg.target,
    kind: msg.kind,
    crit: msg.crit,
    damage: msg.damage,
    victimHpAfter,
    down,
  })

  return { fighters: next, fx, winner: decideWinner(next) }
}

function clampHp(f: Fighter, hp: number): number {
  return Math.max(0, Math.min(f.maxHp, hp))
}

/** 血先空者负；同归于尽=draw；都没空=null。两端各自从两份血量算，结果对称一致。 */
export function decideWinner(f: OnlineFighters): OnlineWinner {
  const meDown = isDown(f.me)
  const oppDown = isDown(f.opp)
  if (oppDown && meDown) return 'draw'
  if (oppDown) return 'me'
  if (meDown) return 'opp'
  return null
}
