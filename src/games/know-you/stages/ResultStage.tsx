import { RotateCcw, Settings2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { RoleId, RoundRecord } from '../types'
import { ROLE_MAP } from '../types'
import { cn } from '@/lib/utils'

interface ResultStageProps {
  records: RoundRecord[]
  players: RoleId[]
  onNextGame: () => void
  onChangeSetup: () => void
  onExit: () => void
}

interface Score {
  role: RoleId
  hearts: number
  secrets: number
}

function computeScores(records: RoundRecord[], players: RoleId[]): Score[] {
  const map = new Map<RoleId, Score>(players.map((p) => [p, { role: p, hearts: 0, secrets: 0 }]))
  for (const rec of records) {
    if (rec.correctGuessers.length === 0) {
      const hero = map.get(rec.question.role)
      if (hero) hero.secrets += 1
    } else {
      for (const g of rec.correctGuessers) {
        const s = map.get(g)
        if (s) s.hearts += 1
      }
    }
  }
  return [...map.values()]
}

export function ResultStage({ records, players, onNextGame, onChangeSetup, onExit }: ResultStageProps) {
  const scores = computeScores(records, players)
  const byHearts = [...scores].sort((a, b) => b.hearts - a.hearts)
  const bySecrets = [...scores].sort((a, b) => b.secrets - a.secrets)
  const topHearts = byHearts[0]?.hearts ?? 0
  const topSecrets = bySecrets[0]?.secrets ?? 0

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Trophy className="h-5 w-5 text-melon-600" />
          本局战报
        </CardTitle>
        <CardDescription>共 {records.length} 道题。❤️ 了解分 = 答对别人的题；🤫 独家分 = 自己的题没人答对。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="text-sm font-semibold text-emerald-900">❤️ 最懂家人榜</div>
            <ul className="mt-3 space-y-2">
              {byHearts.map((s, idx) => (
                <li key={s.role} className="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span className="text-2xl">{ROLE_MAP[s.role].emoji}</span>
                    <span className="text-sm font-semibold text-ink-900">{ROLE_MAP[s.role].name}</span>
                    {idx === 0 && s.hearts > 0 && s.hearts === topHearts && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        全家百事通
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-bold text-emerald-700">{s.hearts} ❤️</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="text-sm font-semibold text-amber-900">🤫 最神秘家人榜</div>
            <ul className="mt-3 space-y-2">
              {bySecrets.map((s, idx) => (
                <li key={s.role} className="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span className="text-2xl">{ROLE_MAP[s.role].emoji}</span>
                    <span className="text-sm font-semibold text-ink-900">{ROLE_MAP[s.role].name}</span>
                    {idx === 0 && s.secrets > 0 && s.secrets === topSecrets && (
                      <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        最神秘家人
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-bold text-amber-700">{s.secrets} 🤫</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-ink-200/70 bg-white/70 p-4 text-xs text-ink-500">
          独家分多，说明这位家人还有很多你们不知道的故事——正好趁现在让 TA 多讲两句。
        </div>

        <details className="rounded-2xl border border-ink-100/70 bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-ink-500">查看每题记录</summary>
          <ul className="mt-2 max-h-[30vh] space-y-2 overflow-y-auto pr-1">
            {records.map((rec, idx) => (
              <li
                key={idx}
                className={cn(
                  'rounded-2xl border px-3 py-2 text-xs',
                  rec.correctGuessers.length === 0
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-emerald-200 bg-emerald-50'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-700">
                    {ROLE_MAP[rec.question.role].emoji} {rec.question.emoji} {rec.question.text}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {rec.correctGuessers.length === 0
                      ? '🤫'
                      : rec.correctGuessers.map((g) => ROLE_MAP[g].emoji).join('')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
      <div className="flex flex-col gap-2 px-6 pb-6 sm:flex-row">
        <Button onClick={onNextGame} className="h-12 flex-1 gap-2">
          <RotateCcw className="h-4 w-4" />
          再来一局（新题目）
        </Button>
        <Button onClick={onChangeSetup} variant="outline" className="h-12 flex-1 gap-2">
          <Settings2 className="h-4 w-4" />
          换设置
        </Button>
        <Button onClick={onExit} variant="ghost" className="h-12 flex-1">
          返回首页
        </Button>
      </div>
    </Card>
  )
}
