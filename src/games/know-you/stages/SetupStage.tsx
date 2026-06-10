import { Play, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { QuestionsPerRole, RoleId } from '../types'
import { ROLES } from '../types'
import { cn } from '@/lib/utils'

interface SetupStageProps {
  players: Set<RoleId>
  perRole: QuestionsPerRole
  onTogglePlayer: (r: RoleId) => void
  onChangePerRole: (n: QuestionsPerRole) => void
  onStart: () => void
}

const PER_ROLE_OPTIONS: QuestionsPerRole[] = [3, 5, 8]

export function SetupStage({
  players,
  perRole,
  onTogglePlayer,
  onChangePerRole,
  onStart,
}: SetupStageProps) {
  const canStart = players.size >= 2
  const totalQuestions = players.size * perRole

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Settings2 className="h-5 w-5 text-melon-600" />
          开局设置
        </CardTitle>
        <CardDescription>勾选今天在场的家人，选每人几道题。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink-700">今天谁在场？（至少 2 人）</div>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((role) => {
              const active = players.has(role.id)
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => onTogglePlayer(role.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border p-3 text-left transition',
                    active
                      ? 'border-melon-500 bg-melon-50 shadow'
                      : 'border-ink-200 bg-white opacity-60 hover:border-melon-300 hover:opacity-100'
                  )}
                >
                  <span className="text-3xl">{role.emoji}</span>
                  <span>
                    <span className="block text-sm font-semibold text-ink-900">{role.name}</span>
                    <span className="block text-xs text-ink-500">{role.desc}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {!canStart && <div className="text-xs text-rose-600">至少要有 2 位家人才能玩</div>}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink-700">每人几道题</div>
          <div className="grid grid-cols-3 gap-2">
            {PER_ROLE_OPTIONS.map((n) => {
              const active = perRole === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChangePerRole(n)}
                  className={cn(
                    'h-12 rounded-2xl border text-sm font-medium transition',
                    active
                      ? 'border-ink-700 bg-ink-700 text-white shadow'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400'
                  )}
                >
                  {n} 道
                </button>
              )
            })}
          </div>
          <div className="text-xs text-ink-500">
            本局共 {totalQuestions} 道题，主角轮流换。3 道 = 快速一局 / 8 道 = 深度互怼
          </div>
        </div>
      </CardContent>
      <div className="px-6 pb-6">
        <Button onClick={onStart} disabled={!canStart} className="h-14 w-full gap-2 text-base">
          <Play className="h-5 w-5" />
          开始出题
        </Button>
      </div>
    </Card>
  )
}
