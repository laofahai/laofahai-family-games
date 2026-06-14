// 多人共斗·大厅：建房（host，出房号）/ 进房（guest，输房号）/ 在线玩家名单 / 开打。
// 单人也走这套（一人房）：直接「自己一个人打」= 建个房不等人就开。
//
// 云端没配（supabase=null）时，online=false：只放行「自己一个人打」（单人房，无 peer）。

import { useMemo, useState } from 'react'
import type { CoopPlayer } from '@/games/_battle/coop'
import { coopOnline } from '@/games/_battle/coop'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function CoopLobby({
  playerName,
  code,
  isHost,
  players,
  inRoom,
  onHost,
  onJoin,
  onStart,
  onSolo,
  onLeave,
  onBack,
}: {
  playerName: string
  code: string | null
  isHost: boolean
  players: CoopPlayer[]
  inRoom: boolean // 是否已建/进房（显示名单与开打）
  onHost: () => void
  onJoin: (code: string) => void
  onStart: () => void // host 开打
  onSolo: () => void // 一个人打（单人房）
  onLeave: () => void
  onBack: () => void
}) {
  const online = useMemo(() => coopOnline(), [])
  const [joinCode, setJoinCode] = useState('')

  // 已进房：名单 + 开打
  if (inRoom) {
    return (
      <Card className="mx-auto max-w-xl space-y-4 p-6">
        <div className="text-center">
          <div className="text-4xl">🧒⚔️🧒</div>
          <h2 className="mt-1 font-display text-2xl text-ink-900">一起打老师</h2>
          {code && (
            <p className="mt-1 text-sm text-ink-600">
              房号 <span className="font-mono text-2xl tracking-[0.3em] text-rose-600">{code}</span>
              <br />
              把房号告诉同学，让 TA 在自己手机上输房号进来。
            </p>
          )}
        </div>

        <PlayerList players={players} />

        <div className="rounded-2xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          共斗规则：大家一起打<b>同一个</b>老师/同学（血量按人数变厚），各答<b>各自年级</b>的题，
          一起推进。全部打完 = 收获一段<b>美好的回忆</b> 🎞️。
        </div>

        <div className="flex flex-col gap-3">
          {isHost ? (
            <Button onClick={onStart} className="min-h-12 bg-rose-500 text-base text-white hover:bg-rose-600">
              {players.length > 1 ? `开打！（${players.length} 人）` : '人到齐了？开打！'}
            </Button>
          ) : (
            <p className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-4 text-center text-sm text-ink-500">
              等房主开始…（你的题目会按你的年级出）
            </p>
          )}
          <Button onClick={onLeave} variant="outline" className="min-h-12 text-base">
            退出房间
          </Button>
        </div>
      </Card>
    )
  }

  // 未进房：选建房 / 进房 / 一个人打
  return (
    <Card className="mx-auto max-w-xl space-y-4 p-6">
      <div className="text-center">
        <div className="text-4xl">🧒⚔️🧑‍🏫</div>
        <h2 className="mt-1 font-display text-2xl text-ink-900">邀请同学一起打</h2>
        <p className="mt-1 text-sm text-ink-600">
          {playerName}，叫上同学/家人，各用各的手机，一起合力打老师！
        </p>
      </div>

      {online ? (
        <>
          <Button onClick={onHost} className="min-h-12 bg-rose-500 text-base text-white hover:bg-rose-600">
            我来建房（当房主）👑
          </Button>

          <div className="flex items-center gap-2 text-xs text-ink-400">
            <div className="h-px flex-1 bg-ink-100" />
            或者加入别人的房
            <div className="h-px flex-1 bg-ink-100" />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && joinCode.length >= 3) onJoin(joinCode)
              }}
              placeholder="输房号"
              maxLength={6}
              className="h-12 flex-1 rounded-2xl border border-ink-200 px-3 text-center text-lg tracking-widest outline-none focus:border-rose-400"
            />
            <Button
              onClick={() => onJoin(joinCode)}
              disabled={joinCode.length < 3}
              variant="outline"
              className="h-12 w-full sm:w-auto"
            >
              加入
            </Button>
          </div>
        </>
      ) : (
        <p className="rounded-2xl bg-sky-50 p-3 text-center text-sm text-sky-700">
          当前没连上云端，暂时只能一个人打～（联网后即可邀请同学）
        </p>
      )}

      <div className="flex items-center gap-2 text-xs text-ink-400">
        <div className="h-px flex-1 bg-ink-100" />
        或
        <div className="h-px flex-1 bg-ink-100" />
      </div>

      <Button onClick={onSolo} variant="outline" className="min-h-12 text-base">
        我自己一个人打 🧒
      </Button>

      <Button onClick={onBack} variant="ghost" className="text-ink-500">
        ← 返回
      </Button>
    </Card>
  )
}

export function PlayerList({ players, currentEnemyName }: { players: CoopPlayer[]; currentEnemyName?: string }) {
  if (players.length === 0) {
    return <p className="text-center text-sm text-ink-400">还没有人…（你自己马上就好）</p>
  }
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {players.map((p) => (
        <span
          key={p.id}
          className={
            'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ' +
            (p.down
              ? 'border-ink-200 bg-ink-50 text-ink-400 line-through'
              : 'border-rose-200 bg-rose-50 text-rose-700')
          }
          title={currentEnemyName ? `正在打 ${currentEnemyName}` : undefined}
        >
          <span>{p.emoji}</span>
          <span>{p.name}</span>
          {p.isHost && <span title="房主">👑</span>}
          <span className="text-xs text-ink-400">
            {p.band === 'low' ? '低年级' : '高年级'}
          </span>
        </span>
      ))}
    </div>
  )
}
